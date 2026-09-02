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

/**
 * True for test/spec sources, which are never part of the authoring rule.
 *
 * Covers every extension the scanner actually visits, not just TypeScript:
 * a `.test.svelte` fixture or a `.test.css` file is as much a test source as
 * a `.test.ts`, and both are reachable by the walk.
 */
/**
 * Mirrors the fixture exclusions in `packages/chat/package.json`'s `files`
 * field. Update both together, or the guard and the published artifact will
 * disagree about what counts as production code.
 */
const FIXTURE_PATH_PATTERN = /(?:\.fixture\.|-fixture\.|-fixtures\.)[^/]*$/;

export function isTestPath(relativePath: string): boolean {
  // Fixtures are test-only markup, and `packages/chat/package.json` is the
  // authority on that rather than this script's opinion: its `files` field
  // excludes `!dist/**/*.fixture.*`, `!dist/**/*-fixture.*`, and
  // `!dist/**/*-fixtures.*`, and `npm pack --dry-run` confirms zero fixture
  // files reach the published tarball. Keeping this list in step with that
  // one is what makes the exemption defensible: anything the package refuses
  // to publish is not production authoring surface.
  //
  // An earlier version of this guard exempted only `*.test-fixture.svelte`,
  // on the mistaken belief that the other fixture files shipped because they
  // appear in the local `dist/` build. `dist/` is the build output; `files`
  // decides what is actually published, and it excludes them.
  if (FIXTURE_PATH_PATTERN.test(relativePath)) return true;
  return /\.(?:test|spec)\.(?:[cm]?tsx?|svelte|css)$/.test(relativePath);
}

/** Replaces every character except newlines with a space, preserving offsets. */
const blank = (match: string): string => match.replace(/[^\n]/g, ' ');

/**
 * Blanks comment spans so documentation of the prohibited form is not itself
 * flagged — `<!-- never write class="sr-only" -->` describes the rule rather
 * than breaking it, and this file's own prose would otherwise trip the guard.
 *
 * Replaces each comment character with a space and preserves newlines, so
 * every reported line number still points at the original source.
 *
 * Deliberately conservative about `//`. Only a line comment that begins its
 * own line is blanked, because a trailing `//` cannot be told from the inside
 * of a string literal without parsing, and blanking a string could hide a
 * real `class="sr-only"`. A false negative there is worse than the false
 * positive it would avoid.
 */
/**
 * Blanks the CONTENTS of string literals — double, single, and template —
 * preserving length and newlines so offsets and line numbers still line up.
 * The delimiters themselves are kept, so a quoted region remains visible as a
 * quoted region.
 *
 * Two separate findings needed this. A CSS-looking selector stored in a
 * script (`const example = '.sr-only {'`) satisfied the selector-context scan
 * at the brace inside the string, and a `)` inside a `classNames()` argument
 * (`classNames(format(')'), 'sr-only')`) unbalanced the paren tracker and
 * truncated the extracted arguments before the token. Both are "the scanner
 * cannot tell code from text", and masking is the smallest honest fix short
 * of parsing.
 *
 * Applied ONLY where quoted text should be inert. The passes that
 * deliberately look inside strings — the quoted-token and `classNames()`
 * scanners — still run against the unmasked source.
 */
export function maskStringLiterals(source: string): string {
  let output = '';
  let index = 0;
  while (index < source.length) {
    const character = source[index] ?? '';
    if (character !== '"' && character !== "'" && character !== '`') {
      output += character;
      index += 1;
      continue;
    }
    output += character;
    index += 1;
    while (index < source.length) {
      const inner = source[index] ?? '';
      if (inner === '\\') {
        output += '  ';
        index += 2;
        continue;
      }
      if (inner === character) {
        output += inner;
        index += 1;
        break;
      }
      output += inner === '\n' ? '\n' : ' ';
      index += 1;
    }
  }
  return output;
}

export function maskComments(source: string): string {
  return source
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/^[ \t]*\/\/[^\n]*/gm, blank);
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
 *
 * Suffix segments use `\w`, not `[a-zA-Z]`: digits and underscores are legal
 * in a CSS class, so `sr-only-v2` and `sr-only-legacy_2` are exactly as
 * broken as `sr-only-focusable` and must be caught the same way.
 *
 * The separator is `[-_]`, not just `-`, for the same reason. `sr-only_focusable`
 * is a single valid class name: with a hyphen-only separator the suffix group
 * matched nothing and the trailing `(?![\w-])` boundary then rejected the
 * underscore, so the token slipped through entirely.
 */
const BARE_TOKEN_SOURCE = String.raw`(?<![\w-])sr-only(?:[-_]\w+)*(?![\w-])`;

/**
 * Matches a static `class="..."` / `class='...'` attribute containing the
 * bare token.
 *
 * The `(?<![-\w:])` guard anchors the match to the attribute actually named
 * `class`. Without it any attribute whose name merely ends in `class` —
 * `data-class`, `wrapperclass`, a framework's `activeClass` — would match and
 * report a usage site that does not exist.
 */
const STATIC_CLASS_ATTRIBUTE_PATTERN = new RegExp(
  String.raw`(?<![-\w:])class\s*=\s*(["'])(?:(?!\1)[\s\S])*${BARE_TOKEN_SOURCE}(?:(?!\1)[\s\S])*\1`,
  'g',
);

/**
 * Matches an UNQUOTED class attribute value: `<span class=sr-only>`.
 *
 * Valid HTML, and valid Svelte, and invisible to the quoted matcher above —
 * which made it a silent bypass of exactly the kind this guard exists to
 * prevent. An unquoted value ends at whitespace or `>`, so the token is
 * bounded by `[^\s>]*` on either side rather than by a quote pair.
 */
const UNQUOTED_CLASS_ATTRIBUTE_PATTERN = new RegExp(
  String.raw`(?<![-\w:])class\s*=\s*(?!["'{])[^\s>]*${BARE_TOKEN_SOURCE}[^\s>]*`,
  'g',
);

/** Matches a Svelte class directive: `class:sr-only` or `class:sr-only={expr}`. */
const CLASS_DIRECTIVE_PATTERN = new RegExp(String.raw`class:${BARE_TOKEN_SOURCE}`, 'g');

/** Matches a bare token inside a quoted string literal (single, double, or template). */
const QUOTED_TOKEN_PATTERN = new RegExp(
  String.raw`(["'\`])(?:(?!\1)[\s\S])*${BARE_TOKEN_SOURCE}(?:(?!\1)[\s\S])*\1`,
  'g',
);

/**
 * Matches a `.sr-only`-prefixed CSS class selector.
 *
 * Deliberately does NOT reuse `BARE_TOKEN_SOURCE`. That source carries a
 * `(?<![\w-])` lookbehind so a bare token cannot match inside
 * `cinder-sr-only`, which is necessary where the token appears with no
 * punctuation in front of it (a class attribute, a `classNames()` argument).
 * Here the literal `\.` already does that job: `.cinder-sr-only` contains no
 * `.sr-only` substring at all. Keeping the lookbehind as well was an active
 * bug — it required the character before the dot to be a non-word character,
 * so the chained selector `.foo.sr-only` slipped past the guard entirely,
 * which is a common enough CSS shape to be a real bypass rather than a
 * theoretical one.
 */
const CSS_SELECTOR_PATTERN = new RegExp(String.raw`\.sr-only(?:[-_]\w+)*(?![\w-])`, 'g');

/**
 * True when a `.sr-only` match sits in a CSS *selector* position rather than
 * inside a declaration value, a string, or an import path.
 *
 * The pattern above runs over whole Svelte files, so it also sees things like
 * `content: '.sr-only'`, `url('./sr-only.svg')`, and TypeScript string
 * literals. None of those define or apply a class, and flagging them would
 * fail the audit over harmless text.
 *
 * The discriminator is cheap and reliable enough for CSS: a selector is
 * followed by `{` before any `;` or `}`, because a selector's job is to open
 * a rule. A declaration value is followed by `;` or `}` first. Scanning
 * forward for whichever of the three appears first therefore separates them
 * without parsing.
 */
export function isCssSelectorContext(source: string, matchEnd: number): boolean {
  for (let index = matchEnd; index < source.length; index++) {
    const character = source[index];
    if (character === '{') return true;
    if (character === ';' || character === '}') return false;
  }
  return false;
}

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
  // Balance parentheses against string-masked text so a `)` inside a quoted
  // argument — `classNames(format(')'), 'sr-only')` — cannot close the call
  // early and truncate the extracted arguments before the token. Offsets are
  // preserved by the mask, so slices still come from the original source.
  const balanceSource = maskStringLiterals(source);

  while ((match = callPattern.exec(source)) !== null) {
    const openParenIndex = match.index + match[0].length - 1;
    let depth = 0;
    let index = openParenIndex;
    for (; index < source.length; index++) {
      if (balanceSource[index] === '(') depth++;
      else if (balanceSource[index] === ')') {
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
export function scanSource(original: string): Array<{ lineNumber: number; line: string }> {
  const hits: Array<{ lineNumber: number; line: string }> = [];
  // Match against comment-blanked text, but report from the original so the
  // offending line reads as written. `maskComments` preserves offsets.
  const source = maskComments(original);
  const lines = original.split('\n');
  const lineNumberAt = (index: number): number => source.slice(0, index).split('\n').length;
  const record = (index: number): void => {
    const lineNumber = lineNumberAt(index);
    hits.push({ lineNumber, line: (lines[lineNumber - 1] ?? '').trim() });
  };

  for (const pattern of [
    STATIC_CLASS_ATTRIBUTE_PATTERN,
    UNQUOTED_CLASS_ATTRIBUTE_PATTERN,
    CLASS_DIRECTIVE_PATTERN,
  ]) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(source)) !== null) {
      record(match.index);
    }
  }

  // CSS selectors are filtered by context: the same text appears in
  // declaration values, url() paths, and script string literals, none of
  // which define or apply a class.
  // Run against string-masked text: a CSS-looking selector stored in a script
  // (`const example = '.sr-only {'`) applies no class, and its brace would
  // otherwise satisfy the selector-context scan.
  const cssSource = maskStringLiterals(source);
  CSS_SELECTOR_PATTERN.lastIndex = 0;
  let cssMatch: RegExpExecArray | null;
  while ((cssMatch = CSS_SELECTOR_PATTERN.exec(cssSource)) !== null) {
    if (isCssSelectorContext(cssSource, cssMatch.index + cssMatch[0].length))
      record(cssMatch.index);
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
  const dynamicClassAttributePattern = /(?<![-\w:])class\s*=\s*\{/g;
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
