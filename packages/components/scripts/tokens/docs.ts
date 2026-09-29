import { format } from 'prettier';
import markdownPlugin from 'prettier/plugins/markdown';
import { assertPrettierResolvesToRoot } from '../lib/prettier-resolution.ts';

import { type CorpusEntry } from './corpus.ts';
import { DOC_SECTIONS, type DocSection } from './docs-sections.ts';
import { PRETTIER_OPTIONS } from './generator-configuration.ts';
import type { TokenRegistry } from './registry.ts';
import type { ValueResolver } from './resolve.ts';
import { serializeEntryValue } from './value-entry.ts';

const MARKDOWN_PLUGINS = [markdownPlugin];
// The root `.prettierrc` overrides `*.md` with `proseWrap: 'never'`. Without the
// same override here, a table wider than `printWidth` is column-aligned by the
// generator but left compact by `format:check`, so `tokens:check` and
// `format:check` cannot both pass on the committed `tokens.md`.
const MARKDOWN_OPTIONS = {
  ...PRETTIER_OPTIONS,
  proseWrap: 'never',
  parser: 'markdown',
  plugins: MARKDOWN_PLUGINS,
} as const;

/**
 * `\r?\n` rather than `\n`: the repository has no `.gitattributes` pinning
 * `eol`, so a checkout with `core.autocrlf=true` gives `documentation/tokens.md` CRLF
 * endings. Matching only `\n` would then find no blocks at all and the
 * generator would report every marker missing while every marker is present.
 */
export const DOC_MARKER_PATTERN =
  /<!-- BEGIN GENERATED TOKEN TABLE: ([a-z0-9-]+) -->\r?\n[\s\S]*?<!-- END GENERATED TOKEN TABLE -->/g;

/**
 * The literal marker text `buildTokensDocMarkdown` splices on. Corpus strings
 * are interpolated into the generated block, so a description or value
 * containing one of these would be written inside the table and then read back
 * as the block's own delimiter on the next scan: the rewrite would terminate at
 * the injected text, leave the real remainder stranded, and `tokens:generate
 * -- --check` could never stabilize -- a self-inflicted, permanent failure of a
 * required gate.
 *
 * This is rejected rather than escaped on purpose. Neutralizing the text would
 * change how a cell is represented, which under this file's own rule means the
 * drift parser has to change with it; and there is no representation that both
 * hides the marker from this regex and still renders inside a code span, where
 * HTML entities are not decoded. Refusing to emit a document that cannot be
 * regenerated stably is the honest boundary.
 */
const GENERATED_MARKER_FRAGMENTS = [
  '<!-- BEGIN GENERATED TOKEN TABLE',
  '<!-- END GENERATED TOKEN TABLE',
] as const;

/**
 * Checked against the NORMALIZED cell, not the raw source string. `toTableCell`
 * collapses interior line breaks to single spaces, so normalization can
 * SYNTHESIZE a marker that the raw text does not contain -- a description
 * carrying `<!-- END\nGENERATED TOKEN TABLE -->` passes a raw scan and then
 * collapses into the exact closing marker.
 */
function assertNoGeneratedMarkers(text: string, field: string, cssProperty: string): void {
  for (const fragment of GENERATED_MARKER_FRAGMENTS) {
    if (text.includes(fragment)) {
      throw new Error(
        `The ${field} for "${cssProperty}" contains the generated-table marker ` +
          `"${fragment}", which would terminate the block it is written into. ` +
          `Remove the marker text from the token source.`,
      );
    }
  }
}

/**
 * Every `DOC_SECTIONS` cssProperty must resolve to a real corpus token, must
 * not be listed twice, and every registry token must appear in EXACTLY one
 * section -- the same "documents exactly the tokens declared" completeness
 * guarantee `tokens-doc-drift.test.ts` enforced against `tokens-base.css`
 * before this stage, now enforced at generate time against the registry.
 */
export function validateDocSections(registry: TokenRegistry): void {
  const allCssProperties = DOC_SECTIONS.flatMap((section) => section.cssProperties);

  // Membership, not truthiness: `collectEntries` gives a document-level `$root`
  // token the path "" (a shape `resolve.test.ts` supports), and an empty string is
  // falsy, so a truthiness check would report a legitimately-present token absent.
  const unknown = allCssProperties.filter(
    (cssProperty) => !Object.hasOwn(registry.cssPropertyToPath, cssProperty),
  );
  if (unknown.length > 0) {
    throw new Error(
      `documentation/tokens.md's DOC_SECTIONS (docs.ts) references cssProperties that ` +
        `are not in the corpus: ${unknown.join(', ')}.`,
    );
  }

  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const cssProperty of allCssProperties) {
    if (seen.has(cssProperty)) duplicates.add(cssProperty);
    seen.add(cssProperty);
  }
  if (duplicates.size > 0) {
    throw new Error(
      `documentation/tokens.md's DOC_SECTIONS lists these cssProperties in more than one section: ` +
        `${[...duplicates].join(', ')}.`,
    );
  }

  const missing = registry.entries
    .map((entry) => entry.cssProperty)
    .filter((cssProperty) => !seen.has(cssProperty));
  if (missing.length > 0) {
    throw new Error(
      `documentation/tokens.md's DOC_SECTIONS (docs.ts) is missing these corpus tokens: ` +
        `${missing.join(', ')}. Add each to a section, or a new one, so it is documented.`,
    );
  }
}

/**
 * Makes ANY string safe to sit inside one Markdown table cell.
 *
 * Deliberately ONE function used for every cell rather than per-column
 * handling. Descriptions and values were sanitized by two parallel code paths,
 * and each hazard was fixed on one path while the other kept it: newline
 * normalization landed on descriptions only, then pipe escaping landed on
 * descriptions before values, then value pipes were escaped without teaching
 * the drift parser to decode them. Routing every cell through one function is
 * what stops the next hazard from being fixed in only half the places.
 *
 * A line break terminates the row, and GFM reads `|` as a column delimiter even
 * inside a backtick code span, so both must go.
 */
function toCodeSpan(content: string): string {
  // CommonMark: a code span's delimiter must be a backtick run longer than any
  // run inside it, and the content needs one space of padding when it starts or
  // ends with a backtick. Hard-coding a single backtick would let a value
  // containing one close the span early, producing malformed Markdown that the
  // drift parser then reads back truncated.
  const longestRun = [...content.matchAll(/`+/g)].reduce(
    (longest, match) => Math.max(longest, match[0].length),
    0,
  );
  const fence = '`'.repeat(longestRun + 1);
  const padding = content.startsWith('`') || content.endsWith('`') ? ' ' : '';
  return `${fence}${padding}${content}${padding}${fence}`;
}

/**
 * Escapes a `|` in a cell body so GFM always reads it as a literal pipe, never a
 * column delimiter -- WITHOUT double-escaping a value that already contains a
 * `\|` (a value that, taken alone, is itself a legally-escaped pipe).
 *
 * Unconditionally appending a backslash (`.replaceAll('|', '\\|')`, this
 * function's predecessor) turns an already-escaped `foo\|bar` into
 * `foo\\|bar`: GFM's left-to-right backslash pairing reads the two leading
 * backslashes as one escaped backslash, leaving the `|` unescaped after all --
 * a malformed row (see this file's git history for the CIN-470 fix, and
 * `tokens-doc-drift.test.ts`'s `extractDocTokens`, which decodes the inverse
 * of exactly this).
 *
 * Naively conditioning on "escape only when the existing run is already odd"
 * is not the fix: `foo|bar` (0 backslashes) and `foo\|bar` (1 backslash) would
 * both then encode to the identical cell text `foo\|bar`, which no decoder can
 * un-collapse back to two different originals -- and `tokens-doc-drift.test.ts`
 * must decode ANY corpus value back to itself, not just the ones the corpus
 * happens to contain today. So the run of backslashes immediately preceding
 * each `|` is DOUBLED first (protecting every backslash that was already
 * there, the same way any backslash-escaping scheme must protect its own
 * escape character) and only THEN is the escaping backslash for the pipe
 * itself appended -- a run of length `k` becomes `2k + 1`, always odd (GFM
 * escaped), and losslessly invertible: `extractDocTokens` recovers `k` as
 * `(2k + 1 - 1) / 2`.
 */
function normalizeTableCell(text: string): string {
  return text.replaceAll(/\s*[\r\n]\s*/g, ' ').trim();
}

function toTableCell(text: string): string {
  return normalizeTableCell(text).replace(
    /(\\*)\|/g,
    (_match, backslashes: string) => `${backslashes}${backslashes}\\|`,
  );
}

function escapeHtml(text: string): string {
  const namedEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '|': '&#x7c;',
    '*': '&#42;',
    _: '&#95;',
    '~': '&#126;',
  };
  return text.replace(/[&<>"'|*_~]/g, (character) => {
    const namedEntity = namedEntities[character];
    return namedEntity ?? `&#${character.codePointAt(0)};`;
  });
}

function renderValueCell(value: string): string {
  // Backslash-escaped pipes cannot be displayed faithfully inside a Markdown
  // code span, and character references are not decoded inside code spans.
  // An HTML code element keeps the table delimiter inert while the renderer
  // decodes entities back to the exact literal value.
  if (value.includes('|')) return `<code>${escapeHtml(value)}</code>`;
  return toCodeSpan(value);
}

export async function renderDocTable(
  section: DocSection,
  baseIndex: Map<string, CorpusEntry>,
  resolveReferences: ValueResolver,
): Promise<string> {
  const header = '| Token | Default | Description |\n| --- | --- | --- |\n';
  // Index once rather than rescanning every corpus entry per row. `set` keeps the
  // FIRST claimant, matching registry.ts's canonical-path rule, so `$extends`
  // duplicates resolve identically here and in the registry.
  const entryByCssProperty = new Map<string, CorpusEntry>();
  for (const candidate of baseIndex.values()) {
    if (candidate.cssProperty && !entryByCssProperty.has(candidate.cssProperty)) {
      entryByCssProperty.set(candidate.cssProperty, candidate);
    }
  }
  const rows = section.cssProperties.map((cssProperty) => {
    const entry = entryByCssProperty.get(cssProperty);
    if (!entry) {
      throw new Error(
        `No base corpus entry has cssProperty "${cssProperty}" (section "${section.slug}").`,
      );
    }
    const value = renderValueCell(
      normalizeTableCell(serializeEntryValue(entry, baseIndex, resolveReferences)),
    );
    const description = toTableCell(entry.description ?? '');
    assertNoGeneratedMarkers(value, 'value', cssProperty);
    assertNoGeneratedMarkers(description, 'description', cssProperty);
    // Escape pipes in the value as well as the description. GFM treats `|` as a
    // column delimiter even inside a backtick code span, so a token serializing to
    // a value containing one -- a fontFamily whose family name is `A|B` becomes the
    // valid CSS string 'A|B' -- would commit a structurally malformed row that the
    // drift parser still happily reads back.
    return `| ${toCodeSpan(cssProperty)} | ${value} | ${description} |`;
  });
  const raw = `${header}${rows.join('\n')}\n`;
  assertPrettierResolvesToRoot();
  return format(raw, MARKDOWN_OPTIONS);
}

/**
 * The trail of ATX headings enclosing `offset`, outermost first: the nearest
 * heading, then the nearest heading above it of a shallower level, and so on.
 * Empty when the marker sits before any heading.
 *
 * Walking backwards and keeping only strictly-shallower levels is what makes
 * this the ENCLOSING trail rather than a list of everything above -- a sibling
 * `### Size: sm` earlier in the document does not enclose `### Size: md`.
 */
function enclosingHeadings(markdown: string, offset: number): string[] {
  const before = markdown.slice(0, offset);
  const headings = [...before.matchAll(/^(#{1,6})[ \t]+(.+?)[ \t]*#*[ \t]*$/gm)];
  const trail: string[] = [];
  let level = Number.POSITIVE_INFINITY;
  for (let index = headings.length - 1; index >= 0; index -= 1) {
    const match = headings[index];
    const hashes = match?.[1];
    const text = match?.[2];
    if (hashes === undefined || text === undefined) continue;
    if (hashes.length < level) {
      trail.unshift(`${hashes} ${text.trim()}`);
      level = hashes.length;
    }
  }
  // The document title encloses everything, so declaring it in all 26 sections
  // would be noise. Dropping exactly one leading `#` heading keeps the
  // comparison anchored rather than a suffix match: a demoted section gains an
  // ancestor and no longer matches, which a suffix match would have accepted.
  return trail[0]?.startsWith('# ') ? trail.slice(1) : trail;
}

/**
 * Rewrites every `<!-- BEGIN/END GENERATED TOKEN TABLE -->` block in
 * `existingMarkdown` in place. Content outside those markers -- headings,
 * prose, callouts -- is preserved but NOT byte-identical: the spliced document
 * is handed to Prettier as a whole, which is what keeps `tokens:generate
 * -- --check` stable against the commit hook's own formatting pass, and which
 * can also normalize whitespace in the surrounding prose. Fails loudly (rather than
 * silently skipping) when a marker names a section `DOC_SECTIONS` does not
 * know, or when a `DOC_SECTIONS` entry has no matching marker in the file, so
 * a heading/marker edit and this generator's curation can never silently
 * drift apart.
 */
export async function buildTokensDocMarkdown(
  existingMarkdown: string,
  baseIndex: Map<string, CorpusEntry>,
  resolveReferences: ValueResolver,
): Promise<string> {
  const sectionsBySlug = new Map(DOC_SECTIONS.map((section) => [section.slug, section]));
  const foundSlugs = new Set<string>();
  const matches = [...existingMarkdown.matchAll(DOC_MARKER_PATTERN)];

  let rewritten = '';
  let cursor = 0;
  for (const match of matches) {
    const slug = match[1];
    if (slug === undefined) continue;
    const start = match.index;
    // `RegExpMatchArray.index` is typed `number | undefined` because the type
    // covers `String.prototype.match` with a non-global pattern (which can
    // return `null` overall, but TypeScript still carries the optional
    // modifier through this shared array type). Every match here comes from
    // `matchAll`, which always sets `index` -- but that guarantee lives in
    // the DOM/ECMAScript spec, not in this array's type, so a bare `!`
    // would assert past a real (if here unreachable) code path instead of
    // documenting why it can't happen.
    if (start === undefined) {
      throw new Error(
        `Unexpected match with no index while scanning documentation/tokens.md for generated-table markers.`,
      );
    }
    const end = start + match[0].length;
    const section = sectionsBySlug.get(slug);
    if (!section) {
      throw new Error(
        `documentation/tokens.md has a generated-table marker for unknown section "${slug}". Add it to ` +
          'DOC_SECTIONS in docs-sections.ts, or fix the marker.',
      );
    }
    // `DocSection.headings` was declared for every section and read by nothing,
    // so it documented a guarantee nothing enforced. Moving a marker under a
    // different heading, or renaming that heading, left the generator happily
    // rewriting the spacing table under "Typography": the slug still matched,
    // `tokens:generate -- --check` stabilised on the misplaced output, and the
    // drift test compares tokens globally rather than per section, so nothing
    // anywhere noticed.
    //
    // Compared for EQUALITY against the full trail below the document title,
    // hashes included. A suffix match over label-only entries accepted a
    // demoted section, and a leaf-only match accepted a nested pair moved under
    // another parent.
    const trail = enclosingHeadings(existingMarkdown, start);
    const trailMatchesDeclaration =
      trail.length === section.headings.length &&
      section.headings.every((heading, index) => trail[index] === heading);
    if (!trailMatchesDeclaration) {
      throw new Error(
        `documentation/tokens.md has the "${slug}" generated-table marker under headings ` +
          `${trail.length === 0 ? '(none)' : trail.map((h) => `"${h}"`).join(' > ')}, but ` +
          `DOC_SECTIONS declares it belongs under ` +
          `${section.headings.map((h) => `"${h}"`).join(' > ')}. Move the marker back, or ` +
          'update the section headings in docs.ts.',
      );
    }

    // A slug appearing twice would regenerate both blocks, listing every token
    // in that section twice -- and `tokens:generate -- --check` would then
    // stabilise on the doubled output and accept it forever.
    if (foundSlugs.has(slug)) {
      throw new Error(
        `documentation/tokens.md has more than one generated-table marker for section "${slug}". ` +
          'Each section must appear exactly once.',
      );
    }
    foundSlugs.add(slug);
    const table = await renderDocTable(section, baseIndex, resolveReferences);
    rewritten += existingMarkdown.slice(cursor, start);
    rewritten += `<!-- BEGIN GENERATED TOKEN TABLE: ${slug} -->\n${table}<!-- END GENERATED TOKEN TABLE -->`;
    cursor = end;
  }
  rewritten += existingMarkdown.slice(cursor);

  const missingMarkers = DOC_SECTIONS.filter((section) => !foundSlugs.has(section.slug));
  if (missingMarkers.length > 0) {
    throw new Error(
      `documentation/tokens.md is missing a generated-table marker for: ` +
        `${missingMarkers.map((section) => section.slug).join(', ')}.`,
    );
  }

  // Format the SPLICED document, not just each table. Tables are formatted in
  // isolation above, but prettier's markdown printer also normalises the
  // surrounding document -- it puts a blank line either side of an HTML
  // comment node, which the splice above does not. Without this pass the
  // committed file and the generator's output can never agree: lint-staged
  // reformats on commit, `tokens:generate -- --check` regenerates without
  // that formatting, and CI reports drift on a file nobody edited.
  assertPrettierResolvesToRoot();
  return format(rewritten, MARKDOWN_OPTIONS);
}
