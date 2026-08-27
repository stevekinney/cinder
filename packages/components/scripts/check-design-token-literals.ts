/**
 * Design-token literal bypass guard for Cinder component styles.
 *
 * Backs the themeability policy: a consumer overrides a documented set of design
 * tokens and the whole library follows. That contract breaks when component CSS
 * hard-codes values that already have Cinder tokens. This script detects three
 * classes of bypass:
 *
 *   1. Transition/animation timing literals in `transition:` or `animation:`
 *      property values. The literal set is DERIVED from the `duration` tokens the
 *      corpus declares, in both their `ms` and `s` spellings, so retuning a
 *      duration re-points this guard automatically. These should use
 *      `var(--cinder-duration-*)` tokens.
 *
 *   2. Font-weight literals, derived from the `fontWeight` tokens the corpus
 *      declares, which should use the matching `var(--cinder-font-*)` token.
 *
 *   3. Raw focus/selection ring widths — `outline: 2px`, `box-shadow: 0 0 0 2px`,
 *      or `box-shadow: 0 0 0 4px` in focus-visible and selection contexts — which
 *      should use `var(--cinder-ring-width)` with `calc()` where needed.
 *
 * Scope: component `.css` sidecars AND `<style>` blocks of `.svelte` files under
 * `src/components`. Foundation/token files and test files are excluded.
 *
 * Two modes:
 *   - default: print the per-file inventory grouped by violation class. Exits 0.
 *   - `--strict`: exit non-zero when any violation is found (no baseline — this is
 *     a zero-tolerance gate for newly introduced literals, not a burn-down).
 *
 * Run via `bun run --filter=@lostgradient/cinder tokens:literals` (report) or
 * `tokens:literals --strict` (gate; wired into `lint`).
 */

import { Glob } from 'bun';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const componentsRoot = resolve(scriptDirectory, '..');
const componentsSource = join(componentsRoot, 'src', 'components');

// ── Matchers ─────────────────────────────────────────────────────────────────

/**
 * Timing literals in transition/animation values.
 * Matches lines where a raw duration literal appears in a CSS transition or
 * animation declaration. The pattern is intentionally conservative to avoid
 * false positives from:
 *   - Comments (stripped before matching via stripCssComments)
 *   - Token fallbacks: `var(--cinder-duration-fast, 150ms)` is correct usage
 *     where the literal is a valid CSS fallback for environments without the token.
 *     The scan strips `var(…)` call sites before matching, so fallback values are
 *     not counted as raw literals.
 */
/** One field of an already-narrowed object, without asserting a shape over it. */
function readField(source: object, field: string): unknown {
  return Object.hasOwn(source, field)
    ? (Object.getOwnPropertyDescriptor(source, field)?.value as unknown)
    : undefined;
}

/**
 * Every token in the resolved light context, narrowed to the two fields the
 * literal patterns are derived from. Light is used because durations and font
 * weights do not vary by theme; a token that ever did would need both arms.
 */
function readTypedTokens(): ReadonlyArray<{ type: string; value: unknown }> {
  const parsed: unknown = JSON.parse(
    readFileSync(join(componentsRoot, 'src', 'tokens', 'resolved', 'light.json'), 'utf8'),
  );
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('resolved/light.json is not a JSON object');
  }
  const tokens: Array<{ type: string; value: unknown }> = [];
  for (const entry of Object.values(parsed)) {
    if (typeof entry !== 'object' || entry === null) continue;
    const type = readField(entry, '$type');
    if (typeof type === 'string') tokens.push({ type, value: readField(entry, '$value') });
  }
  return tokens;
}

const typedTokens = readTypedTokens();

/**
 * The CSS literal forms of every duration token, both `ms` and `s` spellings.
 *
 * Derived from the corpus rather than hand-listed. The hand-written list this
 * replaces had gone stale: it flagged `0.15s`, `150ms`, `0.6s`, `0.1s`, and
 * `0.8s`, none of which correspond to any current token, while the real values
 * (120ms, 200ms, 280ms, 400ms, 750ms, 1.4s, 1.6s) went unguarded. Deriving them
 * means retuning a duration re-points the guard automatically instead of
 * quietly leaving it checking for the previous values.
 *
 * `0` is excluded: a bare `0` in a transition is not a token bypass.
 */
function durationLiterals(): readonly string[] {
  const literals = new Set<string>();
  for (const token of typedTokens) {
    if (token.type !== 'duration') continue;
    if (typeof token.value !== 'object' || token.value === null) continue;
    const amount = readField(token.value, 'value');
    const unit = readField(token.value, 'unit');
    if (typeof amount !== 'number' || typeof unit !== 'string') continue;
    const milliseconds = unit === 's' ? amount * 1000 : amount;
    if (milliseconds === 0) continue;
    literals.add(`${formatNumber(milliseconds)}ms`);
    literals.add(`${formatNumber(milliseconds / 1000)}s`);
  }
  return [...literals].sort();
}

/** Font-weight values that have a token, e.g. 400/500/600/700. */
function fontWeightLiterals(): readonly string[] {
  const literals = new Set<string>();
  for (const token of typedTokens) {
    if (token.type !== 'fontWeight') continue;
    if (typeof token.value === 'number') literals.add(String(token.value));
  }
  return [...literals].sort();
}

/** Trims a float to its shortest CSS spelling: 0.2 not 0.200, 120 not 120.0. */
function formatNumber(value: number): string {
  return String(Number(value.toFixed(6)));
}

function escapeForPattern(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const TIMING_LITERAL_PATTERN = new RegExp(
  `^\\s*(?:transition|animation)\\s*:.*?\\b(?:${durationLiterals()
    .map(escapeForPattern)
    .join('|')})\\b`,
  'm',
);

/**
 * Font-weight literals that should use design tokens, derived from the
 * `fontWeight` tokens the corpus declares. The previous hand-written pattern
 * covered only 500 and 600, silently permitting raw `400` and `700` even though
 * both have tokens.
 */
const FONT_WEIGHT_LITERAL_PATTERN = new RegExp(
  `^\\s*font-weight\\s*:\\s*(?:${fontWeightLiterals().join('|')})\\s*;`,
  'm',
);

/**
 * Focus/selection ring width literals — specifically those that should use tokens.
 *
 * Matches two forms that are clearly bypassing the token system:
 *   1. `outline: 2px solid transparent` — the invisible-outline + box-shadow
 *      focus ring pattern where `transparent` should always accompany
 *      `var(--cinder-ring-width)`. Forced-colors overrides use system colors
 *      (ButtonText, Highlight, CanvasText), NOT transparent — so this pattern
 *      is safe to require token usage for.
 *   2. `0 0 0 2px var(--cinder-ring...` or `0 0 0 4px var(--cinder-ring...` —
 *      the two-stop ring box-shadow where 2px is the offset and 4px is
 *      offset+ring (should use `var(--cinder-ring-offset)` and
 *      `calc(var(--cinder-ring-offset) + var(--cinder-ring-width))`).
 *
 * Intentionally does NOT match:
 *   - `outline: 2px solid ButtonText/Highlight/CanvasText` — forced-colors system
 *     color overrides, which are correct and must use literal system color keywords.
 *   - `outline: 2px dashed ...` — structural drop-target indicators (sortable-list,
 *     kanban-board placeholders), which are NOT focus rings and are out of scope.
 *   - `outline: 2px solid white` — deliberate lightbox white-over-photo contrast
 *     (documented allowlist exception in focus-ring-policy.md).
 */
const RING_WIDTH_LITERAL_PATTERN =
  /^\s*outline\s*:\s*2px\s+solid\s+transparent\b|0\s+0\s+0\s+(?:2|4)px\s+var\(--cinder-ring/m;

// ── Allowlist ─────────────────────────────────────────────────────────────────

/**
 * Source-relative POSIX paths (relative to `src/components/`) that are
 * permitted to retain specific literal patterns. Each entry carries a reason.
 * Use sparingly — the goal is zero entries.
 */
export const LITERAL_ALLOWLIST: Array<{ path: string; pattern: RegExp; reason: string }> = [
  // image-lightbox: the CSS close/nav `outline: 2px solid white` is a documented
  // exception (docs/focus-ring-policy.md § Deviations — white-over-photo contrast).
  // It is not a token bypass but a deliberate literal white ring over a dark photo.
  // Allowed via stylelint-disable and policy appendix; excluded here because it
  // is outside our three targeted ring patterns (no 0 0 0 2px ring, no outline: 2px
  // in a focus-ring-width context — the white outline is a color-override, not a
  // width-only raw 2px focus ring).
];

// ── Extraction ────────────────────────────────────────────────────────────────

/** Strips block comments, preserving line count. */
function stripCssComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, (comment) => {
    const newlines = comment.match(/\n/g)?.length ?? 0;
    return ' ' + '\n'.repeat(newlines);
  });
}

/** Extracts only the `<style>` block content for a `.svelte` file. */
function extractStyleSurface(source: string, isSvelte: boolean): string {
  if (!isSvelte) return source;
  const styleBlock = /<style\b[^>]*>([\s\S]*?)<\/style>/g;
  let result = '';
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = styleBlock.exec(source)) !== null) {
    const blockStart = match.index + match[0].indexOf('>') + 1;
    const blockEnd = blockStart + (match[1]?.length ?? 0);
    result += source.slice(lastIndex, blockStart).replace(/[^\n]/g, ' ');
    result += source.slice(blockStart, blockEnd);
    lastIndex = blockEnd;
  }
  result += source.slice(lastIndex).replace(/[^\n]/g, ' ');
  return result;
}

/** True for test/spec sources, which are never part of the authoring rule. */
function isTestPath(relativePath: string): boolean {
  return (
    /(?:^|\/)__tests__\//.test(relativePath) ||
    /\.(?:test|spec)\.[cm]?tsx?$/.test(relativePath) ||
    /\.examples?\.json$/.test(relativePath)
  );
}

// ── Violation type ────────────────────────────────────────────────────────────

export type LiteralClass = 'timing' | 'font-weight' | 'ring-width';

export type LiteralViolation = {
  /** Source-relative POSIX path from src/components. */
  filePath: string;
  /** Which class of literal was matched. */
  literalClass: LiteralClass;
};

// ── Scanner ───────────────────────────────────────────────────────────────────

/** Strips var() calls from a CSS surface, replacing them with empty var(). */
function stripVarCalls(source: string): string {
  // Iteratively strip innermost var() calls so nested vars are handled.
  let previous: string;
  let stripped = source;
  do {
    previous = stripped;
    // Replace var(--name, fallback) → var() to remove fallback literals from
    // matching. The empty var() is kept so line numbers are preserved.
    stripped = stripped.replace(/var\([^()]*\)/g, (match) => match.replace(/[^\n]/g, ' '));
  } while (stripped !== previous);
  return stripped;
}

export async function scan(): Promise<LiteralViolation[]> {
  const violations: LiteralViolation[] = [];
  const glob = new Glob('**/*.{css,svelte}');

  for await (const relativePath of glob.scan({ cwd: componentsSource })) {
    if (isTestPath(relativePath)) continue;

    const isSvelte = relativePath.endsWith('.svelte');
    const rawSource = await Bun.file(join(componentsSource, relativePath)).text();
    // Strip comments and var() fallbacks before checking for literals.
    // This prevents `var(--cinder-duration-fast, 150ms)` from being flagged
    // (the 150ms is a legitimate token fallback, not a raw literal bypass).
    const surface = stripVarCalls(stripCssComments(extractStyleSurface(rawSource, isSvelte)));

    // Check allowlist
    const isAllowed = (pattern: RegExp) =>
      LITERAL_ALLOWLIST.some(
        (entry) => entry.path === relativePath && entry.pattern.source === pattern.source,
      );

    if (!isAllowed(TIMING_LITERAL_PATTERN) && TIMING_LITERAL_PATTERN.test(surface)) {
      violations.push({ filePath: `src/components/${relativePath}`, literalClass: 'timing' });
    }
    if (!isAllowed(FONT_WEIGHT_LITERAL_PATTERN) && FONT_WEIGHT_LITERAL_PATTERN.test(surface)) {
      violations.push({
        filePath: `src/components/${relativePath}`,
        literalClass: 'font-weight',
      });
    }
    if (!isAllowed(RING_WIDTH_LITERAL_PATTERN) && RING_WIDTH_LITERAL_PATTERN.test(surface)) {
      violations.push({ filePath: `src/components/${relativePath}`, literalClass: 'ring-width' });
    }
  }

  return violations;
}

// ── CLI ───────────────────────────────────────────────────────────────────────

function renderReport(violations: LiteralViolation[]): string {
  if (violations.length === 0) {
    return 'design-token-literals audit — OK (no raw timing/font-weight/ring-width literals found in component CSS).\n';
  }

  const byClass = new Map<LiteralClass, string[]>();
  for (const violation of violations) {
    const list = byClass.get(violation.literalClass) ?? [];
    list.push(violation.filePath);
    byClass.set(violation.literalClass, list);
  }

  let report =
    'design-token-literals audit — raw design-token literals detected in component CSS:\n\n';

  const classDescriptions: Record<LiteralClass, string> = {
    timing: `Timing literals (${durationLiterals().join(' / ')}) — use var(--cinder-duration-*) tokens.`,
    'font-weight':
      'Font-weight literals (500 / 600) — use var(--cinder-font-medium) or var(--cinder-font-semibold).',
    'ring-width':
      'Ring-width literals (outline: 2px / 0 0 0 2px / 0 0 0 4px) — use var(--cinder-ring-width) with calc() where needed.',
  };

  for (const [literalClass, files] of byClass) {
    report += `## ${literalClass}: ${files.length} file(s)\n`;
    report += `   ${classDescriptions[literalClass]}\n`;
    for (const filePath of files.toSorted()) {
      report += `   ${filePath}\n`;
    }
    report += '\n';
  }

  return report;
}

async function main(): Promise<void> {
  const strict = process.argv.includes('--strict');
  const violations = await scan();

  process.stdout.write(renderReport(violations));

  if (strict && violations.length > 0) {
    process.stderr.write(
      `\nFound ${violations.length} raw design-token literal(s) in component CSS.\n` +
        `Replace timing literals with var(--cinder-duration-*) tokens,\n` +
        `font-weight literals with var(--cinder-font-medium) or var(--cinder-font-semibold),\n` +
        `and ring-width literals with var(--cinder-ring-width) (using calc() for offsets).\n`,
    );
    process.exitCode = 1;
    return;
  }

  process.exitCode = 0;
}

if (import.meta.main) {
  await main();
}
