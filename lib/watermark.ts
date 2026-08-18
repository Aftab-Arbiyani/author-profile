/**
 * Per-reader manuscript fingerprinting, for attributing a leaked advance copy.
 *
 * A 32-bit HMAC of the reader's email is encoded as invisible Unicode
 * formatting characters and woven through the prose at serve time. Nothing is
 * stored: `scripts/detect-watermark.mjs` recovers the bits from leaked text and
 * recomputes the HMAC for each candidate reader to find the match. That keeps
 * the schema untouched and means a fingerprint stays verifiable for as long as
 * the secret does.
 *
 * What this does and doesn't survive: copy-and-paste out of the browser keeps
 * the marks (they ride along in the clipboard as ordinary characters), and so
 * does pasting into most editors, docs and mail clients. Retyping, OCR from a
 * screenshot, and aggressive Unicode normalisation all destroy them. That's the
 * accepted limit — the visible watermark and the read throttle are the other
 * two layers, and none of the three is meant to carry the weight alone.
 *
 * Injection MUST happen at serve time, never on save: `getChapter` also feeds
 * the admin editor, and a stored fingerprint would be re-encoded on the next
 * save and then misattribute any later leak to whoever's copy was pasted back
 * in.
 */
import { createHmac } from "crypto";

/** Delimits a token, so a fingerprint can be located inside arbitrary text. */
export const WM_START = "⁠"; // WORD JOINER
/** Bit 0. */
export const WM_ZERO = "‌"; // ZERO WIDTH NON-JOINER
/** Bit 1. */
export const WM_ONE = "‍"; // ZERO WIDTH JOINER

/** Bits per fingerprint. */
export const WM_BITS = 32;

/** Only segments longer than this carry a token, to keep them out of headings. */
const MIN_SEGMENT_LENGTH = 120;

/** A token goes into every Nth eligible segment — roughly every 2-3 paragraphs. */
const SEGMENT_INTERVAL = 3;

/**
 * Deliberately does NOT fall back to ARC_SESSION_SECRET.
 *
 * The two keys have very different handling: the session secret only ever lives
 * in the server environment, while this one gets carried to wherever a leak is
 * being investigated — a laptop, a shell history, a note. Sharing one value
 * would mean that casual forensic handling also hands over the ability to forge
 * a session cookie for any reader. Separate keys keep a watermark compromise
 * merely embarrassing instead of an authentication bypass.
 */
function watermarkSecret(): string | null {
  return process.env.ARC_WATERMARK_SECRET?.trim() || null;
}

/**
 * The reader's fingerprint as a 32-character bit string, or null when no secret
 * is configured (in which case watermarking is skipped entirely rather than
 * emitting a guessable constant).
 */
export function readerFingerprint(email: string): string | null {
  const secret = watermarkSecret();

  if (!secret) {
    return null;
  }

  const digest = createHmac("sha256", secret)
    .update(email.trim().toLowerCase())
    .digest();

  let bits = "";

  for (let i = 0; i < WM_BITS / 8; i += 1) {
    bits += digest[i].toString(2).padStart(8, "0");
  }

  return bits;
}

/** Encodes a bit string as a delimited run of invisible characters. */
export function encodeToken(bits: string): string {
  let token = WM_START;

  for (const bit of bits) {
    token += bit === "1" ? WM_ONE : WM_ZERO;
  }

  return token + WM_START;
}

/**
 * Weaves the fingerprint through the text content of `html`.
 *
 * Works on the raw string rather than a DOM: it walks the text between tags, so
 * markup is never touched and the pass costs a single regex traversal. Tokens
 * are only ever inserted at a space, which guarantees an HTML entity is never
 * split down the middle.
 */
export function watermarkHtml(html: string, bits: string): string {
  if (!html || bits.length !== WM_BITS) {
    return html;
  }

  const token = encodeToken(bits);
  let eligible = 0;

  return html.replace(/>([^<]+)</g, (match, text: string) => {
    if (text.trim().length < MIN_SEGMENT_LENGTH) {
      return match;
    }

    eligible += 1;

    if (eligible % SEGMENT_INTERVAL !== 1) {
      return match;
    }

    // Anchor at the first space past the midpoint: far enough in that a short
    // quoted excerpt from either end still tends to include it, and always on a
    // character boundary that can't be inside an entity or a word.
    const at = text.indexOf(" ", Math.floor(text.length / 2));

    if (at === -1) {
      return match;
    }

    return `>${text.slice(0, at)}${token}${text.slice(at)}<`;
  });
}

/**
 * Visible-overlay tuning.
 *
 * The angle and the two-per-tile stagger exist to make cropping expensive: a
 * screenshot of any reasonable slice of the column lands on at least one whole
 * address, and a diagonal is far more tedious to paint out than a horizontal
 * band would be. Opacity lives in the stylesheet, not here, so it can be tuned
 * without regenerating the tile.
 */
const TILE_FONT_SIZE = 13;
/** Rough advance width per character, as a fraction of the font size. */
const TILE_CHAR_RATIO = 0.55;
const TILE_ANGLE = -30;
/**
 * Tile size grows with the address, and a tile wider than the reading column
 * thins the pattern out to the point where a crop could miss every label. Past
 * this width a long address is set smaller instead of tiled further apart —
 * down to a floor that's still legible when a leaked screenshot is zoomed.
 */
const TILE_MAX_TEXT_WIDTH = 260;
const TILE_MIN_FONT_SIZE = 9;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Builds a tiling `background-image` data URI that paints the reader's address
 * across the prose, as a `data:image/svg+xml` URL — or "" for an empty address.
 *
 * This is the layer the invisible fingerprint can't cover. Zero-width marks die
 * to OCR and to a photo of the screen; painted text survives both, at the cost
 * of being visible to the honest reader too. Hence the very low opacity: enough
 * to recover the address by zooming into a leaked image, faint enough to read
 * through for hours.
 *
 * The tile is sized from the address rather than fixed, so a long one is never
 * clipped at the tile edge (which would leave a partial, useless address).
 * Everything interpolated is XML-escaped and then percent-encoded, so an address
 * can't break out of the SVG or out of the CSS `url()` that wraps it.
 */
export function visibleWatermarkTile(email: string): string {
  const raw = email.trim();

  if (!raw) {
    return "";
  }

  const label = escapeXml(raw);
  const radians = (Math.abs(TILE_ANGLE) * Math.PI) / 180;
  // Width estimated from the character count: an SVG can't measure its own text
  // and being a little generous only costs whitespace between tiles.
  const naturalWidth = raw.length * TILE_FONT_SIZE * TILE_CHAR_RATIO;
  const fontSize =
    naturalWidth <= TILE_MAX_TEXT_WIDTH
      ? TILE_FONT_SIZE
      : Math.max(
          TILE_MIN_FONT_SIZE,
          Math.floor(TILE_MAX_TEXT_WIDTH / (raw.length * TILE_CHAR_RATIO)),
        );

  const textWidth = raw.length * fontSize * TILE_CHAR_RATIO;
  const spanX = textWidth * Math.cos(radians) + fontSize * Math.sin(radians);
  const spanY = textWidth * Math.sin(radians) + fontSize * Math.cos(radians);

  // Two labels per tile, on opposite quarters: a brick pattern rather than a
  // grid, which doubles the density without letting the two overlap.
  const width = Math.ceil(spanX * 2 + 24);
  const height = Math.ceil(spanY * 2 + 48);
  const ax = Math.round(width / 4);
  const ay = Math.round(height / 4);
  const bx = Math.round((width * 3) / 4);
  const by = Math.round((height * 3) / 4);

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
    `viewBox="0 0 ${width} ${height}">` +
    `<g fill="#171512" font-family="Arial, Helvetica, sans-serif" ` +
    `font-size="${fontSize}" text-anchor="middle">` +
    `<text x="${ax}" y="${ay}" transform="rotate(${TILE_ANGLE} ${ax} ${ay})">${label}</text>` +
    `<text x="${bx}" y="${by}" transform="rotate(${TILE_ANGLE} ${bx} ${by})">${label}</text>` +
    `</g></svg>`;

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * Recovers a fingerprint from text containing one or more tokens.
 *
 * Votes per bit position across every token found, so a leak that mangled one
 * copy still resolves as long as the majority agree. `bits` is null when no
 * complete token is present; `tokenCount` is reported either way so a caller
 * can say how much evidence the verdict rests on.
 *
 * This is the inverse of `watermarkHtml` and the reason both live in one
 * module: scripts/detect-watermark.mjs imports these rather than
 * reimplementing them, so the encoding can never drift out of sync with the
 * tool that has to read it back.
 */
export function extractFingerprint(text: string): {
  bits: string | null;
  tokenCount: number;
} {
  const pattern = new RegExp(
    `${WM_START}[${WM_ZERO}${WM_ONE}]{${WM_BITS}}${WM_START}`,
    "g",
  );
  const tokens = text.match(pattern);

  if (!tokens || tokens.length === 0) {
    return { bits: null, tokenCount: 0 };
  }

  const ones = new Array<number>(WM_BITS).fill(0);

  for (const token of tokens) {
    const body = token.slice(1, -1);

    for (let i = 0; i < WM_BITS; i += 1) {
      if (body[i] === WM_ONE) ones[i] += 1;
    }
  }

  return {
    bits: ones
      .map((count) => (count * 2 > tokens.length ? "1" : "0"))
      .join(""),
    tokenCount: tokens.length,
  };
}
