/**
 * Strip inline sourcemap comments from server-rendered `<style>` output.
 *
 * `svelte/server`'s `render()` returns each component's scoped CSS with a
 * trailing `/*# sourceMappingURL=data:application/json;base64,… *\/` comment.
 * Those maps are a development aid, but they land inline in `<head>` on the
 * critical rendering path of every request: on the deployed playground they
 * measured 103 KB of a 204 KB document — 50.3% of the bytes the browser must
 * download and parse before first paint, for data no visitor can use.
 *
 * Stripping them is safe because the comment is inert CSS: removing it changes
 * no rule, no selector, and no cascade order.
 */

/**
 * A CSS sourcemap comment. The payload is a base64 data URI, so it cannot
 * itself contain `*` + `/`; matching lazily up to the first comment close is
 * therefore unambiguous. The `s` flag lets the payload span newlines.
 */
const INLINE_SOURCEMAP_COMMENT = /\/\*#\s*sourceMappingURL=data:[^*]*?\*\//gs;

/**
 * Remove every inline sourcemap comment from a fragment of CSS or from an HTML
 * fragment containing `<style>` tags. Returns the input unchanged when it holds
 * no sourcemap comment, so callers can apply it unconditionally.
 *
 * @param source - Server-rendered CSS or `<head>` HTML.
 * @returns The same markup with inline sourcemap comments removed.
 */
export function stripInlineSourcemaps(source: string): string {
  if (!source.includes('sourceMappingURL')) return source;
  return source.replace(INLINE_SOURCEMAP_COMMENT, '');
}
