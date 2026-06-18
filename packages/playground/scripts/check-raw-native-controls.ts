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
 *   - allowlisted: genuinely intentional raw controls (see ALLOWLIST below, or
 *     inline `<!-- examples-audit-allow: <reason> -->` markers)
 *   - flagged: raw controls that should be swapped for a Cinder primitive
 *   - stale: allowlist entries that no longer match any raw control in the file
 *
 * Two modes:
 *   - default (report-only): prints the full inventory. Always exits 0.
 *     Intended for human review and CI audit visibility.
 *   - `--strict`: exits non-zero when any NON-allowlisted raw controls are found,
 *     OR when any stale allowlist entries are present.
 *     Wire this into the validate gate after the sweep PR merges.
 *
 * Run via:
 *   bun run --filter=@cinder/playground examples:audit          (report)
 *   bun run --filter=@cinder/playground examples:audit --strict (gate)
 *
 * Model: mirrors check-platform-features.ts's report-then-strict pattern.
 *
 * ── Allowlist Mechanism ────────────────────────────────────────────────────────
 *
 * Two complementary approaches — use the one that fits best:
 *
 * 1. INLINE MARKER (preferred): place `<!-- examples-audit-allow: <reason> -->`
 *    on the SAME line as the raw control, or on the line immediately above it.
 *    The reason is self-documenting at the call site and survives line-number drift.
 *
 *      <!-- examples-audit-allow: triggerRef requires a native HTMLButtonElement -->
 *      <button bind:this={triggerElement}>…</button>
 *
 *    Or on the same line:
 *
 *      <button bind:this={triggerElement}>…</button> <!-- examples-audit-allow: triggerRef ref path -->
 *
 * 2. ALLOWLIST ARRAY (below): key by relativePath + tagName + occurrenceIndex.
 *    Use this for files where the inline marker would be awkward.
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
  /** 0-based column where the tag opens. */
  columnIndex: number;
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
  /** Allowlist entries that did not match any occurrence in the scanned files. */
  staleAllowlistEntries: AllowlistEntry[];
};

// ── Allowlist ─────────────────────────────────────────────────────────────────

/**
 * An allowlist entry grandfathers a specific raw control that cannot use a Cinder
 * primitive. Each entry documents why the raw element is required.
 *
 * Identity is file + tagName + occurrenceIndex (0-based count of that tag in the
 * file). This is more stable than line-based identity: unrelated edits above the
 * line do not break the match. When the file is refactored and the tag is removed
 * or the occurrence order changes, the entry becomes stale and is reported — forcing
 * a fresh review.
 *
 * Note: occurrenceIndex counts only detected occurrences (i.e. in non-comment,
 * non-string-literal content) for the given tagName in the file.
 */
export type AllowlistEntry = {
  /** Relative path from examples root, forward-slash separated. */
  relativePath: string;
  /** The raw control tag name this entry covers. */
  tagName: RawControlTagName;
  /**
   * 0-based index among all detected occurrences of this tagName in this file.
   * 0 = the first <button>, 1 = the second <button>, etc.
   */
  occurrenceIndex: number;
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
 *
 * Alternatively, place `<!-- examples-audit-allow: <reason> -->` on the same line
 * or the line immediately above the raw control — that approach is more robust
 * than this array for long-lived exemptions.
 */
export const ALLOWLIST: AllowlistEntry[] = [
  {
    relativePath: 'navigation-bar/basic.example.svelte',
    tagName: 'button',
    occurrenceIndex: 0,
    reason:
      'The NavigationBar menuToggle snippet forwards spread attrs (including aria and focus management) onto the trigger element. The consumer MUST supply a native <button> so the attrs land on an interactive element; the Cinder Button component does not expose a pass-through for arbitrary component-forwarded attrs.',
  },
  {
    relativePath: 'popover/transformed-ancestor.example.svelte',
    tagName: 'button',
    occurrenceIndex: 0,
    reason:
      'This fixture tests low-level `triggerRef` anchoring with bind:this={triggerElement}. The Popover component needs a raw HTMLButtonElement reference — the example intentionally exercises the ref path rather than the trigger-slot path, so a raw <button> is the correct primitive here.',
  },
  {
    relativePath: 'command-palette/search-recent-actions.example.svelte',
    tagName: 'button',
    occurrenceIndex: 0,
    reason:
      'CommandPalette requires a triggerRef (HTMLElement) for focus-return. The trigger button uses bind:this to capture the element reference for that purpose. It also applies heavy inline styles that exist to demo the styled-keyboard-shortcut pattern; until the example is rewritten with a styled Cinder Button, the raw element is intentional.',
  },
];

// ── Comment/String Stripping ───────────────────────────────────────────────────

/**
 * Strips comment and string-literal content from a Svelte/HTML source string while
 * preserving line structure so that line numbers computed against the result still
 * map to the original source. Each stripped region is replaced with whitespace
 * (one space per non-newline character), keeping all newlines in place.
 *
 * Regions stripped (in order):
 *   1. HTML/Svelte block comments: `<!-- ... -->` (multi-line safe)
 *   2. JS/TS block comments inside <script>: `/* ... *\/` (multi-line safe)
 *   3. JS/TS line comments inside <script>: `// ...` (single line)
 *   4. JS/TS string literals (single-quoted, double-quoted, template literals)
 *      inside <script> blocks — prevents `"<button>"` from being flagged.
 *
 * We only strip string literals inside `<script ... >...</script>` blocks because
 * Svelte template strings are not JS strings and their content is markup, not data.
 * A `{`<button>`}` expression in a template would be unusual and is intentionally
 * kept detectable (it would render a raw control).
 *
 * Line numbers are preserved: every newline in a stripped region is kept as-is;
 * only non-newline characters are replaced with spaces. This means:
 *   - A single-line `<!-- <button> -->` becomes `<!--               -->` (spaces).
 *   - A multi-line comment keeps the same number of lines.
 */
/**
 * Replace a character with a space, preserving newlines.
 * Used by `stripCommentsAndStrings` to blank out comment/string content while
 * keeping line structure intact so line numbers remain correct.
 */
function suppressCharacter(character: string): string {
  return character === '\n' ? '\n' : ' ';
}

/**
 * A character that legitimately terminates an opening tag name: whitespace, the
 * tag close `>`, or the self-close `/`. Empty string (end of source) also counts
 * so a trailing `<script` at EOF still matches. Used to ensure `<script` matches
 * the real element and not `<scripting>` / `<scriptlet>`.
 */
function isTagNameBoundary(value: string): boolean {
  return value === '' || value === '>' || value === '/' || /\s/.test(value);
}

export function stripCommentsAndStrings(source: string): string {
  // We do a single linear pass using a state machine rather than multiple
  // regex replacements so that overlapping / nested patterns don't interact.
  // The output buffer is built character-by-character, replacing non-newline
  // characters in suppressed regions with a space.

  type State =
    | 'template' // Svelte template content (outside <script>)
    | 'script' // Inside <script ...> ... </script>
    | 'html-comment' // Inside <!-- ... -->
    | 'block-comment' // Inside /* ... */ (script only)
    | 'line-comment' // Inside // ... \n (script only)
    | 'string-single' // Inside '...' (script only)
    | 'string-double' // Inside "..." (script only)
    | 'string-template'; // Inside `...` (script only)

  // returnState tracks which state to resume after exiting a comment.
  // html-comment can appear in both 'template' and 'script' contexts; we must
  // return to whichever one we came from, not unconditionally to 'template'.
  // block-comment and line-comment only appear in 'script', but we track the
  // same way for consistency and future safety.
  type ReturnableState = 'template' | 'script';
  let returnState: ReturnableState = 'template';

  let state: State = 'template';
  let output = '';
  let index = 0;
  const length = source.length;

  const peek = (offset: number) => source[index + offset] ?? '';
  const current = () => source[index] ?? '';

  const suppress = suppressCharacter;

  while (index < length) {
    const character = current();

    switch (state) {
      case 'template': {
        // Detect start of HTML comment <!-- (applies in template AND inside script tags' text content)
        if (character === '<' && peek(1) === '!' && peek(2) === '-' && peek(3) === '-') {
          // Enter html-comment — emit the opening <!-- suppressed.
          // Record 'template' as the state to return to when --> is found.
          returnState = 'template';
          output += suppress('<') + suppress('!') + suppress('-') + suppress('-');
          index += 4;
          state = 'html-comment';
          break;
        }
        // Detect <script (transition to script mode after the closing >)
        if (
          character === '<' &&
          peek(1) === 's' &&
          peek(2) === 'c' &&
          peek(3) === 'r' &&
          peek(4) === 'i' &&
          peek(5) === 'p' &&
          peek(6) === 't' &&
          isTagNameBoundary(peek(7))
        ) {
          // Emit the <script...> tag verbatim (we need to find the closing >)
          output += character;
          index++;
          // Scan forward until we find the closing > of the <script> open tag,
          // then switch to 'script' state.
          while (index < length && current() !== '>') {
            output += current();
            index++;
          }
          if (index < length) {
            output += current(); // emit the >
            index++;
          }
          state = 'script';
          break;
        }
        // Detect </script> — switch back to template
        if (
          character === '<' &&
          peek(1) === '/' &&
          peek(2) === 's' &&
          peek(3) === 'c' &&
          peek(4) === 'r' &&
          peek(5) === 'i' &&
          peek(6) === 'p' &&
          peek(7) === 't' &&
          peek(8) === '>'
        ) {
          output += '</script>';
          index += 9;
          state = 'template';
          break;
        }
        // Normal template character — emit verbatim
        output += character;
        index++;
        break;
      }

      case 'script': {
        // Detect <!-- comment start (can appear in script text? unlikely but safe)
        if (character === '<' && peek(1) === '!' && peek(2) === '-' && peek(3) === '-') {
          // Record 'script' as the state to return to when --> is found.
          returnState = 'script';
          output += suppress('<') + suppress('!') + suppress('-') + suppress('-');
          index += 4;
          state = 'html-comment';
          break;
        }
        // Detect </script> — switch back to template
        if (
          character === '<' &&
          peek(1) === '/' &&
          peek(2) === 's' &&
          peek(3) === 'c' &&
          peek(4) === 'r' &&
          peek(5) === 'i' &&
          peek(6) === 'p' &&
          peek(7) === 't' &&
          peek(8) === '>'
        ) {
          output += '</script>';
          index += 9;
          state = 'template';
          break;
        }
        // Detect block comment /*
        if (character === '/' && peek(1) === '*') {
          output += suppress('/') + suppress('*');
          index += 2;
          state = 'block-comment';
          break;
        }
        // Detect line comment //
        if (character === '/' && peek(1) === '/') {
          output += suppress('/') + suppress('/');
          index += 2;
          state = 'line-comment';
          break;
        }
        // Detect string literals
        if (character === "'") {
          output += suppress("'");
          index++;
          state = 'string-single';
          break;
        }
        if (character === '"') {
          output += suppress('"');
          index++;
          state = 'string-double';
          break;
        }
        if (character === '`') {
          output += suppress('`');
          index++;
          state = 'string-template';
          break;
        }
        // Normal script character — emit verbatim
        output += character;
        index++;
        break;
      }

      case 'html-comment': {
        // Looking for -->
        if (character === '-' && peek(1) === '-' && peek(2) === '>') {
          output += suppress('-') + suppress('-') + suppress('>');
          index += 3;
          // Restore the state we were in before entering this comment.
          // returnState was set to 'template' or 'script' when we entered html-comment,
          // so we correctly resume whichever context the comment appeared in.
          state = returnState;
          break;
        }
        // Suppress the character, keep newlines
        output += suppress(character);
        index++;
        break;
      }

      case 'block-comment': {
        // Looking for */
        if (character === '*' && peek(1) === '/') {
          output += suppress('*') + suppress('/');
          index += 2;
          state = 'script';
          break;
        }
        output += suppress(character);
        index++;
        break;
      }

      case 'line-comment': {
        // End at newline
        if (character === '\n') {
          output += '\n';
          index++;
          state = 'script';
          break;
        }
        output += suppress(character);
        index++;
        break;
      }

      case 'string-single': {
        if (character === '\\') {
          // Escape sequence — suppress both chars
          output += suppress(character) + suppress(peek(1));
          index += 2;
          break;
        }
        if (character === "'") {
          output += suppress("'");
          index++;
          state = 'script';
          break;
        }
        output += suppress(character);
        index++;
        break;
      }

      case 'string-double': {
        if (character === '\\') {
          output += suppress(character) + suppress(peek(1));
          index += 2;
          break;
        }
        if (character === '"') {
          output += suppress('"');
          index++;
          state = 'script';
          break;
        }
        output += suppress(character);
        index++;
        break;
      }

      case 'string-template': {
        if (character === '\\') {
          output += suppress(character) + suppress(peek(1));
          index += 2;
          break;
        }
        if (character === '`') {
          output += suppress('`');
          index++;
          state = 'script';
          break;
        }
        // Note: we do NOT descend into ${...} template expressions — this is a
        // deliberate simplification. A `<button>` inside a ${} would be suppressed
        // along with the surrounding template literal, which is acceptable: if
        // someone is building a raw button tag string in a template expression it is
        // not a rendered native control.
        output += suppress(character);
        index++;
        break;
      }
    }
  }

  return output;
}

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
 *
 * The `g` flag is required: `detectAllRawControls` calls `.exec()` in a loop to
 * find every occurrence on a line.
 */
export const RAW_CONTROL_PATTERN = /<(button|input|select|textarea)(?=[\s\t\r\n>/]|$)/g;

/** All tag names this guard enforces. */
export const RAW_CONTROL_TAG_NAMES: RawControlTagName[] = ['button', 'input', 'select', 'textarea'];

/**
 * Returns ALL raw native-control opening tags found on a single line, each with
 * the matched tag name and 0-based column index of the `<` character.
 *
 * Returns an empty array if no raw controls are present.
 *
 * Pure — no I/O. Exported for unit tests.
 */
export function detectAllRawControls(
  line: string,
): Array<{ tagName: RawControlTagName; columnIndex: number }> {
  const results: Array<{ tagName: RawControlTagName; columnIndex: number }> = [];
  // Reset lastIndex before using the global regex.
  RAW_CONTROL_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = RAW_CONTROL_PATTERN.exec(line)) !== null) {
    results.push({
      tagName: match[1] as RawControlTagName,
      columnIndex: match.index,
    });
  }
  return results;
}

/**
 * Test whether a single source line contains a raw native control opening tag.
 * Returns the matched tag name, or `null` if no raw control is present.
 *
 * NOTE: only returns the FIRST match. Use `detectAllRawControls` when you need
 * all matches on a line. This function is kept for backward compatibility with
 * tests that check single-detection semantics.
 *
 * Pure — no I/O. Exported for unit tests.
 */
export function detectRawControl(line: string): RawControlTagName | null {
  const matches = detectAllRawControls(line);
  return matches[0]?.tagName ?? null;
}

/** Normalize a path to forward slashes for cross-platform stability. */
export function toPosixPath(path: string): string {
  return path.replaceAll('\\', '/');
}

// ── Inline Allow-Marker ───────────────────────────────────────────────────────

/**
 * The inline allow marker syntax.
 * A line (or the line above a raw control) may contain this marker to exempt
 * ALL raw controls on that line from being flagged.
 *
 * Format: `<!-- examples-audit-allow: <reason> -->`
 * The reason is required (non-empty after trimming).
 *
 * Examples:
 *   <button bind:this={el}>…</button> <!-- examples-audit-allow: triggerRef needs native element -->
 *
 *   <!-- examples-audit-allow: forwards spread attrs from parent snippet -->
 *   <button type="button" {...attrs}>…</button>
 */
export const INLINE_ALLOW_MARKER = /<!--\s*examples-audit-allow\s*:\s*(.+?)\s*-->/;

/**
 * Returns the reason string from an inline allow marker in `line`, or `null` if
 * the marker is not present OR the reason is empty/whitespace-only.
 *
 * A whitespace-only reason is treated the same as no reason — the docs require
 * a non-empty rationale. `<!-- examples-audit-allow:    -->` returns null and
 * leaves the control flagged.
 *
 * Pure — no I/O. Exported for unit tests.
 */
export function extractInlineAllowReason(line: string): string | null {
  const match = INLINE_ALLOW_MARKER.exec(line);
  if (!match) return null;
  const reason = match[1]?.trim() ?? '';
  return reason.length > 0 ? reason : null;
}

// ── Allowlist Key ─────────────────────────────────────────────────────────────

/**
 * Build the allowlist lookup key: `relativePath::tagName::occurrenceIndex`.
 * This is stable across line-number drift (unrelated edits above don't break it)
 * and catches both file moves (path changes) and structural refactors (occurrence
 * count changes).
 */
export function allowlistKey(
  relativePath: string,
  tagName: RawControlTagName,
  occurrenceIndex: number,
): string {
  return `${toPosixPath(relativePath)}::${tagName}::${occurrenceIndex}`;
}

/**
 * Build a fast lookup set from the allowlist array.
 * Pure — no I/O. Exported for unit tests.
 */
export function buildAllowlistIndex(entries: AllowlistEntry[]): Set<string> {
  const index = new Set<string>();
  for (const entry of entries) {
    index.add(allowlistKey(entry.relativePath, entry.tagName, entry.occurrenceIndex));
  }
  return index;
}

// ── Scanning ──────────────────────────────────────────────────────────────────

/** Sort occurrences for stable output: alphabetical file then ascending line number. */
function sortOccurrences(items: RawControlOccurrence[]): RawControlOccurrence[] {
  return items.toSorted(
    (a, b) => a.relativePath.localeCompare(b.relativePath) || a.lineNumber - b.lineNumber,
  );
}

/**
 * Scan all `*.example.svelte` files under `examplesDirectory` for raw native
 * controls, partitioning them into allowlisted and flagged occurrences.
 *
 * Exemption hierarchy (checked in order):
 *  1. Inline allow-marker on the control's line, or on the line immediately above.
 *  2. ALLOWLIST entry matching relativePath + tagName + occurrenceIndex.
 *
 * Comment/string stripping is applied before scanning so that raw controls inside
 * HTML/Svelte comments, JS block/line comments, and JS string literals are not
 * reported. Line numbers in the result always refer to the ORIGINAL (unstripped)
 * source.
 *
 * After scanning, any ALLOWLIST entries that did not match any occurrence are
 * collected in `staleAllowlistEntries` — the caller should report these.
 *
 * Exported so unit tests can call it with a fixture directory.
 */
export async function scan(
  examplesDirectory: string,
  allowlist: AllowlistEntry[] = ALLOWLIST,
): Promise<ScanResult> {
  const allowlistIndex = buildAllowlistIndex(allowlist);
  const matchedAllowlistKeys = new Set<string>();
  const allowlisted: RawControlOccurrence[] = [];
  const flagged: RawControlOccurrence[] = [];

  const glob = new Glob('**/*.example.svelte');
  for await (const relativePath of glob.scan({ cwd: examplesDirectory })) {
    const posixPath = toPosixPath(relativePath);
    const filePath = join(examplesDirectory, relativePath);
    const rawSource = await Bun.file(filePath).text();
    const strippedSource = stripCommentsAndStrings(rawSource);

    // Split BOTH sources into lines so we can reference the original text for
    // display while scanning the stripped text for detection.
    const originalLines = rawSource.split('\n');
    const strippedLines = strippedSource.split('\n');

    // Per-file occurrence counters: how many times each tagName has been detected
    // so far in this file (in document order). Used to compute occurrenceIndex.
    const occurrenceCounts: Partial<Record<RawControlTagName, number>> = {};

    for (let lineIndex = 0; lineIndex < strippedLines.length; lineIndex++) {
      const lineNumber = lineIndex + 1;
      const strippedLine = strippedLines[lineIndex] ?? '';
      const originalLine = originalLines[lineIndex] ?? '';

      const matches = detectAllRawControls(strippedLine);
      if (matches.length === 0) continue;

      // Check for an inline allow-marker on this line or the line immediately above.
      const markerOnSameLine = extractInlineAllowReason(originalLine);

      // A previous-line marker only covers THIS line when it sits on its own —
      // i.e. line N-1 carries the marker but no raw control of its own. If line
      // N-1 also had a raw control, its marker was a SAME-LINE marker scoped to
      // N-1 and must not bleed its exemption down onto line N.
      const previousStrippedLine = lineIndex > 0 ? (strippedLines[lineIndex - 1] ?? '') : '';
      const previousLineHasOwnControl =
        lineIndex > 0 && detectAllRawControls(previousStrippedLine).length > 0;
      const markerOnPreviousLine =
        lineIndex > 0 && !previousLineHasOwnControl
          ? extractInlineAllowReason(originalLines[lineIndex - 1] ?? '')
          : null;
      const inlineAllowReason = markerOnSameLine ?? markerOnPreviousLine;

      for (const { tagName, columnIndex } of matches) {
        const currentIndex = occurrenceCounts[tagName] ?? 0;
        occurrenceCounts[tagName] = currentIndex + 1;

        const occurrence: RawControlOccurrence = {
          relativePath: posixPath,
          lineNumber,
          columnIndex,
          tagName,
          lineText: originalLine.trim(),
        };

        // Inline marker exempts ALL controls on the covered line(s).
        if (inlineAllowReason !== null) {
          allowlisted.push(occurrence);
          continue;
        }

        // Check the ALLOWLIST array.
        const key = allowlistKey(posixPath, tagName, currentIndex);
        if (allowlistIndex.has(key)) {
          matchedAllowlistKeys.add(key);
          allowlisted.push(occurrence);
        } else {
          flagged.push(occurrence);
        }
      }
    }
  }

  // Collect stale entries: ALLOWLIST entries that never matched any occurrence.
  const staleAllowlistEntries = allowlist.filter(
    (entry) =>
      !matchedAllowlistKeys.has(
        allowlistKey(entry.relativePath, entry.tagName, entry.occurrenceIndex),
      ),
  );

  return {
    allowlisted: sortOccurrences(allowlisted),
    flagged: sortOccurrences(flagged),
    staleAllowlistEntries,
  };
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
    report += `  Allowlisted (intentional — documented in ALLOWLIST or inline marker): ${result.allowlisted.length}\n`;
    report += renderOccurrenceList(result.allowlisted);
    report += '\n';
  }

  if (result.staleAllowlistEntries.length > 0) {
    report += `\n  Stale allowlist entries (no longer match any raw control): ${result.staleAllowlistEntries.length}\n`;
    for (const entry of result.staleAllowlistEntries) {
      report += `    ${entry.relativePath}  <${entry.tagName}>  occurrence #${entry.occurrenceIndex}  — ${entry.reason}\n`;
    }
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
    if (result.staleAllowlistEntries.length > 0) {
      process.stdout.write(
        `  (report-only) ${result.staleAllowlistEntries.length} stale allowlist entr${result.staleAllowlistEntries.length === 1 ? 'y' : 'ies'} above — remove them from ALLOWLIST.\n`,
      );
    }
    return;
  }

  // Strict mode: exit non-zero if any flagged (non-allowlisted) raw controls remain,
  // or if any stale allowlist entries are present.
  const strictFailures: string[] = [];

  if (result.flagged.length > 0) {
    strictFailures.push(
      `  ${result.flagged.length} non-allowlisted raw native control${result.flagged.length === 1 ? '' : 's'} found.\n` +
        `  Replace each with the Cinder equivalent (Button, Checkbox, Select, Textarea, Input),\n` +
        `  or add an exemption via an inline <!-- examples-audit-allow: <reason> --> marker\n` +
        `  or an ALLOWLIST entry in scripts/check-raw-native-controls.ts.`,
    );
  }

  if (result.staleAllowlistEntries.length > 0) {
    strictFailures.push(
      `  ${result.staleAllowlistEntries.length} stale allowlist entr${result.staleAllowlistEntries.length === 1 ? 'y' : 'ies'} — remove from ALLOWLIST in scripts/check-raw-native-controls.ts.`,
    );
  }

  if (strictFailures.length > 0) {
    process.stderr.write(`examples:audit (strict) — failures:\n${strictFailures.join('\n')}\n`);
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
