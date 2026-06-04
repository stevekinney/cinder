/**
 * Raw-color discipline report + guard for Cinder component styles.
 *
 * Backs the themeability policy: a consumer should be able to override a small,
 * documented set of design tokens and have the whole library follow. That breaks
 * when component CSS hard-codes color values — a raw `#hex`, `rgb()`, `hsl()`,
 * `oklch()`, or a `light-dark()` status formula — because those values do not
 * track the token overrides. This script makes every raw-color site visible and,
 * in strict mode, prevents the known set from growing.
 *
 * Not every raw color is debt. The guard classifies each site by REASON so the
 * report tells a fixer what action is correct, rather than a flat "violation":
 *   - `migration-debt`   — should become a token / shared recipe (the default).
 *   - `domain-rendering` — intrinsic to a color-domain control (hue gradients,
 *     the color the user is literally picking). Cannot be a theme token.
 *   - `structural-pattern` — a checkerboard / transparency grid; a structural
 *     device, not a themeable surface. Centralize behind a shared variable when
 *     practical, but it is not a theme leak.
 * `domain-rendering` and `structural-pattern` sites are recorded in the reason
 * allowlist (`raw-color-reasons.json`) with a written justification; everything
 * else counts as `migration-debt` and is what the per-family migration PRs burn
 * down. Strict mode fails when migration-debt grows above the baseline OR when a
 * raw color appears in a file that the reason allowlist does not cover.
 *
 * Two modes:
 *   - default: print the per-file inventory grouped by reason. Always exits 0.
 *   - `--strict`: compare migration-debt sites against the checked-in baseline
 *     (`raw-color-baseline.json`). Exits non-zero only when a NEW debt site
 *     appears beyond the grandfathered count. Pass `--update-baseline` to rewrite
 *     the baseline after an intentional change (e.g. a family migration lands).
 *
 * Run via `bun run --filter=@lostgradient/cinder colors:audit` (report) or `colors:audit
 * --strict` (gate; wired into `validate` once report output is clean).
 *
 * Scope mirrors `check-platform-features.ts`: component `.css` sidecars AND the
 * `<style>` blocks of `.svelte` files under `src/components` + the shared CSS
 * partials under `src/styles/components`. Token/foundation files (`tokens-base`,
 * `tokens.css`, the `tokens/` dir) are the ONE place raw colors legitimately
 * live, so they are excluded. Tests, docs, examples, and generated output are
 * also excluded — this is a source-authoring rule.
 *
 * stylelint cannot express this (cross-file count baseline + per-reason
 * classification + Svelte `<style>` extraction), so a scanned report with an
 * explicit reason allowlist is the simplest durable enforcement — mirroring
 * `check-platform-features.ts` and `check-no-cycle-imports.ts`.
 */

import { Glob } from 'bun';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const componentsRoot = resolve(scriptDirectory, '..');
const componentsSource = join(componentsRoot, 'src');
const baselinePath = join(scriptDirectory, 'raw-color-baseline.json');

/**
 * The reason a raw-color site is intentional and NOT migration debt. Sites whose
 * file is listed in the reason allowlist take that file's reason; everything else
 * defaults to `migration-debt`.
 */
export type RawColorReason = 'migration-debt' | 'domain-rendering' | 'structural-pattern';

/** The class of raw color matched, used for human-readable grouping in the report. */
export type RawColorClass = 'hex' | 'rgb' | 'hsl' | 'oklch' | 'light-dark';

/** A detected raw-color occurrence. */
export type RawColorFlag = {
  /** Source-relative POSIX path, e.g. `src/components/callout/callout.css`. */
  filePath: string;
  /** 1-based line number where the color token starts. */
  lineNumber: number;
  /** Which color syntax was matched. */
  colorClass: RawColorClass;
  /** The classified reason for this site. */
  reason: RawColorReason;
  /** The matched text (trimmed), for the report. */
  text: string;
};

/**
 * Detects raw color values. Each entry is a class plus a global regex. Order is
 * significant only for reporting; a line can match multiple classes and each is
 * counted. `light-dark()` is matched independently because a Cinder status soft
 * surface formula (`light-dark(oklch(from var(--cinder-danger) ...)))`) is the
 * single most common migration target and deserves its own class in the report.
 *
 * Notes:
 *   - `#hex` requires a word boundary and 3/4/6/8 hex digits so `#anchor-name`
 *     fragments and `&#123;`-style entities don't match.
 *   - `rgb`/`hsl` match both the legacy comma form and the modern space form,
 *     and both the `a`-suffixed and bare names.
 */
export const COLOR_PROBES: Array<{ colorClass: RawColorClass; pattern: RegExp }> = [
  { colorClass: 'hex', pattern: /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g },
  { colorClass: 'rgb', pattern: /\brgba?\(/g },
  { colorClass: 'hsl', pattern: /\bhsla?\(/g },
  { colorClass: 'oklch', pattern: /\boklch\(/g },
  { colorClass: 'light-dark', pattern: /\blight-dark\(/g },
];

/** Normalizes a path to forward slashes so baseline keys are OS-independent. */
export function toPosixPath(path: string): string {
  return path.replaceAll('\\', '/');
}

/** True for test/spec sources, which are never part of the authoring rule. */
export function isTestPath(relativePath: string): boolean {
  return (
    /(?:^|\/)__tests__\//.test(relativePath) ||
    /\.(?:test|spec)\.[cm]?tsx?$/.test(relativePath) ||
    /\.examples?\.json$/.test(relativePath)
  );
}

/**
 * Strips `/* … *​/` CSS comments (multi-line safe), preserving the newline count
 * of each removed comment so line numbers computed against the result still map
 * to the original source. Shared shape with `check-platform-features.ts`.
 */
export function stripCssComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, (comment) => {
    const newlines = comment.match(/\n/g)?.length ?? 0;
    return ' ' + '\n'.repeat(newlines);
  });
}

/**
 * Extracts the style surface to scan from a file. For a `.css` file that's the
 * whole body. For a `.svelte` file it's only the content of `<style ...>` blocks
 * — markup and script never carry CSS raw-color discipline. To keep line numbers
 * accurate, non-style regions are blanked out (replaced with newlines) rather
 * than removed, so a match's line number in the returned string still maps to the
 * original `.svelte` file.
 */
export function extractStyleSurface(source: string, isSvelte: boolean): string {
  if (!isSvelte) return source;
  const styleBlock = /<style\b[^>]*>([\s\S]*?)<\/style>/g;
  let result = '';
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = styleBlock.exec(source)) !== null) {
    const blockStart = match.index + match[0].indexOf('>') + 1;
    const blockEnd = blockStart + (match[1]?.length ?? 0);
    // Blank everything up to the style content, preserving newlines.
    result += blankNonStyle(source.slice(lastIndex, blockStart));
    result += source.slice(blockStart, blockEnd);
    lastIndex = blockEnd;
  }
  result += blankNonStyle(source.slice(lastIndex));
  return result;
}

/** Replaces every non-newline character with a space so offsets/lines are kept. */
function blankNonStyle(segment: string): string {
  return segment.replace(/[^\n]/g, ' ');
}

/**
 * Inline reason marker. A raw color is classified as intentional (not migration
 * debt) by a `/* cinder-allow-raw-color: <reason> — <note> *​/` comment on the
 * SAME line as the color, or on the line immediately above it. This is
 * line-precise — a single file (e.g. color-picker.css) legitimately mixes a
 * `domain-rendering` hue spectrum, a `structural-pattern` checkerboard, and real
 * `migration-debt` shadows, so a file-level classification would be too coarse.
 * Mirrors the playground example-guard's inline-marker idiom and the existing
 * `/* stylelint-disable *​/` convention in component CSS.
 *
 * `<reason>` must be `domain-rendering` or `structural-pattern` (the two
 * intentional classes); `migration-debt` is the implicit default and is never
 * marked. A free-text note after an em dash or hyphen documents the call site.
 */
export const INLINE_REASON_MARKER =
  /\/\*\s*cinder-allow-raw-color:\s*(domain-rendering|structural-pattern)\b/;

/** Extracts the intentional reason from a marker on a line, or null if none. */
export function extractInlineReason(line: string): RawColorReason | null {
  const match = INLINE_REASON_MARKER.exec(line);
  if (match?.[1] === 'domain-rendering' || match?.[1] === 'structural-pattern') {
    return match[1];
  }
  return null;
}

/**
 * Scans all component style surfaces and returns every raw-color flag, each
 * classified by the inline reason marker on (or directly above) its line, or
 * `migration-debt` when unmarked.
 */
export async function scan(): Promise<RawColorFlag[]> {
  const flags: RawColorFlag[] = [];
  const scanRoots = [
    { dir: join(componentsSource, 'components'), prefix: 'src/components' },
    { dir: join(componentsSource, 'styles', 'components'), prefix: 'src/styles/components' },
  ];

  for (const { dir, prefix } of scanRoots) {
    const glob = new Glob('**/*.{css,svelte}');
    for await (const relativePath of glob.scan({ cwd: dir })) {
      if (isTestPath(relativePath)) continue;
      const posix = `${prefix}/${toPosixPath(relativePath)}`;
      const rawSource = await Bun.file(join(dir, relativePath)).text();
      // Reason markers ARE comments, so read them from the comment-bearing
      // (style-extracted) surface BEFORE stripping. Color detection runs on the
      // comment-stripped copy so a raw color inside a comment is never flagged;
      // both copies share line structure, so a color's line maps to the same
      // line in the marker copy.
      const markerSurface = extractStyleSurface(rawSource, relativePath.endsWith('.svelte'));
      const markerLines = markerSurface.split('\n');
      const surface = stripCssComments(markerSurface);

      for (const { colorClass, pattern } of COLOR_PROBES) {
        pattern.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(surface)) !== null) {
          const lineNumber = surface.slice(0, match.index).split('\n').length;
          // A marker on the color's own line, or on the line directly above it.
          const lineIndex = lineNumber - 1;
          const reason =
            extractInlineReason(markerLines[lineIndex] ?? '') ??
            (lineIndex > 0 ? extractInlineReason(markerLines[lineIndex - 1] ?? '') : null) ??
            'migration-debt';
          flags.push({
            filePath: posix,
            lineNumber,
            colorClass,
            reason,
            text: match[0],
          });
        }
      }
    }
  }
  return flags;
}

// ── Baseline (count-based, migration-debt only) ────────────────────────────────

/**
 * A baseline entry grandfathers a known migration-debt site by file + color
 * class, with the allowed occurrence count. Count-based (not line-based) for the
 * same reason as the platform guard: line numbers drift on unrelated edits, and
 * two identical raw colors in one file are indistinguishable without coordinates.
 * Only `migration-debt` flags are baselined — intentional reasons are marked
 * inline at the call site, not tracked by the count baseline.
 */
export type BaselineEntry = { filePath: string; colorClass: RawColorClass; allowedCount: number };

/** Identity key for a debt site: file + color class. */
export function flagKey(flag: { filePath: string; colorClass: RawColorClass }): string {
  return `${flag.filePath}::${flag.colorClass}`;
}

/** Counts how many times each `flagKey` occurs across the flags. */
export function countByKey(
  flags: Array<{ filePath: string; colorClass: RawColorClass }>,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const flag of flags) {
    counts.set(flagKey(flag), (counts.get(flagKey(flag)) ?? 0) + 1);
  }
  return counts;
}

function isBaselineEntry(value: unknown): value is BaselineEntry {
  if (typeof value !== 'object' || value === null) return false;
  const colorClass = (value as { colorClass?: unknown }).colorClass;
  return (
    typeof (value as { filePath?: unknown }).filePath === 'string' &&
    typeof colorClass === 'string' &&
    ['hex', 'rgb', 'hsl', 'oklch', 'light-dark'].includes(colorClass) &&
    typeof (value as { allowedCount?: unknown }).allowedCount === 'number'
  );
}

/**
 * Parses already-loaded baseline JSON into a `flagKey` → allowed-count map. Pure
 * (no filesystem) for testability. Throws on a non-array or malformed entry so a
 * corrupt baseline fails loudly rather than silently disabling the gate.
 */
export function parseBaseline(parsed: unknown): Map<string, number> {
  if (!Array.isArray(parsed)) {
    throw new Error(
      'baseline must be a JSON array of {filePath, colorClass, allowedCount} entries.',
    );
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

/** Reads the baseline file as a `flagKey` → allowed-count map (empty if absent). */
export async function readBaseline(): Promise<Map<string, number>> {
  const file = Bun.file(baselinePath);
  if (!(await file.exists())) return new Map();
  return parseBaseline(await file.json());
}

/** Builds the sorted, deduplicated baseline entries (one per key, with count). */
export function buildBaselineEntries(
  flags: Array<{ filePath: string; colorClass: RawColorClass }>,
): BaselineEntry[] {
  const counts = countByKey(flags);
  const byKey = new Map<string, BaselineEntry>();
  for (const flag of flags) {
    const key = flagKey(flag);
    if (!byKey.has(key)) {
      byKey.set(key, {
        filePath: flag.filePath,
        colorClass: flag.colorClass,
        allowedCount: counts.get(key) ?? 0,
      });
    }
  }
  return [...byKey.values()].toSorted(
    (a, b) => a.filePath.localeCompare(b.filePath) || a.colorClass.localeCompare(b.colorClass),
  );
}

export type Regression = {
  filePath: string;
  colorClass: RawColorClass;
  allowed: number;
  found: number;
};

/**
 * Returns migration-debt sites whose current count exceeds the baseline's allowed
 * count (a NEW raw color was added beyond the grandfathered set). A key absent
 * from the baseline has an allowed count of 0, so any first occurrence regresses.
 */
export function findRegressions(
  debtFlags: Array<{ filePath: string; colorClass: RawColorClass }>,
  allowed: Map<string, number>,
): Regression[] {
  const counts = countByKey(debtFlags);
  // Iterate the typed flags (deduped by key) so filePath/colorClass keep their
  // types — no string-key re-parse and no unsafe assertion.
  const seen = new Set<string>();
  const regressions: Regression[] = [];
  for (const flag of debtFlags) {
    const key = flagKey(flag);
    if (seen.has(key)) continue;
    seen.add(key);
    const found = counts.get(key) ?? 0;
    const allowedCount = allowed.get(key) ?? 0;
    if (found > allowedCount) {
      regressions.push({
        filePath: flag.filePath,
        colorClass: flag.colorClass,
        allowed: allowedCount,
        found,
      });
    }
  }
  return regressions.toSorted(
    (a, b) => a.filePath.localeCompare(b.filePath) || a.colorClass.localeCompare(b.colorClass),
  );
}

// ── CLI ─────────────────────────────────────────────────────────────────────

function renderReport(flags: RawColorFlag[]): string {
  const byReason = new Map<RawColorReason, RawColorFlag[]>();
  for (const flag of flags) {
    const list = byReason.get(flag.reason) ?? [];
    list.push(flag);
    byReason.set(flag.reason, list);
  }
  const order: RawColorReason[] = ['migration-debt', 'domain-rendering', 'structural-pattern'];
  let report = 'Raw-color audit — Cinder component styles\n\n';
  for (const reason of order) {
    const list = byReason.get(reason) ?? [];
    report += `## ${reason}: ${list.length} site(s)\n`;
    const byFile = new Map<string, RawColorFlag[]>();
    for (const flag of list) {
      const fileList = byFile.get(flag.filePath) ?? [];
      fileList.push(flag);
      byFile.set(flag.filePath, fileList);
    }
    for (const [file, fileFlags] of [...byFile.entries()].toSorted((a, b) =>
      a[0].localeCompare(b[0]),
    )) {
      report += `  ${file}: ${fileFlags.length}\n`;
    }
    report += '\n';
  }
  return report;
}

async function main(): Promise<void> {
  const strict = process.argv.includes('--strict');
  const updateBaseline = process.argv.includes('--update-baseline');

  const flags = await scan();
  const debtFlags = flags.filter((flag) => flag.reason === 'migration-debt');

  if (updateBaseline) {
    const entries = buildBaselineEntries(debtFlags);
    await Bun.write(baselinePath, `${JSON.stringify(entries, null, 2)}\n`);
    process.stdout.write(`Wrote ${entries.length} baseline entries to ${baselinePath}\n`);
    return;
  }

  process.stdout.write(renderReport(flags));

  const allowed = await readBaseline();
  const baselineTotal = [...allowed.values()].reduce((sum, count) => sum + count, 0);
  const debtTotal = debtFlags.length;
  const direction =
    debtTotal > baselineTotal ? 'ABOVE' : debtTotal < baselineTotal ? 'below' : 'at';
  process.stdout.write(
    `migration-debt: ${debtTotal} site(s) — ${direction} baseline (${baselineTotal})\n`,
  );

  if (!strict) {
    process.exitCode = 0;
    return;
  }

  const regressions = findRegressions(debtFlags, allowed);
  if (regressions.length > 0) {
    process.stderr.write(`\nNEW raw-color migration debt (not in baseline):\n`);
    for (const regression of regressions) {
      process.stderr.write(
        `  ${regression.filePath} [${regression.colorClass}]: found ${regression.found}, allowed ${regression.allowed}\n`,
      );
    }
    process.stderr.write(
      `\nReplace with a design token / shared recipe, classify the site with an inline ` +
        `/* cinder-allow-raw-color: domain-rendering|structural-pattern — reason */ marker, ` +
        `or (after an intentional migration) run colors:audit --update-baseline.\n`,
    );
    process.exitCode = 1;
    return;
  }
  process.exitCode = 0;
}

if (import.meta.main) {
  await main();
}
