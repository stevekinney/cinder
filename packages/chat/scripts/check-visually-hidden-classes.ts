/**
 * Visually-hidden class guard for `@lostgradient/chat`.
 *
 * Backs the CIN-505 fix: Chat marks visually-hidden content with the design
 * system's `.cinder-sr-only` utility (from `@lostgradient/cinder/styles`,
 * which every Chat consumer already imports — see `packages/chat/README.md`).
 * Chat's own source tree owns NO rule for a bare `sr-only`-prefixed class
 * (any suffix, e.g. `sr-only-focusable`), so an element carrying one renders
 * as ordinary visible text — exactly what happened to
 * `tool-call-group.svelte`'s and `conversation-export-actions.svelte`'s
 * `aria-live` status announcers before this fix, and what five other
 * components silently avoided only by each re-declaring their own private
 * copy of the same nine-line recipe.
 *
 * This script makes that class of defect mechanically impossible to
 * reintroduce. It flags a bare `sr-only`-prefixed token wherever it could
 * plausibly end up as a class on an element, across every syntax Svelte and
 * CSS offer for that:
 *   - A static class attribute: `class="sr-only"`, `class='... sr-only ...'`.
 *   - A Svelte class directive: `class:sr-only`, `class:sr-only={condition}`.
 *   - A dynamic class attribute built with this codebase's `classNames()`
 *     helper: `class={classNames('sr-only', className)}`.
 *   - A dynamic class attribute built with a template literal:
 *     `` class={`... sr-only ...`} ``.
 *   - A CSS class selector: `.sr-only {`, `.sr-only,`, `.sr-only:focus`,
 *     `.parent .sr-only`.
 *
 * There is no baseline and no `--strict` flag — unlike the raw-color/
 * token-usage/platform-feature guards in `@lostgradient/cinder`, this rule
 * has no grandfathered debt to track: the fix removed every existing site,
 * so the correct count is always zero.
 *
 * The token match requires a `sr-only` prefix (optionally followed by more
 * hyphenated segments, e.g. `sr-only-focusable`) that is NOT itself preceded
 * by another hyphenated segment — so it does NOT flag `cinder-sr-only` or
 * `cinder-sr-only-focusable` (both legitimate, Chat-reachable classes), but
 * DOES flag any other bare `sr-only*` variant, since Chat owns no CSS for any
 * of them.
 *
 * stylelint has no built-in way to flag "a specific bare class name used
 * without cinder's prefix", oxlint does not scan `.css` files at all, and
 * neither tool parses Svelte class directives or a project-specific
 * `classNames()` helper's arguments, so a scanned-source guard is the
 * simplest durable enforcement — mirroring `@lostgradient/cinder`'s
 * `check-component-css-raw-colors.ts` and `check-platform-features.ts`.
 *
 * Run via `bun run --filter=@lostgradient/chat visually-hidden:audit`; wired
 * into `validate` and into `main-green.yaml`'s "Source audits (chat)" step
 * (see `check-pipeline-coverage.ts`).
 */

import { Glob } from 'bun';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const chatRoot = resolve(scriptDirectory, '..');
const defaultSourceRoot = join(chatRoot, 'src', 'lib');

/** A single bare `sr-only`-prefixed class usage site. */
export type VisuallyHiddenClassFlag = {
  /** Source-relative POSIX path, e.g. `src/lib/components/chat/message/tool-call-group.svelte`. */
  filePath: string;
  /** 1-based line number where the bare token appears. */
  lineNumber: number;
  /** The matched line, trimmed, for the report. */
  line: string;
};

/** True for test/spec sources, which are never part of the authoring rule. */
export function isTestPath(relativePath: string): boolean {
  return /\.(?:test|spec)\.[cm]?tsx?$/.test(relativePath);
}

/** Normalizes a path to forward slashes so report output is OS-independent. */
export function toPosixPath(path: string): string {
  return path.replaceAll('\\', '/');
}

/**
 * A bare `sr-only` token, optionally extended with more hyphenated segments
 * (`sr-only-focusable`, `sr-only-anything`). The boundary on both sides
 * treats `-` as a token character, so `cinder-sr-only` and
 * `cinder-sr-only-focusable` never match — only a token that is NOT itself
 * preceded by another hyphenated segment.
 */
const BARE_TOKEN_SOURCE = String.raw`(?<![\w-])sr-only(?:-[a-zA-Z]+)*(?![\w-])`;

/** Matches a static `class="..."` / `class='...'` attribute containing the bare token. */
const STATIC_CLASS_ATTRIBUTE_PATTERN = new RegExp(
  String.raw`class\s*=\s*(["'])(?:(?!\1)[\s\S])*${BARE_TOKEN_SOURCE}(?:(?!\1)[\s\S])*\1`,
  'g',
);

/** Matches a Svelte class directive: `class:sr-only` or `class:sr-only={expr}`. */
const CLASS_DIRECTIVE_PATTERN = new RegExp(String.raw`class:${BARE_TOKEN_SOURCE}`, 'g');

/** Matches a bare token inside a quoted string literal (single, double, or template). */
const QUOTED_TOKEN_PATTERN = new RegExp(
  String.raw`(["'\`])(?:(?!\1)[\s\S])*${BARE_TOKEN_SOURCE}(?:(?!\1)[\s\S])*\1`,
  'g',
);

/** Matches a `.sr-only`-prefixed CSS class selector. */
const CSS_SELECTOR_PATTERN = new RegExp(
  String.raw`(?<![\w-])\.sr-only(?:-[a-zA-Z]+)*(?![\w-])`,
  'g',
);

/**
 * Extracts the argument text of every `classNames(...)` call in `source`,
 * using paren-depth tracking rather than a regex, so a call whose arguments
 * contain their own parens (a ternary, another function call) is still
 * extracted correctly. Returns each call's start index (of its opening
 * paren) and its argument text, so a match inside that text can be mapped
 * back to a line number in the original source.
 */
export function extractClassNamesCallArguments(
  source: string,
): Array<{ startIndex: number; argumentsText: string }> {
  const calls: Array<{ startIndex: number; argumentsText: string }> = [];
  const callPattern = /classNames\s*\(/g;
  let match: RegExpExecArray | null;

  while ((match = callPattern.exec(source)) !== null) {
    const openParenIndex = match.index + match[0].length - 1;
    let depth = 0;
    let index = openParenIndex;
    for (; index < source.length; index++) {
      if (source[index] === '(') depth++;
      else if (source[index] === ')') {
        depth--;
        if (depth === 0) break;
      }
    }
    calls.push({
      startIndex: openParenIndex,
      argumentsText: source.slice(openParenIndex + 1, index),
    });
    callPattern.lastIndex = index + 1;
  }

  return calls;
}

/** Scans one file's text for bare `sr-only`-prefixed class usage sites. */
export function scanSource(source: string): Array<{ lineNumber: number; line: string }> {
  const hits: Array<{ lineNumber: number; line: string }> = [];
  const lines = source.split('\n');
  const lineNumberAt = (index: number): number => source.slice(0, index).split('\n').length;
  const record = (index: number): void => {
    const lineNumber = lineNumberAt(index);
    hits.push({ lineNumber, line: (lines[lineNumber - 1] ?? '').trim() });
  };

  for (const pattern of [
    STATIC_CLASS_ATTRIBUTE_PATTERN,
    CLASS_DIRECTIVE_PATTERN,
    CSS_SELECTOR_PATTERN,
  ]) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(source)) !== null) {
      record(match.index);
    }
  }

  // `classNames(...)` calls: flag a bare token quoted among the arguments.
  for (const call of extractClassNamesCallArguments(source)) {
    const tokenPattern = new RegExp(BARE_TOKEN_SOURCE, 'g');
    let tokenMatch: RegExpExecArray | null;
    while ((tokenMatch = tokenPattern.exec(call.argumentsText)) !== null) {
      record(call.startIndex + 1 + tokenMatch.index);
    }
  }

  // Template-literal (or other quoted) class attribute expressions:
  // `class={`... sr-only ...`}`. Scoped to `class={` so an unrelated quoted
  // string elsewhere in the file (e.g. a test's `.contains('sr-only')`
  // assertion) is never flagged.
  const dynamicClassAttributePattern = /class\s*=\s*\{/g;
  let dynamicMatch: RegExpExecArray | null;
  while ((dynamicMatch = dynamicClassAttributePattern.exec(source)) !== null) {
    const openBraceIndex = dynamicMatch.index + dynamicMatch[0].length - 1;
    let depth = 0;
    let index = openBraceIndex;
    for (; index < source.length; index++) {
      if (source[index] === '{') depth++;
      else if (source[index] === '}') {
        depth--;
        if (depth === 0) break;
      }
    }
    const expressionText = source.slice(openBraceIndex + 1, index);
    QUOTED_TOKEN_PATTERN.lastIndex = 0;
    let quotedMatch: RegExpExecArray | null;
    while ((quotedMatch = QUOTED_TOKEN_PATTERN.exec(expressionText)) !== null) {
      record(openBraceIndex + 1 + quotedMatch.index);
    }
  }

  const seen = new Set<string>();
  return hits
    .filter((hit) => {
      const key = `${hit.lineNumber}:${hit.line}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .toSorted((a, b) => a.lineNumber - b.lineNumber);
}

/** Scans every `.svelte` and `.css` file under `sourceRoot` for bare `sr-only`-prefixed usage. */
export async function scan(
  sourceRoot: string = defaultSourceRoot,
): Promise<VisuallyHiddenClassFlag[]> {
  const flags: VisuallyHiddenClassFlag[] = [];
  const glob = new Glob('**/*.{css,svelte}');

  for await (const relativePath of glob.scan({ cwd: sourceRoot })) {
    if (isTestPath(relativePath)) continue;
    const filePath = `src/lib/${toPosixPath(relativePath)}`;
    const source = await Bun.file(join(sourceRoot, relativePath)).text();

    for (const hit of scanSource(source)) {
      flags.push({ filePath, lineNumber: hit.lineNumber, line: hit.line });
    }
  }

  return flags.toSorted(
    (a, b) => a.filePath.localeCompare(b.filePath) || a.lineNumber - b.lineNumber,
  );
}

async function main(): Promise<void> {
  const flags = await scan();

  if (flags.length === 0) {
    console.log('visually-hidden:audit — no bare `sr-only`-prefixed usage found in packages/chat.');
    return;
  }

  console.error(
    `visually-hidden:audit — found ${flags.length} bare \`sr-only\`-prefixed usage site(s).\n` +
      'Chat has no CSS rule for a bare `sr-only`-prefixed class; use `cinder-sr-only` ' +
      '(from `@lostgradient/cinder/styles`, which every Chat consumer imports) instead.\n',
  );
  for (const flag of flags) {
    console.error(`  ${flag.filePath}:${flag.lineNumber}  ${flag.line}`);
  }
  process.exit(1);
}

if (import.meta.main) {
  await main();
}
