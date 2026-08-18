/**
 * Allowlist sanitisers for HTML that is stored and later rendered via
 * `dangerouslySetInnerHTML`. Both profiles run on save, never on read — stored
 * HTML is not re-sanitised when rendered, so tightening a profile only affects
 * future saves.
 *
 * Two profiles, because the two inputs are nothing alike:
 *   - `sanitizeEditorHtml` — admin-authored blog/chapter HTML from
 *     RichTextEditor. Only the authenticated author can submit it, but the tag
 *     set is wide and browser-dependent (`document.execCommand` emits `<b>` in
 *     some engines and `<span style="font-weight:bold">` in others), and pasted
 *     content arrives as full marked-GFM output.
 *   - `sanitizeEpubHtml` — manuscript prose extracted from an uploaded EPUB.
 *     Deliberately narrow: EPUB toolchains bury prose under classes, ids and
 *     inline styles that mean nothing here, so every attribute is dropped.
 *     Omitting `img` is also how EPUB image stripping is implemented.
 */
import sanitizeHtml from "sanitize-html";

const EDITOR_PROFILE: sanitizeHtml.IOptions = {
  allowedTags: [
    "p",
    "br",
    "hr",
    "h2",
    "h3",
    "h4",
    "blockquote",
    "b",
    "strong",
    "i",
    "em",
    "u",
    "del",
    "span",
    "a",
    "ul",
    "ol",
    "li",
    "pre",
    "code",
    "img",
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    img: ["src", "alt", "width", "height"],
    // execCommand's bold/italic/underline fall back to styled spans on some
    // engines; dropping span[style] would visibly unformat existing posts.
    span: ["style"],
  },
  allowedSchemes: ["https", "http", "mailto"],
  // Pasted inline images arrive as data: URIs; they're safe in `src`, never in
  // `href` (where data:text/html is a navigation vector).
  allowedSchemesByTag: { img: ["https", "http", "data"] },
  allowedStyles: {
    span: {
      "font-weight": [/^(bold|bolder|[4-9]00)$/],
      "font-style": [/^italic$/],
      "text-decoration": [/^(underline|line-through)$/],
      "text-decoration-line": [/^(underline|line-through)$/],
    },
  },
  // Discarding a block tag keeps its children, which would run consecutive
  // lines together ("<div>a</div><div>b</div>" -> "ab"). execCommand emits bare
  // divs for new paragraphs on some engines, so map them to paragraphs instead.
  transformTags: { div: "p" },
  disallowedTagsMode: "discard",
};

export function sanitizeEditorHtml(input: string): string {
  return sanitizeHtml(input, EDITOR_PROFILE);
}

const EPUB_PROFILE: sanitizeHtml.IOptions = {
  allowedTags: [
    "p",
    "br",
    "hr",
    "h1",
    "h2",
    "h3",
    "blockquote",
    "b",
    "strong",
    "i",
    "em",
    "span",
    "ul",
    "ol",
    "li",
  ],
  // No attributes at all, so no schemes are reachable either. `img` is absent
  // from allowedTags above, which is what strips manuscript images.
  allowedAttributes: {},
  allowedSchemes: [],
  // Plenty of EPUB toolchains mark paragraphs up as `<div class="para">`
  // rather than `<p>`; discarding those would fuse the whole chapter into one
  // block of text. Wrapper divs become redundant paragraphs, which browsers
  // flatten harmlessly. `section`/`article` wrappers are discarded normally —
  // that keeps their children, which is what we want.
  transformTags: { div: "p" },
  disallowedTagsMode: "discard",
};

export function sanitizeEpubHtml(input: string): string {
  return sanitizeHtml(input, EPUB_PROFILE).trim();
}
