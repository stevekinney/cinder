/**
 * Turn a kebab-case component name into a human-readable display label.
 *
 * Extracted into its own module (no Svelte, no DOM) so the title-casing and
 * acronym rules are exhaustively unit-testable from `bun:test` without paying
 * the `.svelte` compilation cost. The sidebar renders the humanized label for
 * readability while keeping the raw kebab name for routing, hrefs, and
 * selection callbacks.
 */

/**
 * Words that should render in a fixed casing rather than naive title-case.
 * Keys are the lowercase token as it appears in a kebab name; values are the
 * canonical display form. Acronyms render fully uppercase; the rest preserve a
 * conventional brand/casing spelling.
 */
const ACRONYM_MAP: Readonly<Record<string, string>> = {
  json: 'JSON',
  api: 'API',
  css: 'CSS',
  url: 'URL',
  html: 'HTML',
  ssr: 'SSR',
  dom: 'DOM',
};

/**
 * Title-case a single token, applying the acronym map first. Empty tokens
 * (which can appear from leading/trailing/doubled hyphens) pass through
 * unchanged so the caller can filter them out.
 */
function humanizeToken(token: string): string {
  if (token === '') return token;
  const lower = token.toLowerCase();
  const acronym = ACRONYM_MAP[lower];
  if (acronym !== undefined) return acronym;
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/**
 * Convert a kebab-case component name into a title-cased display label.
 *
 * Splits on hyphens, title-cases each word, and substitutes known acronyms
 * (JSON, API, CSS, URL, HTML, SSR, DOM) with their canonical uppercase form.
 * Empty segments from leading, trailing, or doubled hyphens are dropped, and
 * surrounding whitespace is trimmed.
 *
 * @example
 * humanizeComponentName('json-schema-editor'); // 'JSON Schema Editor'
 * humanizeComponentName('tag-input');          // 'Tag Input'
 * humanizeComponentName('button');             // 'Button'
 */
export function humanizeComponentName(name: string): string {
  return name
    .trim()
    .split('-')
    .map(humanizeToken)
    .filter((token) => token !== '')
    .join(' ');
}
