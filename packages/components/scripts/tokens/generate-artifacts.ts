/**
 * The `tokens:generate` CLI entry point.
 *
 * `generate.ts` owns `tokens-base.css` and the resolved-context JSON files
 * (Stage 4's artifacts) and stays a pure library with no CLI trigger of its
 * own -- it cannot import this package's token registry (`registry.ts`)
 * without creating an import cycle, because `registry.ts` itself reuses
 * `generate.ts`'s corpus-walking machinery (`collectEntries`, `loadCorpus`,
 * `CorpusEntry`). This file is the one place allowed to depend on BOTH: it
 * assembles every `tokens:generate` output --
 *
 *   - `tokens-base.css` and `src/tokens/resolved/*.json` (delegated to
 *     `generate.ts`'s `buildGeneratedOutputs`, unchanged from Stage 4)
 *   - `src/tokens/registry.generated.json` (Stage 5 deliverable 1 -- the
 *     machine-readable registry CIN-32/CIN-34 are blocked on, and the data
 *     CIN-31 imports `registry.ts`'s extraction to build a package-exported
 *     module from)
 *   - `docs/tokens.md`'s generated token tables, rewritten between
 *     `<!-- BEGIN/END GENERATED TOKEN TABLE -->` markers (Stage 5 deliverable
 *     2) -- hand-written prose outside the markers is preserved (Prettier
 *     reformats the spliced document as a whole, so that prose keeps its
 *     content and structure but not necessarily its exact bytes)
 *   - `packages/playground/src/shell-app/color-token-registry.generated.ts`
 *     (Stage 5 deliverable 3's data half; `color-token-registry.ts` stays
 *     hand-written and imports this). The data itself -- group membership,
 *     labels, member order -- is authored in the corpus, at the foundation
 *     set's `com.lostgradient.cinder.playgroundGroups` resolver extension
 *     (`cinder.resolver.json`), not in this script: the playground panel
 *     must carry no hand-maintained color-token list of its own, and a
 *     literal array in this file would just move that list's ADDRESS, not
 *     eliminate it. See {@link readPlaygroundColorTokenGroups}.
 *
 * -- and drives the shared `--check`/write contract `generate.ts`'s CSS/JSON
 * pair already established, now across every artifact at once.
 */

import { mkdir, readFile } from 'node:fs/promises';

import { format } from 'prettier';
import babelPlugin from 'prettier/plugins/babel';
import estreePlugin from 'prettier/plugins/estree';
import markdownPlugin from 'prettier/plugins/markdown';
import typescriptPlugin from 'prettier/plugins/typescript';

import {
  buildGeneratedOutputs,
  colorTokenRegistryGeneratedPath,
  type CorpusEntry,
  findDriftedPaths,
  JSON_PLUGINS,
  loadCorpus,
  PRETTIER_OPTIONS,
  readExisting,
  REGENERATE_COMMAND,
  registryJsonPath,
  resolvedDirectory,
  serializeEntryValue,
  tokensDocPath,
} from './generate.ts';
import {
  buildBaseDocuments,
  buildBaseIndex,
  buildTokenRegistryFromIndexes,
  serializeTokenRegistry,
  themeAwarePaths,
  type TokenRegistry,
} from './registry.ts';
import { createValueResolver, type ValueResolver } from './resolve.ts';
import type { ResolverDocument } from './types.ts';

const MARKDOWN_PLUGINS = [markdownPlugin];
const TYPESCRIPT_PLUGINS = [typescriptPlugin, estreePlugin, babelPlugin];

// ---------------------------------------------------------------------------
// docs/tokens.md -- generated token tables between BEGIN/END markers.
// ---------------------------------------------------------------------------

/**
 * The section-to-token curation the docs generator regenerates from. This is
 * docs/tokens.md's editorial structure (which cssProperties are documented
 * under which heading, and in what order) -- NOT derivable from corpus
 * `category`/`component` metadata alone, since the doc groups by reader
 * intent (e.g. "Status — solid" vs. "Status — semantic triples" are both
 * corpus `category: "color"`). Mirrors the established pattern of curating
 * membership in the generator itself (see `check-pipeline-coverage.ts`'s
 * `DECLARATION_TABLE`, `component-conventions.ts`'s checklist source of
 * truth): adding a token to the corpus requires a human decision about which
 * doc section it belongs under, so it is added here too. `validateDocSections`
 * (below) fails `tokens:generate` loudly if a corpus token is left out, listed
 * twice, or a section here has no matching marker in docs/tokens.md.
 */
export type DocSection = { slug: string; heading: string; cssProperties: readonly string[] };

const DOC_SECTIONS: readonly DocSection[] = [
  {
    slug: 'spacing',
    heading: 'Spacing',
    cssProperties: [
      '--cinder-space-0',
      '--cinder-space-0-5',
      '--cinder-space-1',
      '--cinder-space-1-5',
      '--cinder-space-2',
      '--cinder-space-2-5',
      '--cinder-space-3',
      '--cinder-space-3-5',
      '--cinder-space-4',
      '--cinder-space-5',
      '--cinder-space-6',
      '--cinder-space-7',
      '--cinder-space-8',
      '--cinder-space-10',
      '--cinder-space-12',
      '--cinder-space-16',
      '--cinder-space-20',
      '--cinder-space-24',
      '--cinder-space-32',
    ],
  },
  {
    slug: 'radii-and-shadows',
    heading: 'Radii and shadows',
    cssProperties: [
      '--cinder-radius-sm',
      '--cinder-radius-md',
      '--cinder-radius-lg',
      '--cinder-radius-full',
      '--cinder-shadow-sm',
      '--cinder-shadow-md',
      '--cinder-shadow-lg',
      '--cinder-shadow-overlay',
    ],
  },
  {
    slug: 'control-heights',
    heading: 'Control heights',
    cssProperties: [
      '--cinder-control-height-xs',
      '--cinder-control-height-sm',
      '--cinder-control-height-lg',
    ],
  },
  {
    slug: 'typography',
    heading: 'Typography',
    cssProperties: [
      '--cinder-font-sans',
      '--cinder-font-mono',
      '--cinder-text-2xs',
      '--cinder-text-xs',
      '--cinder-text-sm',
      '--cinder-text-base',
      '--cinder-text-md',
      '--cinder-text-lg',
      '--cinder-text-xl',
      '--cinder-text-2xl',
      '--cinder-text-3xl',
      '--cinder-text-4xl',
      '--cinder-text-5xl',
      '--cinder-leading-none',
      '--cinder-leading-tight',
      '--cinder-leading-snug',
      '--cinder-leading-normal',
      '--cinder-leading-relaxed',
      '--cinder-tracking-tight',
      '--cinder-tracking-normal',
      '--cinder-tracking-wide',
      '--cinder-font-normal',
      '--cinder-font-medium',
      '--cinder-font-semibold',
      '--cinder-font-bold',
      '--cinder-type-tab-size',
      '--cinder-touch-target-min',
    ],
  },
  {
    slug: 'layout',
    heading: 'Layout',
    cssProperties: [
      '--cinder-content-width',
      '--cinder-content-width-prose',
      '--cinder-content-width-narrow',
      '--cinder-content-width-wide',
    ],
  },
  {
    slug: 'motion',
    heading: 'Motion',
    cssProperties: [
      '--cinder-duration-instant',
      '--cinder-duration-fast',
      '--cinder-duration',
      '--cinder-duration-normal',
      '--cinder-duration-moderate',
      '--cinder-duration-slow',
      '--cinder-duration-spin',
      '--cinder-duration-progress-bar-indeterminate',
      '--cinder-duration-progress-ring-spin',
      '--cinder-ease-standard',
      '--cinder-ease-decelerate',
      '--cinder-ease-accelerate',
      '--cinder-ease-spring',
      '--cinder-ease-in-out',
    ],
  },
  {
    slug: 'surfaces',
    heading: 'Surfaces',
    cssProperties: [
      '--cinder-bg',
      '--cinder-surface',
      '--cinder-surface-raised',
      '--cinder-surface-inset',
      '--cinder-surface-hover',
      '--cinder-surface-pressed',
      '--cinder-surface-raised-hover',
      '--cinder-surface-raised-pressed',
      '--cinder-surface-upcoming-marker',
      '--cinder-surface-inverse',
      '--cinder-text-inverse',
      '--cinder-border-inverse',
    ],
  },
  {
    slug: 'text-colors',
    heading: 'Text colors',
    cssProperties: [
      '--cinder-text',
      '--cinder-text-muted',
      '--cinder-text-subtle',
      '--cinder-text-disabled',
      '--cinder-fill-disabled',
    ],
  },
  {
    slug: 'borders',
    heading: 'Borders',
    cssProperties: [
      '--cinder-border',
      '--cinder-border-faint',
      '--cinder-border-muted',
      '--cinder-border-strong',
      '--cinder-toggle-track-off-resting',
      '--cinder-toggle-track-off-hover-resting',
    ],
  },
  {
    slug: 'opacity',
    heading: 'Opacity',
    cssProperties: [
      '--cinder-opacity-disabled',
      '--cinder-opacity-muted',
      '--cinder-opacity-faint',
    ],
  },
  {
    slug: 'accent',
    heading: 'Accent',
    cssProperties: [
      '--cinder-accent',
      '--cinder-accent-contrast',
      '--cinder-accent-text',
      '--cinder-accent-text-hover',
      '--cinder-accent-hover',
      '--cinder-accent-active',
      '--cinder-accent-active-on-fill',
    ],
  },
  {
    slug: 'semantic-aliases',
    heading: 'Semantic aliases',
    cssProperties: [
      '--cinder-pad-control',
      '--cinder-pad-card',
      '--cinder-gap-stack',
      '--cinder-gap-inline',
      '--cinder-radius-control',
      '--cinder-radius-surface',
    ],
  },
  {
    slug: 'status-solid',
    heading: 'Status — solid',
    cssProperties: [
      '--cinder-info',
      '--cinder-success',
      '--cinder-warning',
      '--cinder-danger',
      '--cinder-danger-contrast',
      '--cinder-danger-hover',
      '--cinder-danger-active',
      '--cinder-info-hover',
      '--cinder-info-active',
      '--cinder-success-hover',
      '--cinder-success-active',
      '--cinder-warning-hover',
      '--cinder-warning-active',
      '--cinder-success-contrast',
      '--cinder-warning-contrast',
      '--cinder-info-contrast',
    ],
  },
  {
    slug: 'status-semantic-triples',
    heading: 'Status — semantic triples',
    cssProperties: [
      '--cinder-color-info-bg',
      '--cinder-color-info-fg',
      '--cinder-color-info-border',
      '--cinder-color-success-bg',
      '--cinder-color-success-fg',
      '--cinder-color-success-border',
      '--cinder-color-warning-bg',
      '--cinder-color-warning-fg',
      '--cinder-color-warning-border',
      '--cinder-color-danger-bg',
      '--cinder-color-danger-fg',
      '--cinder-color-danger-border',
      '--cinder-color-neutral-bg',
      '--cinder-color-neutral-fg',
      '--cinder-color-neutral-border',
      '--cinder-color-accent-bg',
      '--cinder-color-accent-fg',
      '--cinder-color-accent-border',
      '--cinder-color-info-muted',
      '--cinder-color-info-subtle',
      '--cinder-color-success-muted',
      '--cinder-color-success-subtle',
      '--cinder-color-warning-muted',
      '--cinder-color-warning-subtle',
      '--cinder-color-danger-muted',
      '--cinder-color-danger-subtle',
    ],
  },
  {
    slug: 'transparency-checkerboard',
    heading: 'Transparency checkerboard',
    cssProperties: ['--cinder-color-checker-base', '--cinder-color-checker-tile'],
  },
  {
    slug: 'chart-series',
    heading: 'Chart series',
    cssProperties: [
      '--cinder-chart-series-1',
      '--cinder-chart-series-2',
      '--cinder-chart-series-3',
      '--cinder-chart-series-4',
      '--cinder-chart-series-5',
      '--cinder-chart-series-6',
      '--cinder-chart-series-7',
      '--cinder-chart-series-8',
    ],
  },
  {
    slug: 'focus-ring',
    heading: 'Focus ring',
    cssProperties: [
      '--cinder-ring-width',
      '--cinder-ring-offset',
      '--cinder-ring-offset-color',
      '--cinder-ring-color',
      '--cinder-ring-on-accent',
    ],
  },
  {
    slug: 'z-index-layers',
    heading: 'Z-index layers',
    cssProperties: [
      '--cinder-z-tooltip',
      '--cinder-z-dropdown',
      '--cinder-z-popover',
      '--cinder-z-backdrop',
      '--cinder-z-modal',
      '--cinder-z-toast',
      '--cinder-z-focused-affordance',
      '--cinder-z-drag-preview',
    ],
  },
  {
    slug: 'overlay-surfaces',
    heading: 'Overlay surfaces',
    cssProperties: [
      '--cinder-overlay-backdrop',
      '--cinder-overlay-blur',
      '--cinder-overlay-padding',
      '--cinder-overlay-radius',
    ],
  },
  {
    slug: 'scrollbars',
    heading: 'Scrollbars',
    cssProperties: [
      '--cinder-scrollbar-size',
      '--cinder-scrollbar-track',
      '--cinder-scrollbar-thumb',
      '--cinder-scrollbar-thumb-hover',
    ],
  },
  {
    slug: 'button-base',
    heading: 'Button base',
    cssProperties: [
      '--cinder-button-bg',
      '--cinder-button-fg',
      '--cinder-button-border',
      '--cinder-button-radius',
    ],
  },
  {
    slug: 'button-size-xs',
    heading: 'Button size: xs',
    cssProperties: [
      '--cinder-button-padding-x-xs',
      '--cinder-button-padding-y-xs',
      '--cinder-button-height-xs',
      '--cinder-button-font-size-xs',
      '--cinder-button-radius-xs',
    ],
  },
  {
    slug: 'button-size-sm',
    heading: 'Button size: sm',
    cssProperties: [
      '--cinder-button-padding-x-sm',
      '--cinder-button-padding-y-sm',
      '--cinder-button-height-sm',
      '--cinder-button-font-size-sm',
      '--cinder-button-radius-sm',
    ],
  },
  {
    slug: 'button-size-md',
    heading: 'Button size: md',
    cssProperties: [
      '--cinder-button-padding-x-md',
      '--cinder-button-padding-y-md',
      '--cinder-button-height-md',
      '--cinder-button-font-size-md',
      '--cinder-button-radius-md',
    ],
  },
  {
    slug: 'button-size-lg',
    heading: 'Button size: lg',
    cssProperties: [
      '--cinder-button-padding-x-lg',
      '--cinder-button-padding-y-lg',
      '--cinder-button-height-lg',
      '--cinder-button-font-size-lg',
      '--cinder-button-radius-lg',
    ],
  },
  {
    slug: 'button-size-xl',
    heading: 'Button size: xl',
    cssProperties: [
      '--cinder-button-padding-x-xl',
      '--cinder-button-padding-y-xl',
      '--cinder-button-height-xl',
      '--cinder-button-font-size-xl',
      '--cinder-button-radius-xl',
    ],
  },
];

/**
 * `\r?\n` rather than `\n`: the repository has no `.gitattributes` pinning
 * `eol`, so a checkout with `core.autocrlf=true` gives `docs/tokens.md` CRLF
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
function validateDocSections(registry: TokenRegistry): void {
  const allCssProperties = DOC_SECTIONS.flatMap((section) => section.cssProperties);

  // Membership, not truthiness: `collectEntries` gives a document-level `$root`
  // token the path "" (a shape `resolve.test.ts` supports), and an empty string is
  // falsy, so a truthiness check would report a legitimately-present token absent.
  const unknown = allCssProperties.filter(
    (cssProperty) => !Object.hasOwn(registry.cssPropertyToPath, cssProperty),
  );
  if (unknown.length > 0) {
    throw new Error(
      `docs/tokens.md's DOC_SECTIONS (generate-artifacts.ts) references cssProperties that ` +
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
      `docs/tokens.md's DOC_SECTIONS lists these cssProperties in more than one section: ` +
        `${[...duplicates].join(', ')}.`,
    );
  }

  const missing = registry.entries
    .map((entry) => entry.cssProperty)
    .filter((cssProperty) => !seen.has(cssProperty));
  if (missing.length > 0) {
    throw new Error(
      `docs/tokens.md's DOC_SECTIONS (generate-artifacts.ts) is missing these corpus tokens: ` +
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

function toTableCell(text: string): string {
  return text
    .replaceAll(/\s*[\r\n]\s*/g, ' ')
    .trim()
    .replaceAll('|', '\\|');
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
    const value = serializeEntryValue(entry, baseIndex, resolveReferences);
    assertNoGeneratedMarkers(value, 'value', cssProperty);
    assertNoGeneratedMarkers(entry.description ?? '', 'description', cssProperty);
    const description = toTableCell(entry.description ?? '');
    // Escape pipes in the value as well as the description. GFM treats `|` as a
    // column delimiter even inside a backtick code span, so a token serializing to
    // a value containing one -- a fontFamily whose family name is `A|B` becomes the
    // valid CSS string 'A|B' -- would commit a structurally malformed row that the
    // drift parser still happily reads back.
    return `| ${toCodeSpan(cssProperty)} | ${toCodeSpan(toTableCell(value))} | ${description} |`;
  });
  const raw = `${header}${rows.join('\n')}\n`;
  return format(raw, { ...PRETTIER_OPTIONS, parser: 'markdown', plugins: MARKDOWN_PLUGINS });
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
        `Unexpected match with no index while scanning docs/tokens.md for generated-table markers.`,
      );
    }
    const end = start + match[0].length;
    const section = sectionsBySlug.get(slug);
    if (!section) {
      throw new Error(
        `docs/tokens.md has a generated-table marker for unknown section "${slug}". Add it to ` +
          'DOC_SECTIONS in generate-artifacts.ts, or fix the marker.',
      );
    }
    // A slug appearing twice would regenerate both blocks, listing every token
    // in that section twice -- and `tokens:generate -- --check` would then
    // stabilise on the doubled output and accept it forever.
    if (foundSlugs.has(slug)) {
      throw new Error(
        `docs/tokens.md has more than one generated-table marker for section "${slug}". ` +
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
      `docs/tokens.md is missing a generated-table marker for: ` +
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
  return format(rewritten, {
    ...PRETTIER_OPTIONS,
    parser: 'markdown',
    plugins: MARKDOWN_PLUGINS,
  });
}

// ---------------------------------------------------------------------------
// packages/playground/src/shell-app/color-token-registry.generated.ts
// ---------------------------------------------------------------------------

export type PlaygroundColorToken = { name: string; label: string };
export type PlaygroundColorTokenGroup = {
  id: string;
  label: string;
  tokens: readonly PlaygroundColorToken[];
};

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Reads the playground color panel's group membership and display labels
 * from the corpus itself: the foundation set's
 * `$extensions["com.lostgradient.cinder"].playgroundGroups` in
 * `cinder.resolver.json`. Like `DOC_SECTIONS` above, this is editorial
 * curation the corpus's `category` extension cannot express on its own (it
 * only distinguishes `color` from every other category, not "Accent" from
 * "Status Surfaces") -- but unlike `DOC_SECTIONS`, it is NOT hand-maintained
 * in this script: the playground panel must carry no hand-maintained
 * color-token list of its own, corpus-authored or not, and a literal array
 * here would only move that list's address, not eliminate it.
 * `INTENTIONALLY_UNREGISTERED_COLOR_TOKENS` in `color-token-registry.test.ts`
 * stays the separate, hand-maintained opt-out list for color tokens
 * deliberately NOT exposed here -- unrelated and unaffected by this move.
 *
 * Shape-validates the raw extension data (free-form per the DTCG resolver
 * schema, so nothing upstream checks it) before trusting it: every group
 * needs a string `id`/`label` and a `members` array, every member needs a
 * string `cssProperty`/`label`. {@link validatePlaygroundColorTokenGroups}
 * separately checks the referenced `cssProperty`s are real, current corpus
 * tokens.
 */
export function readPlaygroundColorTokenGroups(
  resolver: ResolverDocument,
): readonly PlaygroundColorTokenGroup[] {
  const foundationSet = resolver.sets['foundation'];
  const cinderExtensions = foundationSet?.$extensions?.['com.lostgradient.cinder'];
  const playgroundGroups = isPlainRecord(cinderExtensions)
    ? cinderExtensions['playgroundGroups']
    : undefined;
  if (!Array.isArray(playgroundGroups)) {
    throw new Error(
      'cinder.resolver.json\'s foundation set has no $extensions["com.lostgradient.cinder"]' +
        '.playgroundGroups array -- the playground color panel has nothing to generate from.',
    );
  }

  return playgroundGroups.map((rawGroup, groupIndex): PlaygroundColorTokenGroup => {
    if (
      !isPlainRecord(rawGroup) ||
      typeof rawGroup['id'] !== 'string' ||
      typeof rawGroup['label'] !== 'string' ||
      rawGroup['label'].trim() === '' ||
      // No whitespace in an id: color-token-panel.svelte interpolates it into
      // both `id="color-token-group-{id}"` and `aria-labelledby`, and
      // aria-labelledby parses whitespace as an ID-reference SEPARATOR -- so a
      // group id like "status solid" silently leaves the section unnamed to
      // assistive technology rather than failing visibly.
      /\s/.test(rawGroup['id']) ||
      rawGroup['id'].trim() === '' ||
      !Array.isArray(rawGroup['members'])
    ) {
      throw new Error(
        `cinder.resolver.json's playgroundGroups[${groupIndex}] must be ` +
          '{ id: string, label: string, members: array }.',
      );
    }
    const tokens = rawGroup['members'].map((rawMember, memberIndex): PlaygroundColorToken => {
      if (
        !isPlainRecord(rawMember) ||
        typeof rawMember['cssProperty'] !== 'string' ||
        typeof rawMember['label'] !== 'string' ||
        rawMember['label'].trim() === ''
      ) {
        throw new Error(
          `cinder.resolver.json's playgroundGroups[${groupIndex}].members[${memberIndex}] must be ` +
            '{ cssProperty: string, label: string }.',
        );
      }
      return { name: rawMember['cssProperty'], label: rawMember['label'] };
    });
    return { id: rawGroup['id'], label: rawGroup['label'], tokens };
  });
}

/**
 * Every `playgroundGroups` member's `cssProperty` must resolve to a real
 * corpus token, must not be listed twice, and must be a `category: "color"`
 * token -- protects the corpus-authored curation against a typo or a stale
 * reference left behind by a token rename or removal, AND against a
 * valid-but-wrong reference like `--cinder-space-4`: that cssProperty exists
 * in the corpus, so an existence-only check waves it through, the generated
 * color panel then offers a color picker for a spacing property, and
 * `applyColorTokenOverridesToDocument()` applies whatever the user picks
 * there via `style`.
 */
export function validatePlaygroundColorTokenGroups(
  groups: readonly PlaygroundColorTokenGroup[],
  registry: TokenRegistry,
): void {
  const entryByPath = new Map(registry.entries.map((entry) => [entry.path, entry]));
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  const unknown: string[] = [];
  const nonColor: string[] = [];
  for (const group of groups) {
    for (const token of group.tokens) {
      if (seen.has(token.name)) duplicates.add(token.name);
      seen.add(token.name);

      // Membership, not truthiness -- see validateDocSections: a document-level
      // `$root` colour token resolves to the empty-string path.
      if (!Object.hasOwn(registry.cssPropertyToPath, token.name)) {
        unknown.push(token.name);
        continue;
      }
      const path = registry.cssPropertyToPath[token.name]!;
      if (entryByPath.get(path)?.category !== 'color') nonColor.push(token.name);
    }
  }
  if (unknown.length > 0) {
    throw new Error(
      `cinder.resolver.json's playgroundGroups references cssProperties that are not in the ` +
        `corpus: ${unknown.join(', ')}.`,
    );
  }
  if (nonColor.length > 0) {
    throw new Error(
      `cinder.resolver.json's playgroundGroups references cssProperties that are not ` +
        `category: "color" tokens: ${nonColor.join(', ')}.`,
    );
  }
  if (duplicates.size > 0) {
    throw new Error(
      `cinder.resolver.json's playgroundGroups lists these cssProperties more than once: ` +
        `${[...duplicates].join(', ')}.`,
    );
  }
}

async function buildColorTokenRegistryModule(
  resolver: ResolverDocument,
  registry: TokenRegistry,
): Promise<string> {
  const groups = readPlaygroundColorTokenGroups(resolver);
  validatePlaygroundColorTokenGroups(groups, registry);
  const groupsLiteral = JSON.stringify(groups);
  const source = `/**
 * GENERATED FILE. Do not edit by hand.
 *
 * Source: packages/components/src/tokens/cinder.resolver.json (the
 * foundation set's com.lostgradient.cinder.playgroundGroups extension).
 * Regenerate: ${REGENERATE_COMMAND}
 */

export type ColorToken = {
  name: string;
  label: string;
};

export type ColorTokenGroup = {
  id: string;
  label: string;
  tokens: readonly ColorToken[];
};

export const COLOR_TOKEN_GROUPS = ${groupsLiteral} as const;
`;
  return format(source, { ...PRETTIER_OPTIONS, parser: 'typescript', plugins: TYPESCRIPT_PLUGINS });
}

// ---------------------------------------------------------------------------
// Entry point.
// ---------------------------------------------------------------------------

async function buildAllGeneratedOutputs(): Promise<Map<string, string>> {
  const cssAndResolved = await buildGeneratedOutputs();

  const { resolver, documentsByPath } = await loadCorpus();
  const baseIndex = buildBaseIndex(resolver, documentsByPath);
  const baseDocuments = buildBaseDocuments(resolver, documentsByPath);
  const baseResolveReferences = createValueResolver(baseDocuments);
  const registry = buildTokenRegistryFromIndexes(
    baseIndex,
    themeAwarePaths(resolver, documentsByPath),
  );

  validateDocSections(registry);

  const existingDocMarkdown = await readFile(tokensDocPath, 'utf8');
  const [docMarkdown, registryJson, colorTokenRegistryModule] = await Promise.all([
    buildTokensDocMarkdown(existingDocMarkdown, baseIndex, baseResolveReferences),
    format(serializeTokenRegistry(registry), {
      ...PRETTIER_OPTIONS,
      parser: 'json',
      plugins: JSON_PLUGINS,
    }),
    buildColorTokenRegistryModule(resolver, registry),
  ]);

  const generated = new Map(cssAndResolved);
  generated.set(registryJsonPath, registryJson);
  generated.set(tokensDocPath, docMarkdown);
  generated.set(colorTokenRegistryGeneratedPath, colorTokenRegistryModule);
  return generated;
}

async function main(): Promise<void> {
  const check = process.argv.includes('--check');
  const generated = await buildAllGeneratedOutputs();

  if (check) {
    const existing = await readExisting(generated.keys());
    const drifted = findDriftedPaths(generated, existing);
    if (drifted.length > 0) {
      throw new Error(
        `Generated token output drifted from the committed files:\n${drifted
          .map((path) => `  - ${path}`)
          .join('\n')}\nRun ${REGENERATE_COMMAND}.`,
      );
    }
    return;
  }

  await mkdir(resolvedDirectory, { recursive: true });
  for (const [path, content] of generated) await Bun.write(path, content);
}

if (import.meta.main) await main();
