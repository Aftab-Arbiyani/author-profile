import { marked, Renderer } from "marked";

/**
 * Markdown → HTML for the blog editor's paste handler.
 *
 * The site's rich-text editor stores content as HTML, so pasted markdown
 * (links, bold/italic, headings, lists, quotes) is converted here on paste.
 *
 * Headings are demoted one level (`#`→h2, `##`→h3, … capped at h4): every blog
 * post page already renders the title as the single <h1>, and the editor's own
 * heading buttons emit h2/h3 — so pasted content must never introduce a second
 * <h1>. `marked.use` mutates the shared singleton, which is fine as this is the
 * only consumer of marked in the app.
 */
const renderer = new Renderer();
renderer.heading = function (token) {
  const level = Math.min((token.depth ?? 1) + 1, 4);
  const text = this.parser.parseInline(token.tokens);
  return `<h${level}>${text}</h${level}>\n`;
};

marked.use({ gfm: true, breaks: true, renderer });

/**
 * Convert pasted markdown to editor HTML. Single-line input is parsed inline
 * (no wrapping <p>) so a link or emphasis inserts cleanly at the cursor;
 * multi-line input is parsed as full block-level markdown.
 */
export function markdownToEditorHtml(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return "";
  }
  return /\n/.test(trimmed)
    ? (marked.parse(trimmed) as string)
    : (marked.parseInline(trimmed) as string);
}
