/**
 * Serialises a schema.org object for embedding in an inline
 * `<script type="application/ld+json">` block.
 *
 * Escapes `<` as `\u003c` so a literal `</script>` inside author-authored
 * strings (post titles, excerpts, book copy) can't break out of the script
 * element or corrupt the JSON-LD. Also escapes the U+2028 / U+2029 line and
 * paragraph separators, which are legal in JSON but illegal inside an inline
 * script and throw a parser error. All escapes round-trip back to the original
 * characters for any JSON-LD consumer, so structured-data validity is preserved.
 */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data)
    .replace(/\u003c/g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
