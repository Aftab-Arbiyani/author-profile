/**
 * EPUB ingest for the ARC importer.
 *
 * An EPUB is treated purely as an input format: this module unpacks one in
 * memory, walks the spine, and returns manuscript chapters as sanitised HTML
 * for the author to review before anything is written. The file itself is never
 * stored, and images are dropped (see `sanitizeEpubHtml`).
 *
 * Pure by design — no Firestore, no filesystem, no env — so it can be exercised
 * against real EPUBs in isolation.
 *
 * Nothing here trusts the archive's structure. Real-world EPUBs carry
 * URL-encoded hrefs, fragment-bearing TOC links, font-only encryption, spine
 * items that are SVG covers rather than text, and paragraphs marked up as
 * divs. Chapters are never silently dropped: anything that looks like front or
 * back matter is flagged for the author to skip, because no heuristic is good
 * enough to decide that on its own.
 */
import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";
import { sanitizeEpubHtml } from "@/lib/sanitize";

export type EpubErrorCode =
  | "not-a-zip"
  | "no-container"
  | "no-opf"
  | "empty-spine"
  | "drm";

export class EpubParseError extends Error {
  constructor(
    public code: EpubErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "EpubParseError";
  }
}

export type ParsedChapter = {
  /** Position in the spine; stable identity for a preview row. */
  index: number;
  href: string;
  title: string;
  /** Sanitised prose, images already stripped. */
  html: string;
  /** Visible character count, for the preview. */
  textLength: number;
  /** True when this looks like front/back matter rather than a chapter. */
  defaultSkip: boolean;
  skipReason?: string;
  /** Set when one oversized spine item was split across several chapters. */
  part?: { n: number; of: number };
};

export type EpubParseResult = {
  bookTitle?: string;
  chapters: ParsedChapter[];
};

/**
 * Chapters are split above this size. Comfortably under the 900k cap in
 * lib/arc.ts, so a commit can never fail on document size.
 */
const MAX_CHAPTER_HTML = 800_000;

/** Below this many visible characters, a spine item isn't a chapter. */
const MIN_CHAPTER_TEXT = 200;

const FRONT_BACK_MATTER =
  /\b(cover|title\s*page|half\s*title|copyright|colophon|dedication|acknowledg\w*|about\s+the\s+author|about\s+the\s+publisher|also\s+by|other\s+books|contents|table\s+of\s+contents|toc|epigraph|preface|foreword|afterword|imprint|glossary|newsletter|mailing\s*list|preview|excerpt|sneak\s*peek|credits|permissions|praise\s+for)\b/i;

const XHTML_TYPES = new Set([
  "application/xhtml+xml",
  "text/html",
  "application/x-dtbook+xml",
]);

const FONT_FILE = /\.(ttf|otf|woff2?|eot)$/i;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  // Some EPUBs namespace-prefix everything (opf:manifest, ncx:navMap).
  removeNSPrefix: true,
  parseTagValue: false,
  trimValues: true,
});

/** fast-xml-parser collapses single-element arrays; normalise both shapes. */
function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function attr(node: unknown, name: string): string | undefined {
  if (!node || typeof node !== "object") return undefined;
  const value = (node as Record<string, unknown>)[`@_${name}`];
  return typeof value === "string" ? value : undefined;
}

/** Resolves an OPF/NCX-relative href against the directory holding that file. */
function resolveHref(base: string, href: string): string {
  const clean = stripFragment(decodeHref(href));

  if (!base) return clean;

  const segments = base.split("/").filter(Boolean);
  segments.pop(); // drop the file name, keep its directory

  for (const part of clean.split("/")) {
    if (part === "." || part === "") continue;
    if (part === "..") segments.pop();
    else segments.push(part);
  }

  return segments.join("/");
}

function decodeHref(href: string): string {
  try {
    return decodeURIComponent(href);
  } catch {
    return href;
  }
}

function stripFragment(href: string): string {
  const hash = href.indexOf("#");
  return hash === -1 ? href : href.slice(0, hash);
}

function textContent(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&[a-z]+;|&#\d+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Inner HTML of <body>, or the whole document when there's no body tag. */
function bodyOf(xhtml: string): string {
  const match = xhtml.match(/<body\b[^>]*>([\s\S]*?)<\/body\s*>/i);
  return match ? match[1] : xhtml;
}

function humanizeFilename(href: string): string {
  const base = href.split("/").pop() ?? href;

  return (
    base
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (c) => c.toUpperCase()) || "Untitled"
  );
}

/** First heading in a document, used when the TOC has no entry for it. */
function headingTitle(body: string): string | null {
  const match = body.match(/<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]\s*>/i);

  if (!match) return null;

  const text = textContent(match[1]);
  return text.length > 0 && text.length <= 200 ? text : null;
}

/**
 * Rejects DRM-protected archives. Font obfuscation is legitimate and common, so
 * an encryption.xml that only covers font files is not treated as DRM.
 */
async function assertNotDrm(zip: JSZip): Promise<void> {
  const file = zip.file("META-INF/encryption.xml");

  if (!file) return;

  const xml = await file.async("string");
  const parsed = parser.parse(xml) as Record<string, unknown>;
  const encryption = (parsed.encryption ?? {}) as Record<string, unknown>;
  const encrypted = asArray(encryption.EncryptedData);

  const uris: string[] = [];

  for (const item of encrypted) {
    const node = item as Record<string, unknown>;
    for (const ref of asArray(node.CipherData)) {
      const cipher = ref as Record<string, unknown>;
      for (const target of asArray(cipher.CipherReference)) {
        const uri = attr(target, "URI");
        if (uri) uris.push(uri);
      }
    }
  }

  // No parseable references but an encryption manifest exists: assume the worst.
  if (uris.length === 0 || uris.some((uri) => !FONT_FILE.test(stripFragment(uri)))) {
    throw new EpubParseError(
      "drm",
      "This EPUB is DRM-protected, so its chapters can't be read. Export an unencrypted EPUB from your writing app and try again.",
    );
  }
}

/** Locates the OPF package document via META-INF/container.xml. */
async function findOpfPath(zip: JSZip): Promise<string> {
  const container = zip.file("META-INF/container.xml");

  if (!container) {
    throw new EpubParseError(
      "no-container",
      "That EPUB is missing its container file, so it can't be read.",
    );
  }

  const parsed = parser.parse(await container.async("string")) as Record<
    string,
    unknown
  >;
  const root = (parsed.container ?? {}) as Record<string, unknown>;
  const rootfiles = (root.rootfiles ?? {}) as Record<string, unknown>;

  for (const entry of asArray(rootfiles.rootfile)) {
    const path = attr(entry, "full-path");
    if (path) return decodeHref(path);
  }

  throw new EpubParseError(
    "no-opf",
    "That EPUB doesn't declare a package document, so it can't be read.",
  );
}

type ManifestItem = {
  id: string;
  href: string;
  mediaType: string;
  properties: string;
};

/** href (fragment-stripped) -> title, from the EPUB3 nav doc or EPUB2 NCX. */
async function buildTitleMap(
  zip: JSZip,
  opfPath: string,
  manifest: Map<string, ManifestItem>,
  ncxId: string | undefined,
): Promise<Map<string, string>> {
  const titles = new Map<string, string>();

  // EPUB2 first, so a nav doc's entries win on conflict.
  const ncx =
    (ncxId ? manifest.get(ncxId) : undefined) ??
    [...manifest.values()].find(
      (item) => item.mediaType === "application/x-dtbncx+xml",
    );

  if (ncx) {
    const file = zip.file(ncx.href);

    if (file) {
      try {
        const parsed = parser.parse(await file.async("string")) as Record<
          string,
          unknown
        >;
        const doc = (parsed.ncx ?? {}) as Record<string, unknown>;
        const navMap = (doc.navMap ?? {}) as Record<string, unknown>;

        const walk = (points: unknown[]) => {
          for (const point of points) {
            const node = point as Record<string, unknown>;
            const content = asArray(node.content)[0];
            const src = attr(content, "src");
            const label = asArray(node.navLabel)[0] as
              | Record<string, unknown>
              | undefined;
            const text = label?.text;
            const title =
              typeof text === "string"
                ? text
                : typeof (text as Record<string, unknown> | undefined)?.[
                      "#text"
                    ] === "string"
                  ? String((text as Record<string, unknown>)["#text"])
                  : "";

            if (src && title) {
              const key = resolveHref(ncx.href, src);
              if (!titles.has(key)) titles.set(key, title.trim());
            }

            walk(asArray(node.navPoint));
          }
        };

        walk(asArray(navMap.navPoint));
      } catch {
        // A malformed NCX just means falling back to headings.
      }
    }
  }

  const nav = [...manifest.values()].find((item) =>
    item.properties.split(/\s+/).includes("nav"),
  );

  if (nav) {
    const file = zip.file(nav.href);

    if (file) {
      const xhtml = await file.async("string");
      // Prefer the toc nav; fall back to the first nav element present.
      const tocBlock =
        xhtml.match(
          /<nav\b[^>]*epub:type\s*=\s*["'][^"']*\btoc\b[^"']*["'][^>]*>([\s\S]*?)<\/nav\s*>/i,
        ) ?? xhtml.match(/<nav\b[^>]*>([\s\S]*?)<\/nav\s*>/i);

      if (tocBlock) {
        const anchors = tocBlock[1].matchAll(
          /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a\s*>/gi,
        );

        for (const [, href, label] of anchors) {
          const title = textContent(label);
          if (!title) continue;
          titles.set(resolveHref(nav.href, href), title);
        }
      }
    }
  }

  void opfPath;
  return titles;
}

/** Splits oversized HTML on paragraph boundaries so no chapter exceeds the cap. */
function splitHtml(html: string): string[] {
  if (html.length <= MAX_CHAPTER_HTML) return [html];

  const pieces: string[] = [];
  // Keep the closing tag with its paragraph.
  const blocks = html.split(/(?<=<\/p\s*>)/i);
  let current = "";

  for (const block of blocks) {
    if (current && current.length + block.length > MAX_CHAPTER_HTML) {
      pieces.push(current);
      current = "";
    }

    if (block.length > MAX_CHAPTER_HTML) {
      // A single paragraph past the cap: hard-split it on whitespace.
      let rest = current + block;
      current = "";

      while (rest.length > MAX_CHAPTER_HTML) {
        const cut = rest.lastIndexOf(" ", MAX_CHAPTER_HTML);
        const at = cut > MAX_CHAPTER_HTML / 2 ? cut : MAX_CHAPTER_HTML;
        pieces.push(rest.slice(0, at));
        rest = rest.slice(at);
      }

      current = rest;
      continue;
    }

    current += block;
  }

  if (current.trim()) pieces.push(current);

  return pieces.length > 0 ? pieces : [html];
}

/** Flags likely front/back matter. Advisory only — the author decides. */
function classify(
  title: string,
  href: string,
  body: string,
  text: string,
  linear: boolean,
): { defaultSkip: boolean; skipReason?: string } {
  if (!linear) {
    return { defaultSkip: true, skipReason: "Not part of the reading order" };
  }

  if (FRONT_BACK_MATTER.test(title) || FRONT_BACK_MATTER.test(href)) {
    return { defaultSkip: true, skipReason: "Looks like front or back matter" };
  }

  if (text.length < MIN_CHAPTER_TEXT) {
    return { defaultSkip: true, skipReason: "Almost no text" };
  }

  // Contents pages are mostly link text. Measured before sanitising, which
  // strips the anchors entirely.
  const linkText = [...body.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a\s*>/gi)]
    .map(([, inner]) => textContent(inner))
    .join(" ");

  if (linkText.length > text.length * 0.5) {
    return { defaultSkip: true, skipReason: "Mostly links — likely a contents page" };
  }

  return { defaultSkip: false };
}

/**
 * Unpacks an EPUB and returns its chapters in spine order.
 *
 * Throws `EpubParseError` with a reader-facing message for every failure the
 * author can act on.
 */
export async function parseEpub(buffer: Buffer): Promise<EpubParseResult> {
  let zip: JSZip;

  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new EpubParseError(
      "not-a-zip",
      "That file isn't a valid EPUB — it couldn't be opened as an archive.",
    );
  }

  await assertNotDrm(zip);

  const opfPath = await findOpfPath(zip);
  const opfFile = zip.file(opfPath);

  if (!opfFile) {
    throw new EpubParseError(
      "no-opf",
      "That EPUB's package document is missing from the archive.",
    );
  }

  const opf = parser.parse(await opfFile.async("string")) as Record<
    string,
    unknown
  >;
  const pkg = (opf.package ?? {}) as Record<string, unknown>;

  const metadata = (pkg.metadata ?? {}) as Record<string, unknown>;
  const rawTitle = asArray(metadata.title)[0];
  const bookTitle =
    typeof rawTitle === "string"
      ? rawTitle
      : typeof (rawTitle as Record<string, unknown> | undefined)?.["#text"] ===
          "string"
        ? String((rawTitle as Record<string, unknown>)["#text"])
        : undefined;

  const manifestNode = (pkg.manifest ?? {}) as Record<string, unknown>;
  const manifest = new Map<string, ManifestItem>();

  for (const entry of asArray(manifestNode.item)) {
    const id = attr(entry, "id");
    const href = attr(entry, "href");

    if (!id || !href) continue;

    manifest.set(id, {
      id,
      href: resolveHref(opfPath, href),
      mediaType: (attr(entry, "media-type") ?? "").toLowerCase(),
      properties: attr(entry, "properties") ?? "",
    });
  }

  const spineNode = (pkg.spine ?? {}) as Record<string, unknown>;
  const itemrefs = asArray(spineNode.itemref);

  if (itemrefs.length === 0) {
    throw new EpubParseError(
      "empty-spine",
      "That EPUB lists no reading order, so there are no chapters to import.",
    );
  }

  const titles = await buildTitleMap(
    zip,
    opfPath,
    manifest,
    attr(spineNode, "toc"),
  );

  const navHref = [...manifest.values()].find((item) =>
    item.properties.split(/\s+/).includes("nav"),
  )?.href;

  const chapters: ParsedChapter[] = [];
  let index = 0;

  for (const itemref of itemrefs) {
    const idref = attr(itemref, "idref");
    const item = idref ? manifest.get(idref) : undefined;

    // Skip anything that isn't a text document (SVG covers, stray images) and
    // the navigation document itself.
    if (!item || !XHTML_TYPES.has(item.mediaType) || item.href === navHref) {
      continue;
    }

    const file = zip.file(item.href);

    if (!file) continue;

    const xhtml = await file.async("string");
    const body = bodyOf(xhtml);

    // Title detection runs before sanitising: the EPUB profile drops headings'
    // attributes but the TOC lookup and heading fallback both read raw markup.
    const title =
      titles.get(item.href) ?? headingTitle(body) ?? humanizeFilename(item.href);

    const html = sanitizeEpubHtml(body);
    const text = textContent(html);
    const linear = (attr(itemref, "linear") ?? "yes").toLowerCase() !== "no";
    const { defaultSkip, skipReason } = classify(
      title,
      item.href,
      body,
      text,
      linear,
    );

    const pieces = splitHtml(html);

    pieces.forEach((piece, pieceIndex) => {
      chapters.push({
        index,
        href: item.href,
        title:
          pieces.length > 1 && pieceIndex > 0 ? `${title} (cont.)` : title,
        html: piece,
        textLength: pieces.length > 1 ? textContent(piece).length : text.length,
        defaultSkip,
        skipReason,
        ...(pieces.length > 1
          ? { part: { n: pieceIndex + 1, of: pieces.length } }
          : {}),
      });
      index += 1;
    });
  }

  if (chapters.length === 0) {
    throw new EpubParseError(
      "empty-spine",
      "No readable chapters were found in that EPUB.",
    );
  }

  return { bookTitle, chapters };
}
