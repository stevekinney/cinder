import { UPSTREAM_PACKAGE_NAMES } from './derive-upstream-reexports.ts';

/**
 * Shared utilities for detecting unresolved upstream-package import
 * specifiers (`@cinder/commentary`, `@lostgradient/markdown`, ...) in built
 * JS / `.d.ts` artifacts.
 *
 * Two gates use this:
 *   - `scripts/build.ts` — fast post-build residue grep that fails the build
 *     immediately if the specifier-rewrite pass missed something.
 *   - `scripts/validate-consumers.ts` — tarball grep gate that fails the
 *     publish-path validation if any reference survived into the staged pack.
 *
 * Centralizing the patterns + comment handling here means a regex update
 * applies in both places. The string-aware tokenizer below treats `/*` and
 * `//` sequences inside string or template literals as data, not comments,
 * so a line like `const x = '/* @cinder/foo *\/'; import y from "@cinder/z"`
 * still surfaces the real specifier in the trailing import.
 *
 * The patterns stay broad on the `@cinder/*` scope — any leftover
 * `@cinder/<subpath>` specifier is inherently wrong in built output, not
 * just the ones this repo currently vendors — and additionally list each
 * `UPSTREAM_PACKAGE_NAMES` entry that has moved *outside* that scope (e.g.
 * `@lostgradient/markdown`, née `@cinder/markdown` in Phase 2 of
 * docs/decisions/package-boundaries.md). A residue gate scoped to the
 * literal `@cinder/` prefix alone silently stops catching a package the
 * moment it's renamed out of that scope — which is exactly the bug this
 * gate had until Phase 2's rename exposed it.
 */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Upstream specifiers that no longer live under the broad `@cinder/*` scope. */
const upstreamSpecifiersOutsideCinderScope = Object.values(UPSTREAM_PACKAGE_NAMES).filter(
  (specifier) => !specifier.startsWith('@cinder/'),
);

const outsideCinderScopeAlternation = upstreamSpecifiersOutsideCinderScope
  .map((specifier) => `${escapeRegExp(specifier)}(?:/[^'"\`\${}]*)?`)
  .join('|');

/** `@cinder/<anything>`, or one of the upstream specifiers renamed out of that scope. */
const upstreamSpecifierPatternSource =
  outsideCinderScopeAlternation.length > 0
    ? `@cinder/[^'"\`\${}]+|(?:${outsideCinderScopeAlternation})`
    : `@cinder/[^'"\`\${}]+`;

/** Cheap substring pre-check any file-content scan should run before iterating lines. */
export function containsUpstreamSpecifier(content: string): boolean {
  return (
    content.includes('@cinder/') ||
    upstreamSpecifiersOutsideCinderScope.some((specifier) => content.includes(specifier))
  );
}

/**
 * Match a static quoted upstream-package specifier (optionally with a
 * `/<subpath>`) — single-quote, double-quote, or backtick. The
 * backreference enforces matching quote pairs so mismatched quotes don't
 * false-positive. Backtick is included because no-interpolation template
 * literals are valid dynamic-import specifiers
 * (`` import(`@lostgradient/markdown`) ``).
 */
export const STATIC_UPSTREAM_SPECIFIER_PATTERN = new RegExp(
  `(['"\`])(?:${upstreamSpecifierPatternSource})\\1`,
);

/**
 * Match a template-literal upstream specifier that interpolates — for
 * example `` import(`@cinder/commentary/${pkg}`) ``. The rewrite pass
 * cannot safely transform a computed specifier, so the gates must fail
 * loudly if one appears rather than silently shipping it.
 */
const dynamicOutsideCinderScopeAlternation = upstreamSpecifiersOutsideCinderScope
  .map((specifier) => escapeRegExp(specifier))
  .join('|');
const dynamicUpstreamSpecifierPatternSource =
  dynamicOutsideCinderScopeAlternation.length > 0
    ? `@cinder/[^\`]*\\$\\{|(?:${dynamicOutsideCinderScopeAlternation})[^\`]*\\$\\{`
    : `@cinder/[^\`]*\\$\\{`;
export const DYNAMIC_UPSTREAM_SPECIFIER_PATTERN = new RegExp(
  `\`(?:${dynamicUpstreamSpecifierPatternSource})`,
);

/** State carried across lines while walking a file for residue. */
export type CommentScanState = {
  inBlockComment: boolean;
};

/**
 * Strip JavaScript comments from `line` while preserving string and
 * template-literal content. Returns the line with comment spans replaced
 * by spaces (so column positions don't shift in a way that surprises
 * downstream pattern matching). Updates `state.inBlockComment` when a
 * `/* ` opens without a matching `*\/` on the same line.
 *
 * The tokenizer tracks five states:
 *   - normal code
 *   - inside a `'...'` single-quoted string
 *   - inside a `"..."` double-quoted string
 *   - inside a `` `...` `` template literal (including `${...}` interpolations)
 *   - inside a `/* ... *\/` block comment
 *
 * Within string and template-literal states, `/` characters are data, not
 * comment introducers — which is the bug the previous trimmed-prefix
 * approach had. Template-literal `${...}` is treated as a return to normal
 * code so quoted specifiers inside the interpolation are still scanned.
 *
 * The result substitutes a single space for each comment character so
 * pattern matching that depends on whitespace boundaries (none today, but
 * worth keeping the contract simple) behaves consistently.
 */
export function stripCommentsRespectingStrings(line: string, state: CommentScanState): string {
  let result = '';
  let index = 0;

  // Resume a block comment opened on a previous line.
  if (state.inBlockComment) {
    const close = line.indexOf('*/');
    if (close === -1) {
      // Entire line is still inside the comment.
      return ' '.repeat(line.length);
    }
    // Replace the inside-comment prefix with spaces, advance past `*/`.
    result += ' '.repeat(close + 2);
    state.inBlockComment = false;
    index = close + 2;
  }

  // Stack of template-literal contexts. Each entry tracks the nesting of
  // `${...}` braces inside that template — when the brace count returns
  // to zero, we resume the parent template literal. A simple counter
  // suffices because we don't actually parse expression content; we just
  // need to know when we re-enter the template's text portion so the next
  // `\`` closes it.
  const templateStack: number[] = [];

  while (index < line.length) {
    const ch = line[index];
    const next = line[index + 1];

    // Inside a template literal interpolation expression? Track braces so
    // we know when to return to the template's text portion, and treat
    // comment introducers as real comments (since `${...}` is code).
    if (templateStack.length > 0 && templateStack[templateStack.length - 1]! > 0) {
      if (ch === '{') {
        templateStack[templateStack.length - 1]! += 1;
        result += ch;
        index += 1;
        continue;
      }
      if (ch === '}') {
        templateStack[templateStack.length - 1]! -= 1;
        result += ch;
        index += 1;
        continue;
      }
      if (ch === "'" || ch === '"') {
        // Quoted string inside interpolation — consume to its close.
        result += ch;
        index += 1;
        while (index < line.length) {
          const innerCh = line[index];
          result += innerCh;
          if (innerCh === '\\' && index + 1 < line.length) {
            result += line[index + 1];
            index += 2;
            continue;
          }
          index += 1;
          if (innerCh === ch) break;
        }
        continue;
      }
      if (ch === '`') {
        // A nested template literal inside the interpolation expression.
        templateStack.push(0);
        result += ch;
        index += 1;
        continue;
      }
      if (ch === '/' && next === '/') {
        result += ' '.repeat(line.length - index);
        break;
      }
      if (ch === '/' && next === '*') {
        const close = line.indexOf('*/', index + 2);
        if (close === -1) {
          state.inBlockComment = true;
          result += ' '.repeat(line.length - index);
          break;
        }
        result += ' '.repeat(close + 2 - index);
        index = close + 2;
        continue;
      }
      result += ch;
      index += 1;
      continue;
    }

    // Inside a template literal text portion?
    if (templateStack.length > 0) {
      if (ch === '\\' && next !== undefined) {
        result += ch + next;
        index += 2;
        continue;
      }
      if (ch === '`') {
        templateStack.pop();
        result += ch;
        index += 1;
        continue;
      }
      if (ch === '$' && next === '{') {
        // Enter interpolation; reset the brace counter for this level.
        templateStack[templateStack.length - 1] = 1;
        result += '${';
        index += 2;
        continue;
      }
      result += ch;
      index += 1;
      continue;
    }

    // Normal code. Check for the start of a string, template, or comment.
    if (ch === "'" || ch === '"') {
      // Single- or double-quoted string. Consume until the unescaped
      // matching quote (or end of line — TypeScript/JS reject unterminated
      // strings, but we keep going to avoid hanging on malformed input).
      result += ch;
      index += 1;
      while (index < line.length) {
        const innerCh = line[index];
        result += innerCh;
        if (innerCh === '\\' && index + 1 < line.length) {
          result += line[index + 1];
          index += 2;
          continue;
        }
        index += 1;
        if (innerCh === ch) break;
      }
      continue;
    }

    if (ch === '`') {
      // Open a template literal.
      templateStack.push(0);
      result += ch;
      index += 1;
      continue;
    }

    if (ch === '/' && next === '/') {
      // Line comment — replace the rest of the line with spaces.
      result += ' '.repeat(line.length - index);
      break;
    }

    if (ch === '/' && next === '*') {
      const close = line.indexOf('*/', index + 2);
      if (close === -1) {
        // Block comment continues past end of line.
        state.inBlockComment = true;
        result += ' '.repeat(line.length - index);
        break;
      }
      // Block comment closes on the same line — replace span with spaces.
      result += ' '.repeat(close + 2 - index);
      index = close + 2;
      continue;
    }

    result += ch;
    index += 1;
  }

  return result;
}

/**
 * Decide whether a single line, after string-aware comment stripping,
 * carries a real upstream-package import specifier. Updates
 * `state.inBlockComment` to track multi-line block comments across calls.
 *
 * The caller short-circuits via `containsUpstreamSpecifier(content)` before
 * iterating the file, so the per-line cost here is only paid on files that
 * already mention one of the upstream specifiers somewhere.
 */
export function lineHasUpstreamSpecifierResidue(rawLine: string, state: CommentScanState): boolean {
  const stripped = stripCommentsRespectingStrings(rawLine, state);
  if (!containsUpstreamSpecifier(stripped)) return false;

  return (
    STATIC_UPSTREAM_SPECIFIER_PATTERN.test(stripped) ||
    DYNAMIC_UPSTREAM_SPECIFIER_PATTERN.test(stripped)
  );
}
