/**
 * Inline a stylesheet's `@import` graph into a single self-contained sheet.
 *
 * ## Why this exists
 *
 * A `<link rel="stylesheet">` blocks first paint until the linked file is
 * fetched and parsed — but **only that file**. Sheets it pulls in with
 * `@import` are discovered afterwards and fetched asynchronously, so the browser
 * paints as soon as the top-level sheet is done.
 *
 * The playground shell's chrome was delivered that way:
 *
 * ```
 * /styles/shell.css                                  (level 1 — blocks paint)
 *   ├─ @import './index.css'                         (level 2 — does NOT)
 *   │    ├─ @import './tokens.css' layer(...)        (level 3 — does NOT)
 *   │    ├─ @import './foundation.css' layer(...)
 *   │    └─ @import './utilities.css' layer(...)     ← defines .cinder-sr-only
 *   └─ @import '../components/<name>/<name>.css' ×11
 * ```
 *
 * `shell.css` is 1 KB of almost nothing but `@import` statements, so it parses
 * instantly and the page paints with essentially no component CSS applied. The
 * visible symptom was that `.cinder-sr-only` had not loaded yet, so every
 * visually-hidden control label in the top bar — "Viewport width", "Preview
 * theme", "Color token panel", "Open preview in new tab", "Focus mode" — painted
 * as raw text next to an unstyled toolbar, then snapped into place once the
 * imports landed. Measured with imports delayed: `.cinder-sr-only` computed
 * `position: static` at 400 ms with the document already painted, and
 * `position: absolute` by 1200 ms.
 *
 * Flattening moves that CSS back behind the render-blocking request, which is
 * where it belongs: one round trip, correct on first paint.
 *
 * ## Cascade preservation
 *
 * `@import url layer(name)` is rewritten to `@layer name { … }`, which is the
 * exact equivalent. Unlayered imports are inlined bare so they keep beating
 * layered rules, matching their previous behaviour. Import order is preserved,
 * and because `@import` is only legal at the top of a sheet, inlining in place
 * cannot reorder anything relative to ordinary rules.
 */

/**
 * Matches a single `@import` statement, capturing the specifier and any
 * trailing conditions (`layer(...)`, media queries, `supports(...)`).
 *
 * Kept as a source string and compiled per use: a shared `/g` regex carries
 * `lastIndex` across calls.
 */
const IMPORT_STATEMENT_SOURCE = String.raw`@import\s+(?:url\(\s*)?["']?([^"')\s]+\.css)["']?\s*\)?\s*([^;]*);`;

/** Extracts the layer name from an import's trailing conditions. */
const LAYER_CONDITION = /\blayer\(\s*([^)]*?)\s*\)/;

/**
 * Resolve a relative CSS import specifier against the importing sheet's
 * root-relative URL.
 *
 * @param fromUrl - Root-relative URL of the sheet containing the import.
 * @param specifier - The import target, e.g. `./tokens.css` or `../a/b.css`.
 * @returns A root-relative URL, or `null` for a specifier we cannot resolve.
 */
export function resolveStylesheetImport(fromUrl: string, specifier: string): string | null {
  if (!specifier.startsWith('.')) return specifier.startsWith('/') ? specifier : null;

  const base = fromUrl.slice(0, fromUrl.lastIndexOf('/') + 1);
  const segments = `${base}${specifier}`.split('/');
  const resolved: string[] = [];
  for (const segment of segments) {
    if (segment === '.' || segment === '') continue;
    if (segment === '..') resolved.pop();
    else resolved.push(segment);
  }

  return `/${resolved.join('/')}`;
}

/** Loads a stylesheet by root-relative URL, or returns `null` when absent. */
export type StylesheetReader = (url: string) => Promise<string | null>;

/**
 * Recursively inline every `@import` in `entryUrl` into one stylesheet.
 *
 * A missing import is replaced with a comment rather than throwing: the sheet
 * still renders, and the build-time export separately verifies the graph. An
 * import cycle is broken the second time a URL is seen, matching how browsers
 * treat a already-imported sheet.
 *
 * @param entryUrl - Root-relative URL of the entry stylesheet.
 * @param read - Loader for stylesheet contents.
 * @returns The flattened CSS, containing no `@import` statements.
 */
export async function flattenStylesheet(entryUrl: string, read: StylesheetReader): Promise<string> {
  const visited = new Set<string>();

  async function inline(url: string): Promise<string> {
    if (visited.has(url)) return `/* cinder: ${url} already inlined */`;
    visited.add(url);

    const source = await read(url);
    if (source === null) return `/* cinder: ${url} not found */`;

    const importStatement = new RegExp(IMPORT_STATEMENT_SOURCE, 'g');
    const replacements: { start: number; end: number; text: string }[] = [];
    let match: RegExpExecArray | null;

    while ((match = importStatement.exec(source)) !== null) {
      const specifier = match[1]!;
      const conditions = match[2] ?? '';
      const target = resolveStylesheetImport(url, specifier);

      if (target === null) {
        replacements.push({ start: match.index, end: importStatement.lastIndex, text: '' });
        continue;
      }

      const inlined = await inline(target);
      const layerMatch = LAYER_CONDITION.exec(conditions);
      const text = layerMatch === null ? inlined : `@layer ${layerMatch[1]!} {\n${inlined}\n}`;

      replacements.push({ start: match.index, end: importStatement.lastIndex, text });
    }

    if (replacements.length === 0) return source;

    let output = '';
    let cursor = 0;
    for (const replacement of replacements) {
      output += source.slice(cursor, replacement.start) + replacement.text;
      cursor = replacement.end;
    }

    return output + source.slice(cursor);
  }

  return inline(entryUrl);
}
