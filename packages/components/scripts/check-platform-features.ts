/**
 * Platform-feature usage report + viewport-query guard for the Cinder
 * component library.
 *
 * Backs the policy in `src/_internal/PLATFORM-POLICY.md`. That document
 * classifies every modern CSS/HTML feature Cinder uses into a support tier
 * (use-directly / progressive-enhancement / avoid-for-core). This script makes
 * the current usage visible so a reviewer can confirm each feature is adopted
 * deliberately, and it guards the one mechanically detectable anti-pattern: a
 * viewport `@media (width)` query in component styles, which is almost always a
 * container constraint in disguise (a Tier-1 violation of the "container width,
 * not viewport width" rule).
 *
 * Two modes:
 *   - default: print the tiered inventory and list every viewport `@media`
 *     width query. Always exits 0 — a human-readable report.
 *   - `--strict`: compare the viewport-query sites against the checked-in
 *     baseline (`platform-viewport-baseline.json`). Exits non-zero only when a
 *     NEW site appears that the baseline does not grandfather, so the known set
 *     is allowed while regressions fail loudly. `validate` runs this mode, which
 *     is what makes wiring it into the gate meaningful (it distinguishes "the
 *     same known sites" from "a new one"). Pass `--update-baseline` to rewrite
 *     the baseline after an intentional change.
 *
 * Run via `bun run --filter=cinder platform:audit` (report) or
 * `platform:audit --strict` (gate; wired into `validate`).
 *
 * oxlint/stylelint cannot express this (cross-file inventory, the `@media` vs
 * `@container` distinction, and the grandfathered baseline), so a scanned report
 * with an explicit tier table is the simplest durable enforcement — mirroring
 * `check-no-cycle-imports.ts`.
 */

import { Glob } from 'bun';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const componentsRoot = resolve(scriptDirectory, '..');
const componentsSource = join(componentsRoot, 'src');
const baselinePath = join(scriptDirectory, 'platform-viewport-baseline.json');

/** A classified feature and the regex that detects its usage in source. */
export type FeatureProbe = {
  feature: string;
  tier: 1 | 2 | 3;
  pattern: RegExp;
  globs: string[];
};

/**
 * Mirrors the classification table in PLATFORM-POLICY.md. CSS features glob both
 * `.css` sidecars and `.svelte` files, since components author styles in both
 * standalone stylesheets and inline `<style>` blocks.
 */
const STYLE_GLOBS = ['**/*.css', '**/*.svelte'];
export const FEATURE_PROBES: FeatureProbe[] = [
  { feature: '@layer', tier: 1, pattern: /@layer\b/, globs: STYLE_GLOBS },
  { feature: ':has()', tier: 1, pattern: /:has\(/, globs: STYLE_GLOBS },
  {
    feature: 'container queries',
    tier: 1,
    pattern: /@container\b|container-type\s*:/,
    globs: STYLE_GLOBS,
  },
  { feature: '<dialog>', tier: 1, pattern: /<dialog\b/, globs: ['**/*.svelte'] },
  { feature: 'inert', tier: 1, pattern: /\binert\b/, globs: ['**/*.svelte', '**/*.ts'] },
  { feature: '@starting-style', tier: 1, pattern: /@starting-style\b/, globs: STYLE_GLOBS },
  { feature: 'text-wrap', tier: 1, pattern: /text-wrap\s*:/, globs: STYLE_GLOBS },
  { feature: 'accent-color', tier: 1, pattern: /accent-color\s*:/, globs: STYLE_GLOBS },
  { feature: 'content-visibility', tier: 2, pattern: /content-visibility\s*:/, globs: STYLE_GLOBS },
  { feature: 'subgrid', tier: 2, pattern: /\bsubgrid\b/, globs: STYLE_GLOBS },
  {
    feature: 'Popover API',
    tier: 2,
    pattern: /\bpopover=|showPopover\b|hidePopover\b/,
    globs: ['**/*.svelte', '**/*.ts'],
  },
  {
    feature: 'CSS Anchor Positioning',
    tier: 2,
    pattern: /anchor-name\s*:|position-anchor\s*:|\banchor\(/,
    globs: STYLE_GLOBS,
  },
  { feature: 'field-sizing', tier: 2, pattern: /field-sizing\s*:/, globs: STYLE_GLOBS },
  {
    feature: 'native validation pseudo-classes',
    tier: 2,
    pattern: /:user-invalid\b|:invalid\b/,
    globs: STYLE_GLOBS,
  },
];

/** Glob matchers precompiled once per probe (not per line). */
const PROBE_GLOB_MATCHERS: Glob[][] = FEATURE_PROBES.map((probe) =>
  probe.globs.map((pattern) => new Glob(pattern)),
);

/**
 * Detects a viewport `@media` query keyed on width in a `@media` prelude. Covers
 * both the legacy `min-width`/`max-width` features and CSS Media Queries Level 4
 * range syntax (`width >= 640px`, `640px <= width`, bounded ranges). Deliberately
 * scoped to a `@media` prelude so `@container (...)` width queries (the preferred
 * primitive) and plain `max-width:` sizing declarations are never matched.
 *
 * Applied to a comment-stripped, whitespace-collapsed `@media ... {` prelude — so
 * multi-line preludes and commented-out queries are handled by the caller, not
 * the regex.
 */
export const VIEWPORT_WIDTH_MEDIA =
  /@media\b[^{]*?(?:\b(?:min-width|max-width)\b|\bwidth\b\s*[<>]=?|[<>]=?\s*width\b)/;

export type FeatureCount = { feature: string; tier: 1 | 2 | 3; count: number };
export type Flag = { filePath: string; lineNumber: number; query: string };

/** Returns the probe indices whose pattern matches `line` for `relativePath`. */
export function matchedProbesForLine(relativePath: string, line: string): number[] {
  const matched: number[] = [];
  for (const [probeIndex, probe] of FEATURE_PROBES.entries()) {
    const matchers = PROBE_GLOB_MATCHERS[probeIndex];
    if (matchers && matchers.some((glob) => glob.match(relativePath)) && probe.pattern.test(line)) {
      matched.push(probeIndex);
    }
  }
  return matched;
}

/** Strips `/* … *​/` CSS comments (including multi-line) from a stylesheet body. */
export function stripCssComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ');
}

/**
 * Finds every viewport `@media(width)` query in a stylesheet body, buffering each
 * `@media` prelude up to its opening `{` so multi-line preludes are detected as a
 * whole. Comments are stripped first. Returns the 1-based line number where each
 * matched `@media` token starts, plus the collapsed prelude text.
 *
 * `rawSource` is the original text (used to map an offset back to a line number);
 * detection runs on the comment-stripped copy so offsets must come from it.
 */
export function findViewportMediaQueries(
  rawSource: string,
): Array<{ lineNumber: number; query: string }> {
  const stripped = stripCssComments(rawSource);
  const results: Array<{ lineNumber: number; query: string }> = [];
  const mediaPrelude = /@media\b[^{]*?\{/g;
  let match: RegExpExecArray | null;
  while ((match = mediaPrelude.exec(stripped)) !== null) {
    const prelude = match[0].slice(0, -1).replace(/\s+/g, ' ').trim();
    if (VIEWPORT_WIDTH_MEDIA.test(prelude)) {
      const lineNumber = stripped.slice(0, match.index).split('\n').length;
      results.push({ lineNumber, query: prelude });
    }
  }
  return results;
}

export async function scan(): Promise<{ counts: FeatureCount[]; viewportFlags: Flag[] }> {
  const counts: FeatureCount[] = FEATURE_PROBES.map((probe) => ({
    feature: probe.feature,
    tier: probe.tier,
    count: 0,
  }));
  const viewportFlags: Flag[] = [];

  const allFiles = new Glob('**/*.{css,svelte,ts}');
  for await (const relativePath of allFiles.scan({ cwd: componentsSource })) {
    const filePath = join(componentsSource, relativePath);
    const content = await Bun.file(filePath).text();

    for (const line of content.split('\n')) {
      for (const probeIndex of matchedProbesForLine(relativePath, line)) {
        const entry = counts[probeIndex];
        if (entry) entry.count += 1;
      }
    }

    if (relativePath.endsWith('.css') || relativePath.endsWith('.svelte')) {
      for (const hit of findViewportMediaQueries(content)) {
        viewportFlags.push({
          filePath: relative(componentsRoot, filePath),
          lineNumber: hit.lineNumber,
          query: hit.query,
        });
      }
    }
  }

  return { counts, viewportFlags };
}

/** A baseline entry grandfathers a known viewport-media site by file + query. */
type BaselineEntry = { filePath: string; query: string };

function flagKey(flag: { filePath: string; query: string }): string {
  return `${flag.filePath}::${flag.query}`;
}

function isBaselineEntry(value: unknown): value is BaselineEntry {
  if (typeof value !== 'object' || value === null) return false;
  return (
    'filePath' in value &&
    typeof value['filePath'] === 'string' &&
    'query' in value &&
    typeof value['query'] === 'string'
  );
}

async function readBaseline(): Promise<Set<string>> {
  const file = Bun.file(baselinePath);
  if (!(await file.exists())) return new Set();
  const parsed: unknown = await file.json();
  if (!Array.isArray(parsed)) {
    throw new Error(`${baselinePath} must contain a JSON array of {filePath, query} entries.`);
  }
  const keys = parsed.map((entry) => {
    if (!isBaselineEntry(entry)) {
      throw new Error(
        `${baselinePath} contains an invalid baseline entry: ${JSON.stringify(entry)}`,
      );
    }
    return flagKey(entry);
  });
  return new Set(keys);
}

function tierLabel(tier: 1 | 2 | 3): string {
  return tier === 1 ? 'use directly' : tier === 2 ? 'progressive enhancement' : 'avoid for core';
}

function renderInventory(counts: FeatureCount[]): string {
  let report =
    'platform:audit — modern feature inventory (see src/_internal/PLATFORM-POLICY.md)\n\n';
  for (const tier of [1, 2, 3] as const) {
    const tierCounts = counts.filter((entry) => entry.tier === tier);
    if (tierCounts.length === 0) continue;
    report += `  Tier ${tier} (${tierLabel(tier)}):\n`;
    for (const entry of tierCounts) {
      report += `    ${entry.feature.padEnd(34)} ${entry.count} usage${entry.count === 1 ? '' : 's'}\n`;
    }
    report += '\n';
  }
  return report;
}

async function main(): Promise<void> {
  const strict = process.argv.includes('--strict');
  const updateBaseline = process.argv.includes('--update-baseline');
  const { counts, viewportFlags } = await scan();

  if (updateBaseline) {
    const entries: BaselineEntry[] = viewportFlags
      .map((flag) => ({ filePath: flag.filePath, query: flag.query }))
      .toSorted((a, b) => flagKey(a).localeCompare(flagKey(b)));
    await Bun.write(baselinePath, JSON.stringify(entries, null, 2) + '\n');
    process.stdout.write(
      `platform:audit — wrote baseline with ${entries.length} viewport-media sites.\n`,
    );
    return;
  }

  process.stdout.write(renderInventory(counts));

  if (viewportFlags.length === 0) {
    process.stdout.write(
      '  Viewport @media(width) queries: none — every responsive component uses container queries.\n',
    );
    return;
  }

  const flagList = viewportFlags
    .map((flag) => `    ${flag.filePath}:${flag.lineNumber}\n      ${flag.query} { … }`)
    .join('\n');

  if (!strict) {
    process.stdout.write(
      `  Viewport @media(width) queries: ${viewportFlags.length} (see baseline for the grandfathered set)\n` +
        '  Each must be genuinely viewport-owned (app shell / drawer / modality switch).\n' +
        '  A component reacting to its OWN box width must use @container instead (RESPONSIVE-POLICY.md).\n\n' +
        flagList +
        '\n',
    );
    return;
  }

  // Strict mode: only NEW sites (not in the baseline) fail.
  const baseline = await readBaseline();
  const novel = viewportFlags.filter((flag) => !baseline.has(flagKey(flag)));
  if (novel.length === 0) {
    process.stdout.write(
      `  Viewport @media(width) queries: ${viewportFlags.length}, all grandfathered by the baseline. OK.\n`,
    );
    return;
  }

  process.stderr.write(
    `platform:audit — ${novel.length} NEW viewport @media(width) quer${novel.length === 1 ? 'y' : 'ies'} not in the baseline.\n` +
      '  A component reacting to its own box width must use @container, not a viewport @media (RESPONSIVE-POLICY.md).\n' +
      '  If this viewport query is genuinely viewport-owned, run `platform:audit --update-baseline` to grandfather it.\n\n' +
      novel
        .map((flag) => `    ${flag.filePath}:${flag.lineNumber}\n      ${flag.query} { … }`)
        .join('\n') +
      '\n',
  );
  process.exit(1);
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error('check-platform-features failed:', error);
    process.exit(1);
  });
}
