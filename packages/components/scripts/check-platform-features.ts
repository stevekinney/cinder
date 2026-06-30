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
 * Run via `bun run --filter=@lostgradient/cinder platform:audit` (report) or
 * `platform:audit --strict` (gate; wired into `validate`).
 *
 * oxlint/stylelint cannot express this (cross-file inventory, the `@media` vs
 * `@container` distinction, and the grandfathered baseline), so a scanned report
 * with an explicit tier table is the simplest durable enforcement — mirroring
 * `check-no-cycle-imports.ts`.
 */

import { Glob } from 'bun';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_FILE_SCAN_CONCURRENCY, mapWithConcurrencyLimit } from './validation-utilities.ts';

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

/** Normalizes a path to forward slashes so baseline keys are OS-independent. */
export function toPosixPath(path: string): string {
  return path.replaceAll('\\', '/');
}

/** True for test/spec sources, which should not count toward the usage inventory. */
export function isTestPath(relativePath: string): boolean {
  return (
    /(?:^|\/)__tests__\//.test(relativePath) || /\.(?:test|spec)\.[cm]?tsx?$/.test(relativePath)
  );
}

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

/**
 * Strips `/* … *​/` CSS comments (including multi-line) from a stylesheet body,
 * preserving the newline count of each removed comment so line numbers computed
 * against the result still map to the original source.
 */
export function stripCssComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, (comment) => {
    const newlines = comment.match(/\n/g)?.length ?? 0;
    return ' ' + '\n'.repeat(newlines);
  });
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

  const allFiles = new Glob('**/*.{css,svelte,ts}');
  const relativePaths: string[] = [];
  for await (const relativePath of allFiles.scan({ cwd: componentsSource })) {
    // The inventory reflects real component usage, not test fixtures: a probe like
    // `inert` or `showPopover` matches strings/identifiers in test files and would
    // overstate adoption. Skip test/spec sources.
    if (!isTestPath(relativePath)) relativePaths.push(relativePath);
  }

  const scannedFiles = await mapWithConcurrencyLimit(
    relativePaths,
    DEFAULT_FILE_SCAN_CONCURRENCY,
    async (relativePath) => {
      const filePath = join(componentsSource, relativePath);
      const content = await Bun.file(filePath).text();
      const fileCounts = Array.from({ length: FEATURE_PROBES.length }, () => 0);
      const viewportFlags: Flag[] = [];

      for (const line of content.split('\n')) {
        for (const probeIndex of matchedProbesForLine(relativePath, line)) {
          fileCounts[probeIndex] = (fileCounts[probeIndex] ?? 0) + 1;
        }
      }

      if (relativePath.endsWith('.css') || relativePath.endsWith('.svelte')) {
        for (const hit of findViewportMediaQueries(content)) {
          viewportFlags.push({
            // Build the key from the POSIX-style scan path (Glob yields forward
            // slashes on every OS) so baseline keys are stable across platforms —
            // path.relative() would emit backslashes on Windows and break the gate.
            filePath: `src/${toPosixPath(relativePath)}`,
            lineNumber: hit.lineNumber,
            query: hit.query,
          });
        }
      }

      return { fileCounts, viewportFlags };
    },
  );

  const viewportFlags: Flag[] = [];
  for (const scannedFile of scannedFiles) {
    for (let probeIndex = 0; probeIndex < scannedFile.fileCounts.length; probeIndex++) {
      const entry = counts[probeIndex];
      if (entry) entry.count += scannedFile.fileCounts[probeIndex] ?? 0;
    }
    viewportFlags.push(...scannedFile.viewportFlags);
  }

  return { counts, viewportFlags };
}

/**
 * A baseline entry grandfathers a known viewport-media site by file + normalized
 * query, with the allowed occurrence count. Identity is intentionally count-based
 * rather than line-based: line numbers drift on every unrelated edit above a style
 * block (brittle), and two physically separate but identical `@media` blocks in
 * one file are not distinguishable without coordinates. Counting the
 * `{ filePath, query }` pair lets the gate stay stable across unrelated edits while
 * still failing when a NEW occurrence is added (currentCount > allowedCount).
 */
export type BaselineEntry = { filePath: string; query: string; allowedCount: number };

/** The identity key for a viewport-media site: file + normalized prelude text. */
export function flagKey(flag: { filePath: string; query: string }): string {
  return `${flag.filePath}::${flag.query}`;
}

/** Counts how many times each `flagKey` occurs across the flags. */
export function countByKey(flags: Array<{ filePath: string; query: string }>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const flag of flags) {
    counts.set(flagKey(flag), (counts.get(flagKey(flag)) ?? 0) + 1);
  }
  return counts;
}

function isBaselineEntry(value: unknown): value is BaselineEntry {
  if (typeof value !== 'object' || value === null) return false;
  return (
    'filePath' in value &&
    typeof value['filePath'] === 'string' &&
    'query' in value &&
    typeof value['query'] === 'string' &&
    'allowedCount' in value &&
    typeof value['allowedCount'] === 'number'
  );
}

/**
 * Parses already-loaded baseline JSON into a `flagKey` → allowed-count map.
 * Pure (no filesystem) so all three branches are unit-testable. Throws on a
 * non-array or a malformed entry so a corrupt baseline fails loudly rather than
 * silently disabling the gate.
 */
export function parseBaseline(parsed: unknown): Map<string, number> {
  if (!Array.isArray(parsed)) {
    throw new Error('baseline must be a JSON array of {filePath, query, allowedCount} entries.');
  }
  const allowed = new Map<string, number>();
  for (const entry of parsed) {
    if (!isBaselineEntry(entry)) {
      throw new Error(`invalid baseline entry: ${JSON.stringify(entry)}`);
    }
    allowed.set(flagKey(entry), entry.allowedCount);
  }
  return allowed;
}

/** Reads the baseline file as a map of `flagKey` → allowed occurrence count. */
export async function readBaseline(): Promise<Map<string, number>> {
  const file = Bun.file(baselinePath);
  if (!(await file.exists())) return new Map();
  return parseBaseline(await file.json());
}

/** Builds the sorted, deduplicated baseline entries (one per key, with count). */
export function buildBaselineEntries(
  flags: Array<{ filePath: string; query: string }>,
): BaselineEntry[] {
  const counts = countByKey(flags);
  const byKey = new Map<string, BaselineEntry>();
  for (const flag of flags) {
    const key = flagKey(flag);
    if (!byKey.has(key)) {
      byKey.set(key, {
        filePath: flag.filePath,
        query: flag.query,
        allowedCount: counts.get(key)!,
      });
    }
  }
  return [...byKey.values()].toSorted((a, b) => flagKey(a).localeCompare(flagKey(b)));
}

/** A site that exceeds its grandfathered count (or is entirely new). */
export type Regression = { filePath: string; query: string; allowed: number; found: number };

/** Returns viewport sites whose current count exceeds the baseline's allowed count. */
export function findRegressions(
  flags: Array<{ filePath: string; query: string }>,
  allowed: Map<string, number>,
): Regression[] {
  const found = countByKey(flags);
  const regressions: Regression[] = [];
  for (const [key, foundCount] of found) {
    const allowedCount = allowed.get(key) ?? 0;
    if (foundCount > allowedCount) {
      const [filePath, query] = key.split('::');
      regressions.push({
        filePath: filePath!,
        query: query!,
        allowed: allowedCount,
        found: foundCount,
      });
    }
  }
  return regressions.toSorted((a, b) => flagKey(a).localeCompare(flagKey(b)));
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
    const entries = buildBaselineEntries(viewportFlags);
    await Bun.write(baselinePath, JSON.stringify(entries, null, 2) + '\n');
    const total = entries.reduce((sum, entry) => sum + entry.allowedCount, 0);
    process.stdout.write(
      `platform:audit — wrote baseline: ${entries.length} unique site${entries.length === 1 ? '' : 's'} (${total} occurrences).\n`,
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

  // Strict mode: fail only when a site's current count exceeds its grandfathered
  // allowance (a genuinely NEW viewport query), not for the known set.
  const baseline = await readBaseline();
  const regressions = findRegressions(viewportFlags, baseline);
  if (regressions.length === 0) {
    process.stdout.write(
      `  Viewport @media(width) queries: ${viewportFlags.length}, all grandfathered by the baseline. OK.\n`,
    );
    return;
  }

  process.stderr.write(
    `platform:audit — ${regressions.length} viewport @media(width) site${regressions.length === 1 ? '' : 's'} exceed the baseline.\n` +
      '  A component reacting to its own box width must use @container, not a viewport @media (RESPONSIVE-POLICY.md).\n' +
      '  If this viewport query is genuinely viewport-owned, run `platform:audit --update-baseline` to grandfather it.\n\n' +
      regressions
        .map(
          (reg) =>
            `    ${reg.filePath}\n      ${reg.query} { … }  (allowed ${reg.allowed}, found ${reg.found})`,
        )
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
