/**
 * Shared utilities for detecting unresolved `@cinder/*` import specifiers
 * in built JS / `.d.ts` artifacts.
 *
 * Two gates use this:
 *   - `scripts/build.ts` — fast post-build residue grep that fails the build
 *     immediately if the specifier-rewrite pass missed something.
 *   - `scripts/validate-consumers.ts` — tarball grep gate that fails the
 *     publish-path validation if any reference survived into the staged pack.
 *
 * Centralizing the patterns + comment handling here means a regex update
 * applies in both places; this also avoids the single-line-block-comment
 * bypass that was previously present when each call site implemented its own
 * line-by-line skip ladder.
 */

/**
 * Match a static quoted `@cinder/<subpath>` specifier — single-quote,
 * double-quote, or backtick. The backreference enforces matching quote
 * pairs so mismatched quotes don't false-positive. Backtick is included
 * because no-interpolation template literals are valid dynamic-import
 * specifiers (`` import(`@cinder/markdown`) ``).
 */
export const STATIC_CINDER_SPECIFIER_PATTERN = /(['"`])@cinder\/[^'"`${}]+\1/;

/**
 * Match a template-literal `@cinder/<...>${...}` specifier whose first
 * quasi starts with `@cinder/` and then interpolates — for example
 * `` import(`@cinder/${pkg}`) ``. The rewrite pass cannot safely transform
 * a computed specifier, so the gates must fail loudly if one appears
 * rather than silently shipping it.
 */
export const DYNAMIC_CINDER_SPECIFIER_PATTERN = /`@cinder\/[^`]*\$\{/;

/**
 * Remove every JavaScript-style comment span from a single source line
 * before pattern-testing for `@cinder/*` specifiers.
 *
 * Strips:
 *   - `//` line comments (everything from `//` to end of line).
 *   - `/* ... *\/` block comments that open and close on the same line.
 *
 * Returns the residual non-comment text. Callers still need to track
 * multi-line block-comment state via {@link CommentScanState} because
 * a `/*` without a matching `*\/` on the same line continues into
 * subsequent lines.
 *
 * The previous implementation skipped any line whose trimmed form began
 * with `/*`, even when `*\/` closed on the same line — that allowed
 * `/* ignore *\/ import x from '@cinder/markdown'` to bypass the gate.
 * This helper strips the comment span instead so the post-strip residue
 * is still pattern-tested.
 */
export function stripInlineComments(line: string): string {
  let result = '';
  let index = 0;
  while (index < line.length) {
    // `//` — strip to end of line.
    if (line[index] === '/' && line[index + 1] === '/') {
      break;
    }
    // `/* ... */` — find the close and skip the entire span. If there's
    // no close on this line, the rest of the line is part of a multi-line
    // block comment; return what we have so far.
    if (line[index] === '/' && line[index + 1] === '*') {
      const close = line.indexOf('*/', index + 2);
      if (close === -1) break;
      index = close + 2;
      continue;
    }
    result += line[index];
    index += 1;
  }
  return result;
}

/** State carried across lines while walking a file for residue. */
export type CommentScanState = {
  inBlockComment: boolean;
};

/**
 * Decide whether a single line, after comment-stripping, carries a real
 * `@cinder/*` specifier. Updates `state.inBlockComment` to track multi-line
 * block comments across calls.
 *
 * The caller short-circuits via `content.includes('@cinder/')` before
 * iterating the file, so the per-line cost here is only paid on files that
 * already mention the substring somewhere.
 */
export function lineHasCinderResidue(rawLine: string, state: CommentScanState): boolean {
  // Already inside a multi-line block comment: scan for the closing `*/`,
  // then continue with whatever follows on the same line.
  let workingLine = rawLine;
  if (state.inBlockComment) {
    const close = workingLine.indexOf('*/');
    if (close === -1) return false;
    workingLine = workingLine.slice(close + 2);
    state.inBlockComment = false;
  }

  // Skip JSDoc-style ` * ...` continuation lines outright — they always
  // sit inside a `/* ... */` span we entered on a previous line, but
  // some toolchains emit them with the leading `*` even when the parent
  // span is already closed; treating them as comment lines is the safe
  // default and matches what the previous implementation did.
  const trimmed = workingLine.trim();
  if (trimmed.startsWith('*') && !trimmed.startsWith('*/')) return false;

  // Detect an unclosed `/*` that continues onto subsequent lines. We do
  // this AFTER stripping so a same-line `/* x */ import` is still tested.
  let scanForOpener = workingLine;
  while (true) {
    const open = scanForOpener.indexOf('/*');
    if (open === -1) break;
    const close = scanForOpener.indexOf('*/', open + 2);
    if (close === -1) {
      // Unclosed on this line — set the flag and ignore the rest.
      state.inBlockComment = true;
      scanForOpener = scanForOpener.slice(0, open);
      break;
    }
    // Closed on the same line — splice the span out and keep scanning.
    scanForOpener = scanForOpener.slice(0, open) + scanForOpener.slice(close + 2);
  }

  // Strip line comments and any remaining inline `//`.
  const stripped = stripInlineComments(scanForOpener);
  if (!stripped.includes('@cinder/')) return false;

  return (
    STATIC_CINDER_SPECIFIER_PATTERN.test(stripped) ||
    DYNAMIC_CINDER_SPECIFIER_PATTERN.test(stripped)
  );
}
