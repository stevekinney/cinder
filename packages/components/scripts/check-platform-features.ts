/**
 * Platform-feature usage report for the Cinder component library.
 *
 * Backs the policy in `src/_internal/PLATFORM-POLICY.md`. That document
 * classifies every modern CSS/HTML feature Cinder uses into a support tier
 * (use-directly / progressive-enhancement / avoid-for-core). This script makes
 * the current usage visible so a reviewer can confirm each feature is adopted
 * deliberately rather than by accident, and it flags the one mechanically
 * detectable anti-pattern: a viewport `@media (width)` query in component CSS,
 * which is almost always a container constraint in disguise (a Tier-1 violation
 * of the "container width, not viewport width" rule).
 *
 * This is a REPORT, not a hard gate. Deliberate adoption is the goal, so the
 * command surfaces an inventory for human judgment. It exits 0 with the
 * inventory by default; pass `--strict` to exit non-zero when a viewport
 * `@media (width)` query is present (used by the accompanying test to lock the
 * known set so new ones fail loudly).
 *
 * Run via `bun run --filter=cinder platform:audit` (wired into `validate`).
 *
 * oxlint/stylelint cannot express this report (cross-file inventory + the
 * `@media` vs `@container` distinction), and a scanned report with an explicit
 * tier table is the simplest durable enforcement — mirroring
 * `check-no-cycle-imports.ts`.
 */

import { Glob } from 'bun';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const componentsRoot = resolve(scriptDirectory, '..');
const componentsSource = join(componentsRoot, 'src');

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

/**
 * A viewport `@media` query keyed on width in component CSS. Matches
 * `@media (min-width: ...)` / `(max-width: ...)` while deliberately NOT matching
 * `@container (...)` (the preferred primitive) or `prefers-*` media (legitimate
 * non-width queries).
 */
export const VIEWPORT_WIDTH_MEDIA = /@media[^;{]*\b(?:min-width|max-width)\b/;

export type FeatureCount = { feature: string; tier: 1 | 2 | 3; count: number };
type Flag = { filePath: string; lineNumber: number; line: string };

/**
 * Pure per-line classifier. Returns the indices of every probe that matches the
 * line for the given file, plus whether the line is a viewport `@media(width)`
 * query. Extracted so the detection rules are unit-testable without a filesystem.
 */
export function classifyLine(
  relativePath: string,
  line: string,
): {
  matchedProbeIndices: number[];
  isViewportWidthMedia: boolean;
} {
  const matchedProbeIndices: number[] = [];
  for (const [probeIndex, probe] of FEATURE_PROBES.entries()) {
    if (matchesGlob(relativePath, probe.globs) && probe.pattern.test(line)) {
      matchedProbeIndices.push(probeIndex);
    }
  }
  const isStyleFile = relativePath.endsWith('.css') || relativePath.endsWith('.svelte');
  return {
    matchedProbeIndices,
    isViewportWidthMedia: isStyleFile && VIEWPORT_WIDTH_MEDIA.test(line),
  };
}

export async function scan(): Promise<{ counts: FeatureCount[]; viewportFlags: Flag[] }> {
  const counts: FeatureCount[] = FEATURE_PROBES.map((probe) => ({
    feature: probe.feature,
    tier: probe.tier,
    count: 0,
  }));
  const viewportFlags: Flag[] = [];

  const allGlobs = new Glob('**/*.{css,svelte,ts}');
  for await (const relativePath of allGlobs.scan({ cwd: componentsSource })) {
    const filePath = join(componentsSource, relativePath);
    const content = await Bun.file(filePath).text();
    const lines = content.split('\n');

    for (const [index, line] of lines.entries()) {
      const { matchedProbeIndices, isViewportWidthMedia } = classifyLine(relativePath, line);
      for (const probeIndex of matchedProbeIndices) {
        const entry = counts[probeIndex];
        if (entry) entry.count += 1;
      }
      if (isViewportWidthMedia) {
        viewportFlags.push({
          filePath: relative(componentsRoot, filePath),
          lineNumber: index + 1,
          line: line.trim(),
        });
      }
    }
  }

  return { counts, viewportFlags };
}

function matchesGlob(relativePath: string, globs: string[]): boolean {
  return globs.some((pattern) => new Glob(pattern).match(relativePath));
}

async function main(): Promise<void> {
  const strict = process.argv.includes('--strict');
  const { counts, viewportFlags } = await scan();

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
  process.stdout.write(report);

  if (viewportFlags.length === 0) {
    process.stdout.write(
      '  Viewport @media(width) queries in component CSS: none — every responsive component uses container queries.\n',
    );
    return;
  }

  const message =
    `  Viewport @media(width) queries in component CSS: ${viewportFlags.length}\n` +
    '  Each must be genuinely viewport-owned (app shell / drawer / modality switch).\n' +
    '  A component reacting to its OWN box width must use @container instead (RESPONSIVE-POLICY.md).\n\n' +
    viewportFlags
      .map((flag) => `    ${flag.filePath}:${flag.lineNumber}\n      ${flag.line}`)
      .join('\n') +
    '\n';

  if (strict) {
    process.stderr.write(message);
    process.exit(1);
  }
  process.stdout.write(message);
}

function tierLabel(tier: 1 | 2 | 3): string {
  return tier === 1 ? 'use directly' : tier === 2 ? 'progressive enhancement' : 'avoid for core';
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error('check-platform-features failed:', error);
    process.exit(1);
  });
}
