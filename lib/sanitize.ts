/**
 * Best-effort sanitiser for admin-authored blog HTML, applied on save before
 * the content is stored and later rendered via `dangerouslySetInnerHTML`.
 *
 * IMPORTANT: this is a regex pass, not a complete HTML sanitiser. It strips the
 * common script / event-handler / dangerous-URL vectors, which is adequate here
 * because only the authenticated author can submit content (so the worst case
 * is self-XSS). If post content ever becomes reachable by untrusted users,
 * replace this with a real allowlist sanitiser (sanitize-html / DOMPurify).
 */
export function sanitizeEditorHtml(input: string): string {
  return (
    input
      // Drop dangerous elements along with their contents.
      .replace(
        /<(script|style|iframe|object|embed|noscript)\b[\s\S]*?<\/\1\s*>/gi,
        "",
      )
      // Drop dangerous standalone/void elements (unclosed script, base, etc.).
      .replace(
        /<(script|style|iframe|object|embed|base|meta|link|form)\b[^>]*>/gi,
        "",
      )
      // Strip inline event handlers: double-quoted, single-quoted, unquoted.
      .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
      .replace(/\son\w+\s*=\s*'[^']*'/gi, "")
      .replace(/\son\w+\s*=\s*[^\s>]+/gi, "")
      // javascript:/vbscript: are never legitimate in any URL attribute.
      .replace(/\s(href|src)\s*=\s*"\s*(?:javascript|vbscript):[^"]*"/gi, ' $1="#"')
      .replace(/\s(href|src)\s*=\s*'\s*(?:javascript|vbscript):[^']*'/gi, " $1='#'")
      .replace(/\s(href|src)\s*=\s*(?:javascript|vbscript):[^\s>]*/gi, ' $1="#"')
      // data: as a navigation target (href) can carry text/html — block it
      // there. (data: in src is left alone so inline images still work.)
      .replace(/\shref\s*=\s*"\s*data:[^"]*"/gi, ' href="#"')
      .replace(/\shref\s*=\s*'\s*data:[^']*'/gi, " href='#'")
      .replace(/\shref\s*=\s*data:[^\s>]*/gi, ' href="#"')
  );
}
