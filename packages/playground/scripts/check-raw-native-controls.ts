/**
 * Raw-native-control authoring guard for playground examples.
 *
 * Cinder's playground examples should use Cinder primitives (Button, Checkbox,
 * Select, Textarea, Input) instead of raw HTML interactive controls (<button>,
 * <input>, <select>, <textarea>). Raw controls in examples imply a usability
 * inconsistency visible to every developer who views the docs.
 *
 * This script scans every `packages/playground/src/examples/**\/*.example.svelte`
 * file for raw interactive native control tags and reports them, partitioned into:
 *   - allowlisted: genuinely intentional raw controls (see ALLOWLIST below)
 *   - flagged: raw controls that should be swapped for a Cinder primitive
 *
 * Two modes:
 *   - default (report-only): prints the full inventory. Always exits 0.
 *     Intended for human review and CI audit visibility.
 *   - `--strict`: exits non-zero when any NON-allowlisted raw controls are found.
 *     Wire this into the validate gate after the sweep PR merges.
 *
 * Run via:
 *   bun run --filter=@cinder/playground examples:audit          (report)
 *   bun run --filter=@cinder/playground examples:audit --strict (gate)
 *
 * Model: mirrors check-platform-features.ts's report-then-strict pattern.
 */

import { Glob } from 'bun';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const playgroundRoot = resolve(scriptDirectory, '..');
const examplesRoot = join(playgroundRoot, 'src', 'examples');

// ── Types ─────────────────────────────────────────────────────────────────────

/** A detected raw native-control occurrence. */
export type RawControlOccurrence = {
  /** Relative path from the examples root (e.g. `button/basic.example.svelte`). */
  relativePath: string;
  /** 1-based line number where the tag opens. */
  lineNumber: number;
  /** The tag name: `button`, `input`, `select`, or `textarea`. */
  tagName: RawControlTagName;
  /** The raw line text (trimmed). */
  lineText: string;
};

/** The four raw interactive native HTML elements we enforce against. */
export type RawControlTagName = 'button' | 'input' | 'select' | 'textarea';

/** Reported result: all occurrences split into allowlisted vs flagged. */
export type ScanResult = {
  allowlisted: RawControlOccurrence[];
  flagged: RawControlOccurrence[];
};

// ── Allowlist ─────────────────────────────────────────────────────────────────

/**
 * An allowlist entry grandfathers a specific file+line combination that cannot
 * use a Cinder primitive. Each entry documents why the raw element is required.
 *
 * Identity is file+line (not file+tag), because two different raw tags on the
 * same line would be unusual and detecting them together is acceptable. When a
 * file is refactored and line numbers drift, the allowlist entry simply stops
 * matching and the occurrence is re-flagged — forcing a fresh review.
 */
export type AllowlistEntry = {
  /** Relative path from examples root, forward-slash separated. */
  relativePath: string;
  /** 1-based line number of the raw control's opening tag. */
  lineNumber: number;
  /**
   * Human-readable rationale for the exemption. Required so reviewers
   * understand intent at a glance rather than re-reading the example.
   */
  reason: string;
};

/**
 * Allowlisted raw controls. Each entry represents a case where a Cinder
 * primitive cannot be used — either because the snippet contract requires the
 * consumer to supply a native element that accepts forwarded attributes, or
 * because the example explicitly tests a low-level behavior that requires a
 * native element (e.g. triggerRef with bind:this).
 *
 * Be conservative: only allowlist controls that GENUINELY cannot use a Cinder
 * primitive. Everything else stays flagged for the sweep PR.
 */
export const ALLOWLIST: AllowlistEntry[] = [
  {
    relativePath: 'navigation-bar/basic.example.svelte',
    lineNumber: 20,
    reason:
      'The NavigationBar menuToggle snippet forwards spread attrs (including aria and focus management) onto the trigger element. The consumer MUST supply a native <button> so the attrs land on an interactive element; the Cinder Button component does not expose a pass-through for arbitrary component-forwarded attrs.',
  },
  {
    relativePath: 'popover/transformed-ancestor.example.svelte',
    lineNumber: 33,
    reason:
      'This fixture tests low-level `triggerRef` anchoring with bind:this={triggerElement}. The Popover component needs a raw HTMLButtonElement reference — the example intentionally exercises the ref path rather than the trigger-slot path, so a raw <button> is the correct primitive here.',
  },
  {
    relativePath: 'command-palette/search-recent-actions.example.svelte',
    lineNumber: 81,
    reason:
      'CommandPalette requires a triggerRef (HTMLElement) for focus-return. The trigger button uses bind:this to capture the element reference for that purpose. It also applies heavy inline styles that exist to demo the styled-keyboard-shortcut pattern; until the example is rewritten with a styled Cinder Button, the raw element is intentional.',
  },
];

// ── Detection ─────────────────────────────────────────────────────────────────

/**
 * The regex that identifies an opening raw native control tag.
 * Matches `<button`, `<input`, `<select`, `<textarea` at a tag boundary — i.e.
 * the tag name is followed by whitespace, `>`, or `/` (self-closing). This
 * avoids false positives on Svelte component names like `<InputField>`.
 *
 * Specifically does NOT match:
 *   - `<Button` (capital B — a Cinder component)
 *   - `<selectField` (longer identifier — not a raw <select>)
 *   - `<!-- <button> -->` (commented — not currently stripped, so commented raw
 *     controls are intentionally NOT reported; they carry no runtime impact)
 */
export const RAW_CONTROL_PATTERN = /<(button|input|select|textarea)(?=[\s\t\r\n>\/]|$)/;

/** All tag names this guard enforces. */
export const RAW_CONTROL_TAG_NAMES: RawControlTagName[] = ['button', 'input', 'select', 'textarea'];

/**
 * Test whether a single source line contains a raw native control opening tag.
 * Returns the matched tag name, or `null` if no raw control is present.
 *
 * Pure — no I/O. Exported for unit tests.
 */
export function detectRawControl(line: string): RawControlTagName | null {
  const match = RAW_CONTROL_PATTERN.exec(line);
  if (!match) return null;
  return match[1] as RawControlTagName;
}

/** Normalize a path to forward slashes for cross-platform stability. */
export function toPosixPath(path: string): string {
  return path.replaceAll('\\', '/');
}

/**
 * Build the allowlist lookup key: `relativePath::lineNumber`.
 * Line-based identity catches drifted entries loudly (they stop matching)
 * rather than silently grandfathering the wrong occurrence.
 */
export function allowlistKey(relativePath: string, lineNumber: number): string {
  return `${toPosixPath(relativePath)}::${lineNumber}`;
}

/**
 * Build a fast lookup set from the allowlist array.
 * Pure — no I/O. Exported for unit tests.
 */
export function buildAllowlistIndex(entries: AllowlistEntry[]): Set<string> {
  const index = new Set<string>();
  for (const entry of entries) {
    index.add(allowlistKey(entry.relativePath, entry.lineNumber));
  }
  return index;
}

// ── Scanning ──────────────────────────────────────────────────────────────────

/**
 * Scan all `*.example.svelte` files under `examplesDirectory` for raw native
 * controls, partitioning them into allowlisted and flagged occurrences.
 *
 * Exported so unit tests can call it with a fixture directory.
 */
export async function scan(
  examplesDirectory: string,
  allowlist: AllowlistEntry[] = ALLOWLIST,
): Promise<ScanResult> {
  const allowlistIndex = buildAllowlistIndex(allowlist);
  const allowlisted: RawControlOccurrence[] = [];
  const flagged: RawControlOccurrence[] = [];

  const glob = new Glob('**/*.example.svelte');
  for await (const relativePath of glob.scan({ cwd: examplesDirectory })) {
    const posixPath = toPosixPath(relativePath);
    const filePath = join(examplesDirectory, relativePath);
    const source = await Bun.file(filePath).text();
    const lines = source.split('\n');

    for (let index = 0; index < lines.length; index++) {
      const lineNumber = index + 1;
      const line = lines[index] ?? '';
      const tagName = detectRawControl(line);
      if (!tagName) continue;

      const occurrence: RawControlOccurrence = {
        relativePath: posixPath,
        lineNumber,
        tagName,
        lineText: line.trim(),
      };

      if (allowlistIndex.has(allowlistKey(posixPath, lineNumber))) {
        allowlisted.push(occurrence);
      } else {
        flagged.push(occurrence);
      }
    }
  }

  // Sort for stable output: alphabetical file then ascending line number.
  const sort = (items: RawControlOccurrence[]) =>
    items.toSorted(
      (a, b) => a.relativePath.localeCompare(b.relativePath) || a.lineNumber - b.lineNumber,
    );

  return { allowlisted: sort(allowlisted), flagged: sort(flagged) };
}

// ── Rendering ─────────────────────────────────────────────────────────────────

/**
 * Render an occurrence list as indented text lines.
 */
function renderOccurrenceList(occurrences: RawControlOccurrence[]): string {
  return occurrences
    .map(
      (occurrence) =>
        `    ${occurrence.relativePath}:${occurrence.lineNumber}  <${occurrence.tagName}>  ${occurrence.lineText}`,
    )
    .join('\n');
}

/**
 * Render the full audit report as a string.
 * Pure — no I/O. Exported for unit tests.
 */
export function renderReport(result: ScanResult): string {
  const total = result.allowlisted.length + result.flagged.length;
  let report = `examples:audit — raw native control inventory\n`;
  report += `  Total raw controls found: ${total} (${result.flagged.length} flagged, ${result.allowlisted.length} allowlisted)\n\n`;

  if (result.flagged.length > 0) {
    report += `  Flagged (should use a Cinder primitive): ${result.flagged.length}\n`;
    report += renderOccurrenceList(result.flagged);
    report += '\n\n';
  } else {
    report += `  Flagged: none — all raw controls are allowlisted or absent.\n\n`;
  }

  if (result.allowlisted.length > 0) {
    report += `  Allowlisted (intentional — documented in ALLOWLIST): ${result.allowlisted.length}\n`;
    report += renderOccurrenceList(result.allowlisted);
    report += '\n';
  }

  return report;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const strict = process.argv.includes('--strict');
  const result = await scan(examplesRoot);

  process.stdout.write(renderReport(result));

  if (!strict) {
    // Report-only mode: always exit 0 regardless of flagged count.
    // A later PR will flip strict mode on after the sweep.
    if (result.flagged.length > 0) {
      process.stdout.write(
        `  (report-only) ${result.flagged.length} flagged control${result.flagged.length === 1 ? '' : 's'} above should be replaced with Cinder primitives.\n` +
          `  Run with --strict to make this check fail on non-allowlisted raw controls.\n`,
      );
    }
    return;
  }

  // Strict mode: exit non-zero if any flagged (non-allowlisted) raw controls remain.
  if (result.flagged.length > 0) {
    process.stderr.write(
      `examples:audit — ${result.flagged.length} non-allowlisted raw native control${result.flagged.length === 1 ? '' : 's'} found.\n` +
        `  Replace each with the Cinder equivalent (Button, Checkbox, Select, Textarea, Input),\n` +
        `  or add an entry to the ALLOWLIST in scripts/check-raw-native-controls.ts with a reason.\n`,
    );
    process.exit(1);
  }

  process.stdout.write(`  examples:audit (strict) — no non-allowlisted raw controls. OK.\n`);
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error('examples:audit failed:', error);
    process.exit(1);
  });
}
