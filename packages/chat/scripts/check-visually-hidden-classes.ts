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

/** A `test/` directory segment — `files` excludes every `test/` directory under `dist` the same way. */
const TEST_DIRECTORY_PATTERN = /(?:^|\/)test\//;

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
  //
  // The same field excludes every `test/` directory under `dist`, so
  // `src/lib/test/` — the package's established home for test helpers — is
  // exempt for the same reason: a helper there never reaches the tarball.
  if (FIXTURE_PATH_PATTERN.test(relativePath)) return true;
  if (TEST_DIRECTORY_PATTERN.test(toPosixPath(relativePath))) return true;
  // Any extension chain after `.test.`/`.spec.` counts: a Svelte rune test
  // module is `widget.test.svelte.ts`, and the package's `files` field
  // excludes every `dist/**/*.test.*` artifact the same way.
  return /\.(?:test|spec)\.(?:[\w-]+\.)*(?:[cm]?[jt]sx?|svelte|css)$/.test(relativePath);
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
    // A template literal is blanked whole, placeholders included: the walk
    // in `stringLiteralEnd` steps over a nested literal inside `${...}`, so
    // the nested backtick is not mistaken for the outer literal's closer.
    const end = stringLiteralEnd(source, index);
    const last = source[end - 1] ?? '';
    const closed = end > index + 1 && (last === character || last === '\n');
    output +=
      character + blank(source.slice(index + 1, closed ? end - 1 : end)) + (closed ? last : '');
    index = end;
  }
  return output;
}

/**
 * Blanks regular-expression literals the same way `maskStringLiterals` blanks
 * strings — delimiters kept, contents spaced out, offsets preserved — while
 * leaving string literals VISIBLE, so the class-shaped-literal pass can run
 * over the result and still see `'sr-only'` in code but not in
 * `/classNames\('sr-only'\)/`. The walk steps over strings without touching
 * them, which is also what stops a `/` inside a string from being read as a
 * regex delimiter.
 *
 * A regex literal is only recognised where an expression can START (after
 * `(`, `,`, `=`, `=>`, `:`, `[`, `!`, `&`, `|`, `?`, `{`, `;`, `return`, a
 * `}` that closes a block, or at the very beginning), so `a / b / c` is
 * division and stays visible — as does `{ valueOf() {...} } / 2`, where the
 * `}` closes an object literal. The heuristic is the classic one every
 * non-parsing tokenizer uses; it is exactly as good as it needs to be for the
 * two consumers here.
 */
export function maskRegexLiterals(source: string): string {
  let output = '';
  let index = 0;
  while (index < source.length) {
    const character = source[index] ?? '';
    if (character === '"' || character === "'" || character === '`') {
      const end = stringLiteralEnd(source, index);
      output += source.slice(index, end);
      index = end;
      continue;
    }
    if (character !== '/' || !regexCanStartAt(output, source[index + 1])) {
      output += character;
      index += 1;
      continue;
    }
    output += character;
    index += 1;
    let inClass = false;
    while (index < source.length) {
      const inner = source[index] ?? '';
      if (inner === '\n') break;
      if (inner === '\\') {
        output += '  ';
        index += 2;
        continue;
      }
      if (inner === '[') inClass = true;
      else if (inner === ']') inClass = false;
      else if (inner === '/' && !inClass) {
        output += inner;
        index += 1;
        break;
      }
      output += ' ';
      index += 1;
    }
  }
  return output;
}

/**
 * Whether a `/` followed by `next` can open a regex literal given `before`,
 * the text already walked (with whatever the caller has masked so far, so a
 * quoted `}` or `=` has no say). A trailing `}` is the one ambiguous case:
 * after a block statement an expression starts, after an object literal an
 * operator does, and which it was depends on what opened the brace.
 */
function regexCanStartAt(
  before: string,
  next: string | undefined,
  from: number = before.length - 1,
): boolean {
  if (next === '/' || next === '*' || next === undefined) return false;
  // Walk back to the last significant character instead of copying and
  // trimming the whole prefix: this runs for every `/` in a file, and the
  // prefix grows with the file, which made a large component quadratic.
  // `from` lets a caller point at a position inside `before` rather than
  // slicing a prefix out of it for the same reason.
  let end = from;
  while (end >= 0 && /\s/.test(before[end] ?? '')) end -= 1;
  if (end < 0) return true;
  const last = before[end];
  // These two need real context — the matching `{` or `(` — but only a `/`
  // written directly after a brace or paren reaches them, which is rare.
  if (last === '}') return !closesObjectLiteral(before.slice(0, end + 1));
  if (last === ')') return closesControlFlowCondition(before.slice(0, end + 1));
  // Everything else is decided by the handful of characters before the
  // slash, so only that window is tested. It starts one character early so
  // the keyword test's `[^\w$]` boundary sees the real neighbour rather than
  // the window's edge.
  const start = Math.max(0, end - KEYWORD_WINDOW_LENGTH);
  const window = before.slice(start, end + 1);
  if (/(?:[(,=:[!&|?{;]|=>)$/.test(window)) return true;
  return /(?:^|[^\w$])(?:return|throw|typeof|case|do|else|in|of|yield|await)$/.test(window);
}

/**
 * How far back {@link regexCanStartAt} looks for an expression-start keyword.
 * The longest is `typeof` at six characters; the window is generous enough
 * that the boundary character before the keyword is always inside it.
 */
const KEYWORD_WINDOW_LENGTH = 32;

/**
 * Whether the `}` that ends `text` closes an object literal. The matching
 * `{` is found on the string-masked text; it opened an object literal when
 * an expression was expected there — after `(`, `,`, `=`, `:`, `[`, an
 * operator, or `return`-like keywords. An `=>` is NOT in that list: `=> {`
 * opens an arrow body, and an arrow returning an object needs `=> ({`.
 */
function closesObjectLiteral(text: string): boolean {
  const masked = maskStringLiterals(text);
  let depth = 0;
  let index = masked.length - 1;
  for (; index >= 0; index--) {
    if (masked[index] === '}') depth++;
    else if (masked[index] === '{') {
      depth--;
      if (depth === 0) break;
    }
  }
  if (index < 0) return false;
  const opener = masked.slice(0, index).replace(/\s+$/, '');
  return /(?:[(,=:[!&|?]|(?:^|[^\w$])(?:return|typeof|case|in|of|yield|await))$/.test(opener);
}

/**
 * Whether the `)` that ends `text` closes the condition of an `if`, `while`,
 * `for`, or `with` statement. A statement follows such a condition, so an
 * expression — and therefore a regex literal — can start right after it:
 * `if (enabled) /x/.test(value)`. After any other `)` (a call, a grouped
 * expression) an operator follows and a `/` is division.
 */
function closesControlFlowCondition(text: string): boolean {
  const masked = maskStringLiterals(text);
  let depth = 0;
  let index = masked.length - 1;
  for (; index >= 0; index--) {
    if (masked[index] === ')') depth++;
    else if (masked[index] === '(') {
      depth--;
      if (depth === 0) break;
    }
  }
  if (index < 0) return false;
  return /(?:^|[^\w$.])(?:if|while|for|with)\s*$/.test(masked.slice(0, index));
}

/** Strings and regex literals blanked together — the view a script scanner locates syntax in. */
export function maskScriptLiterals(source: string): string {
  return maskStringLiterals(maskRegexLiterals(source));
}

/**
 * Blanks every comment in a file while stepping over string literals, so a
 * comment delimiter quoted in code (`const open = '/*'`, or `'<!--'`) cannot
 * open a comment that swallows the real class literal between it and the
 * next quoted closer. Which delimiters count depends on where the text sits:
 * markup has only HTML comments, a `<script>` block only JavaScript ones, a
 * `<style>` block only CSS ones. A single walk over the file tracks which of
 * the three it is in, so an HTML comment cannot be opened from inside a
 * script string and a `<script>` written inside an HTML comment does not
 * start a script block. Every walker preserves length and newlines, so
 * offsets into the masked text are offsets into the original.
 *
 * A file the caller knows to be a stylesheet or a script never enters the
 * markup walk; a snippet with no language and no tag at all is treated as
 * script, matching `splitSourceRegions`' own inference.
 */
export function maskComments(source: string, language?: SourceLanguage): string {
  if (language === 'css') return maskCssComments(source);
  if (language === 'script') return maskScriptComments(source);
  if (language === undefined && !/<(?:[a-zA-Z][\s\S]*>|!--)/.test(source))
    return maskScriptComments(source);

  let output = '';
  let cursor = 0;
  for (const block of findBlockElements(source)) {
    output += maskMarkupComments(source.slice(cursor, block.start));
    const inner = source.slice(block.innerStart, block.innerEnd);
    output +=
      source.slice(block.start, block.innerStart) +
      (block.tag === 'script' ? maskScriptComments(inner) : maskCssComments(inner)) +
      source.slice(block.innerEnd, block.end);
    cursor = block.end;
  }
  return output + maskMarkupComments(source.slice(cursor));
}

/**
 * Blanks `<!-- ... -->` comments in a markup segment. A `{...}` expression is
 * copied through untouched: its quotes are JavaScript strings, so a `'<!--'`
 * inside one is text, not a comment opener.
 */
function maskMarkupComments(markup: string): string {
  let output = '';
  let index = 0;
  while (index < markup.length) {
    if (markup.startsWith('<!--', index)) {
      const end = markup.indexOf('-->', index + 4);
      const stop = end === -1 ? markup.length : end + 3;
      output += blank(markup.slice(index, stop));
      index = stop;
      continue;
    }
    if (markup[index] === '{') {
      const length = balancedExpressionLength(markup, index);
      output += markup.slice(index, index + length);
      index += length;
      continue;
    }
    output += markup[index];
    index += 1;
  }
  return output;
}

/** A `<script>` or `<style>` element located by `findBlockElements`. */
type BlockElement = {
  tag: 'script' | 'style';
  /** Offset of the opening `<`. */
  start: number;
  /** Offset just past the opening tag's `>`. */
  innerStart: number;
  /** Offset of the closing tag's `<` (or the end of the source when unclosed). */
  innerEnd: number;
  /** Offset just past the closing tag (or the end of the source when unclosed). */
  end: number;
};

/**
 * Every `<script>` and `<style>` element in a Svelte file, in order. The
 * walk steps over `{...}` expressions and `<!-- -->` comments before it
 * looks for a tag, so `title={'<script>'}` and a block quoted in a comment
 * open nothing — a raw regex over the file would take the quoted text as a
 * real block and turn the production markup between two such attributes
 * into a script region. Both `maskComments` and `splitSourceRegions` use
 * this one walk so they cannot disagree about where a block is.
 */
function findBlockElements(source: string): BlockElement[] {
  const blocks: BlockElement[] = [];
  // Sticky rather than anchored-on-a-slice: this runs at every `<`, and
  // copying the rest of the file each time is what made it quadratic.
  const openPattern = /<(script|style)\b[^>]*>/y;
  let index = 0;
  while (index < source.length) {
    const character = source[index];
    if (character === '{') {
      index += balancedExpressionLength(source, index);
      continue;
    }
    if (character !== '<') {
      index += 1;
      continue;
    }
    if (source.startsWith('<!--', index)) {
      const end = source.indexOf('-->', index + 4);
      index = end === -1 ? source.length : end + 3;
      continue;
    }
    openPattern.lastIndex = index;
    const open = openPattern.exec(source);
    if (!open) {
      index += 1;
      continue;
    }
    const tag = open[1] === 'script' ? 'script' : 'style';
    const closePattern = new RegExp(`</${tag}\\s*>`, 'g');
    closePattern.lastIndex = index + open[0].length;
    const close = closePattern.exec(source);
    const innerStart = index + open[0].length;
    const innerEnd = close ? close.index : source.length;
    const end = close ? close.index + close[0].length : source.length;
    blocks.push({ tag, start: index, innerStart, innerEnd, end });
    index = end;
  }
  return blocks;
}

/**
 * Index just past the string literal that opens at `source[openIndex]`. A
 * backslash escapes the next character. A single- or double-quoted literal
 * that reaches a newline unterminated is a syntax error in both CSS and
 * JavaScript, so the walk ends there rather than treating the rest of the
 * file as text; a template literal legitimately spans lines and only ends at
 * its closing backtick.
 */
function stringLiteralEnd(source: string, openIndex: number): number {
  const quote = source[openIndex];
  const endsAtNewline = quote !== '`';
  let index = openIndex + 1;
  while (index < source.length) {
    const inner = source[index];
    if (inner === '\\') {
      index += 2;
      continue;
    }
    // A `${...}` placeholder is an expression that may hold a string of its
    // own — including another template literal — so it is stepped over as
    // a unit rather than letting its quotes end the enclosing literal.
    if (quote === '`' && inner === '$' && source[index + 1] === '{') {
      index = templatePlaceholderEnd(source, index + 1);
      continue;
    }
    index += 1;
    if (inner === quote || (endsAtNewline && inner === '\n')) break;
  }
  return Math.min(index, source.length);
}

/**
 * Index just past the `}` that closes the template placeholder whose `{` is
 * at `source[openBraceIndex]`. Braces are balanced with every nested string
 * literal stepped over (recursively, so a template inside a placeholder
 * inside a template still nests); an unterminated placeholder runs to the
 * end of the source.
 */
function templatePlaceholderEnd(source: string, openBraceIndex: number): number {
  let depth = 0;
  let index = openBraceIndex;
  // The placeholder text walked so far, with its strings blanked, so the
  // regex-start heuristic sees the same view `maskRegexLiterals` would.
  let walked = '';
  while (index < source.length) {
    const character = source[index] ?? '';
    if (character === '"' || character === "'" || character === '`') {
      const end = stringLiteralEnd(source, index);
      walked += character + blank(source.slice(index + 1, end));
      index = end;
      continue;
    }
    // A `}` inside a regex literal — `${/}/.test(value) ? 'a' : ''}` — is
    // part of the pattern, not the placeholder's closer.
    if (character === '/' && regexCanStartAt(walked, source[index + 1])) {
      const end = regexLiteralEnd(source, index);
      walked += blank(source.slice(index, end));
      index = end;
      continue;
    }
    walked += character;
    if (character === '{') depth++;
    else if (character === '}') {
      depth--;
      if (depth === 0) return index + 1;
    }
    index++;
  }
  return source.length;
}

/**
 * Index just past the regex literal that opens at `source[openIndex]`, with
 * the same escape and character-class rules `maskRegexLiterals` applies: a
 * `/` inside `[...]` does not close the literal, and a newline ends it
 * because a regex cannot span lines.
 */
function regexLiteralEnd(source: string, openIndex: number): number {
  let index = openIndex + 1;
  let inClass = false;
  while (index < source.length) {
    const inner = source[index] ?? '';
    if (inner === '\n') return index;
    if (inner === '\\') {
      index += 2;
      continue;
    }
    index += 1;
    if (inner === '[') inClass = true;
    else if (inner === ']') inClass = false;
    else if (inner === '/' && !inClass) return index;
  }
  return source.length;
}

/**
 * Blanks `//` and `/* ... *\/` comments in JavaScript or TypeScript while
 * stepping over string and regex literals, so a delimiter inside either —
 * `'/*'`, `"*\/"`, `/\/\//` — is never read as a comment boundary. A
 * `//` is only a comment outside a string, so unlike the earlier line-start
 * regex this also blanks a trailing comment while leaving `'http://x'`
 * intact.
 */
export function maskScriptComments(source: string): string {
  let output = '';
  let index = 0;
  while (index < source.length) {
    const character = source[index] ?? '';
    if (character === '"' || character === "'" || character === '`') {
      const end = stringLiteralEnd(source, index);
      output += source.slice(index, end);
      index = end;
      continue;
    }
    if (character === '/' && source[index + 1] === '/') {
      const newline = source.indexOf('\n', index);
      const stop = newline === -1 ? source.length : newline;
      output += blank(source.slice(index, stop));
      index = stop;
      continue;
    }
    if (character === '/' && source[index + 1] === '*') {
      const end = source.indexOf('*/', index + 2);
      const stop = end === -1 ? source.length : end + 2;
      output += blank(source.slice(index, stop));
      index = stop;
      continue;
    }
    if (character === '/' && regexCanStartAt(output, source[index + 1])) {
      const end = regexLiteralEnd(source, index);
      output += source.slice(index, end);
      index = end;
      continue;
    }
    output += character;
    index += 1;
  }
  return output;
}

/**
 * Blanks `/* ... *\/` comments in a stylesheet while stepping over string
 * literals, so `content: "/*"` cannot open a comment that swallows every
 * rule up to the next `content: "*\/"`. CSS has no line comments and no
 * regex literals, which is all that separates this walk from
 * `maskScriptComments`. A comment is still blanked when it contains an
 * apostrophe.
 */
export function maskCssComments(source: string): string {
  let output = '';
  let index = 0;
  while (index < source.length) {
    const character = source[index] ?? '';
    if (character === '"' || character === "'") {
      const end = stringLiteralEnd(source, index);
      output += source.slice(index, end);
      index = end;
      continue;
    }
    if (character === '/' && source[index + 1] === '*') {
      const end = source.indexOf('*/', index + 2);
      const stop = end === -1 ? source.length : end + 2;
      output += blank(source.slice(index, stop));
      index = stop;
      continue;
    }
    output += character;
    index += 1;
  }
  return output;
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
 * The separator is `[-_]+`, not just `-`, for the same reason. `sr-only_focusable`
 * is a single valid class name: with a hyphen-only separator the suffix group
 * matched nothing and the trailing `(?![\w-])` boundary then rejected the
 * underscore, so the token slipped through entirely. BEM-style
 * `sr-only--focusable` is one too, which is why the separator repeats.
 */
const BARE_TOKEN_SOURCE = String.raw`(?<![\w-])sr-only(?:[-_]+\w+)*[-_]*(?![\w-])`;

/**
 * The five characters HTML splits a class attribute on — tab, line feed,
 * form feed, carriage return, and space. Deliberately not `\s`: a
 * non-breaking space (which `&nbsp;` decodes to) is whitespace to a regex
 * but a class-name character to HTML, so `class="foo&nbsp;sr-only"` is one
 * token and applies no bare class.
 */
const HTML_ASCII_WHITESPACE = String.raw`\t\n\f\r `;

/**
 * The bare token as a whole CLASS token. HTML splits a class value on
 * whitespace only, so `focus:sr-only` and `foo.sr-only` are single tokens
 * that never apply the bare class; here the boundary is whitespace, a quote
 * (the edge of a string literal in a `classNames()` argument or a class
 * expression), or the edge of the text — not arbitrary punctuation.
 */
const CLASS_TOKEN_SOURCE = String.raw`(?<![^${HTML_ASCII_WHITESPACE}"'\`])sr-only(?:[-_]+\w+)*[-_]*(?![^${HTML_ASCII_WHITESPACE}"'\`])`;

/**
 * The bare token as a whole class token of an already-isolated VALUE — a
 * class attribute's value, a CSS attribute selector's value, or a string
 * literal's decoded content. Only HTML's own separators bound a token here:
 * a quote inside such a value is an ordinary class-name character (it can
 * only have come from an escape), not the edge of a literal.
 */
const CLASS_VALUE_TOKEN_SOURCE = String.raw`(?<![^${HTML_ASCII_WHITESPACE}])sr-only(?:[-_]+\w+)*[-_]*(?![^${HTML_ASCII_WHITESPACE}])`;

/**
 * Matches the bare token as a whole class token inside a `class` attribute
 * VALUE. The value has already been isolated by `extractTagAttributes`, so
 * this runs over `sr-only label` rather than over the whole tag — a
 * `class=sr-only` substring inside `data-example="..."` never reaches it.
 */
const CLASS_ATTRIBUTE_VALUE_TOKEN_PATTERN = new RegExp(CLASS_VALUE_TOKEN_SOURCE, 'g');

/**
 * Decodes the character references a static attribute value can carry —
 * `sr&#45;only`, `sr&#x2D;only`, `foo&#32;sr-only`, and the named
 * references HTML always recognizes. The element receives the decoded
 * class, so that is what is matched.
 */
/**
 * `String.fromCodePoint` throws on anything above U+10FFFF (and on a
 * surrogate), where CSS and HTML parsers substitute U+FFFD instead. The audit
 * follows the parsers: an out-of-range escape is a harmless oddity in the
 * source, not a reason to crash the required check.
 */
function codePointToCharacter(codePoint: number): string {
  if (!Number.isFinite(codePoint) || codePoint < 0 || codePoint > 0x10ffff) return '\ufffd';
  if (codePoint >= 0xd800 && codePoint <= 0xdfff) return '\ufffd';
  return String.fromCodePoint(codePoint);
}

const NAMED_CHARACTER_REFERENCES: Record<string, string> = {
  amp: '&',
  AMP: '&',
  lt: '<',
  LT: '<',
  gt: '>',
  GT: '>',
  quot: '"',
  QUOT: '"',
  apos: "'",
  nbsp: '\u00a0',
  NonBreakingSpace: '\u00a0',
  // The whitespace references are spelled `&Tab;` and `&NewLine;` in the HTML
  // standard — casing matters, and both decode to a real class separator.
  Tab: '\t',
  NewLine: '\n',
};
export function decodeCharacterReferences(value: string): string {
  return value.replace(
    // The semicolon is optional on a NUMERIC reference: browsers decode
    // `&#45only` to `-only`, so `class="sr&#45only"` really is the bare
    // class. A named reference without its semicolon is not decoded here,
    // matching the standard's much narrower legacy list.
    /&(?:#x([0-9a-fA-F]+);?|#([0-9]+);?|([a-zA-Z]+);)/g,
    (match: string, hex: string | undefined, decimal: string | undefined, name: string) => {
      if (hex !== undefined) return codePointToCharacter(Number.parseInt(hex, 16));
      if (decimal !== undefined) return codePointToCharacter(Number.parseInt(decimal, 10));
      return NAMED_CHARACTER_REFERENCES[name] ?? match;
    },
  );
}

/** Matches a Svelte class directive NAME: `class:sr-only` (with or without `={expr}`). */
const CLASS_DIRECTIVE_PATTERN = new RegExp(String.raw`^class:${BARE_TOKEN_SOURCE}$`);

/**
 * Matches a `class` property inside a spread object — `{...{ class: 'sr-only' }}`,
 * `{ 'class': ... }`, or the statically computed `{ ['class']: ... }`. Only
 * the property's value is scanned afterwards, so `title: 'sr-only'` in the
 * same object is not a hit.
 */
const SPREAD_CLASS_PROPERTY_PATTERN =
  /(?<![\w$.])(?:class|['"]class['"]|\[\s*['"`]class['"`]\s*\])\s*:\s*/g;

/**
 * Tells whether a `SPREAD_CLASS_PROPERTY_PATTERN` match at `index` of the raw
 * expression is a real property key, by looking at the same offset in the
 * string-masked expression: a bare `class` is a key only if it survived
 * masking (it was not inside a quoted value), and a quoted `'class'` is a key
 * only if the mask shows exactly that string literal there (an opening quote
 * followed by five blanked characters and the closing quote) rather than a
 * fragment of a longer string. A computed `['class']` key is checked the same
 * way at the quote inside its brackets.
 */
export function isSpreadClassKey(maskedExpression: string, index: number): boolean {
  if (maskedExpression[index] === '[') {
    const quoteIndex = maskedExpression.slice(index).search(/['"`]/);
    return quoteIndex > 0 && isSpreadClassKey(maskedExpression, index + quoteIndex);
  }
  const quote = maskedExpression[index];
  if (quote === "'" || quote === '"' || quote === '`') {
    return maskedExpression.slice(index, index + 7) === `${quote}     ${quote}`;
  }
  return maskedExpression.startsWith('class', index);
}

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
const CSS_SELECTOR_PATTERN = new RegExp(
  // `(?<!\\)` so `#foo\.sr-only` — where the dot is escaped INTO the id — is
  // not read as a class selector.
  String.raw`(?<!\\)\.sr-only(?:[-_]+\w+)*[-_]*(?![\w-])`,
  'g',
);

/**
 * Decodes CSS identifier escapes inside class selectors so `.sr\-only`,
 * `.sr\2d only`, and `.sr\00002donly` are matched as the `.sr-only` they
 * select. Each decoded identifier is padded with spaces back to its source
 * length, so every offset still maps onto the original text.
 */
export function decodeCssIdentifierEscapes(cssText: string): string {
  return cssText.replace(/\.(?:[\w-]|\\(?:[0-9a-fA-F]{1,6} ?|[^\n0-9a-fA-F]))+/g, (identifier) => {
    const decoded = identifier.replace(
      /\\(?:([0-9a-fA-F]{1,6}) ?|([^\n0-9a-fA-F]))/g,
      (_match, hex: string | undefined, literal: string | undefined) => {
        const character =
          hex !== undefined ? codePointToCharacter(Number.parseInt(hex, 16)) : (literal ?? '');
        // An escaped delimiter is part of the identifier, not a new selector:
        // `.foo\.sr-only` is the single class `foo.sr-only`. Decoding it to a
        // literal `.` would invent a class boundary, so anything that is not
        // a class-name character becomes one.
        return /^[\w-]$/.test(character) ? character : 'a';
      },
    );
    return decoded.padEnd(identifier.length, ' ');
  });
}

/**
 * Matches a `[class...]` attribute selector, capturing its value so the bare
 * token can be looked for inside it. `[class~="sr-only"]` (and `=`, `^=`,
 * `|=`, `*=`, `$=`) selects the same elements `.sr-only` does, so a
 * stylesheet can reintroduce a rule for the bare class through it without
 * ever writing the dot form. The value is read before string masking blanks
 * it; the match is then held to the same selector-context test as the dot
 * form, which is what rejects `content: '[class~="sr-only"]'`.
 */
const CSS_CLASS_ATTRIBUTE_SELECTOR_PATTERN =
  /\[\s*class\s*([~|^$*]?)=\s*(?:"([^"\]]*)"|'([^'\]]*)'|([^\s"'\]]+))\s*([iIsS]\s*)?\]/gi;

/**
 * Whether an attribute selector with this operator and value can select an
 * element carrying the bare class. `~=` compares whole whitespace-delimited
 * tokens and `=`/`|=` compare the whole attribute value, so all three need a
 * whole-token match — `[class~="focus:sr-only"]` selects only `focus:sr-only`.
 * `*=`, `^=`, and `$=` compare substrings of the attribute value, so any
 * occurrence of the bare token counts.
 */
function classAttributeSelectorMatches(
  operator: string,
  value: string,
  caseInsensitive: boolean,
): boolean {
  const source =
    operator === '*' || operator === '^' || operator === '$'
      ? BARE_TOKEN_SOURCE
      : CLASS_VALUE_TOKEN_SOURCE;
  // `[class~="SR-ONLY" i]` selects the `sr-only` class, so the `i` modifier
  // has to reach the token test rather than being discarded with the rest of
  // the selector's tail. The value's own CSS escapes are decoded first:
  // `[class~="sr\2d only"]` selects exactly `sr-only`.
  return new RegExp(source, caseInsensitive ? 'gi' : 'g').test(decodeCssValueEscapes(value));
}

/**
 * Decodes the CSS escapes an attribute selector's VALUE can carry. Unlike
 * {@link decodeCssIdentifierEscapes} this runs over a value already isolated
 * from its selector, so it needs no leading `.` to find one — but it keeps
 * the same length-preserving padding so offsets still map onto the source.
 */
export function decodeCssValueEscapes(value: string): string {
  const decoded = value.replace(
    /\\(?:([0-9a-fA-F]{1,6}) ?|([^\n0-9a-fA-F]))/g,
    (_match, hex: string | undefined, literal: string | undefined) =>
      hex !== undefined ? codePointToCharacter(Number.parseInt(hex, 16)) : (literal ?? ''),
  );
  return decoded.padEnd(value.length, ' ');
}

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
  // `@supports selector(.sr-only) { … }` asks the parser whether it
  // understands the selector; it styles nothing, so the `{` that follows
  // opens a rule for the selectors INSIDE it, not for this one. Only that
  // condition is excluded — a functional pseudo-class (`.sr-only:not(.x)`,
  // `[class~="sr-only"]:has(svg)`) closes parens on its way to a real rule.
  if (isInsideSupportsSelector(source, matchEnd)) return false;
  for (let index = matchEnd; index < source.length; index++) {
    const character = source[index];
    if (character === '{') return true;
    if (character === ';' || character === '}') return false;
  }
  return false;
}

/**
 * Whether the match ending at `matchEnd` sits inside the parentheses of an
 * `@supports selector(...)` condition. The opening paren is found by walking
 * back at depth zero; the condition counts only when `selector` and
 * `@supports` precede it.
 */
function isInsideSupportsSelector(source: string, matchEnd: number): boolean {
  let depth = 0;
  for (let index = matchEnd - 1; index >= 0; index--) {
    const character = source[index];
    if (character === ')') depth++;
    else if (character === '(') {
      if (depth === 0) return /@supports[\s\S]*\bselector\s*$/.test(source.slice(0, index));
      depth--;
    } else if (character === '{' || character === '}' || character === ';') return false;
  }
  return false;
}

/**
 * Whether an attribute name is HTML's `class`. Attribute names are
 * case-insensitive in HTML, so `<div CLASS="sr-only">` carries the same
 * class the lowercase spelling would.
 */
function isClassAttributeName(name: string, tagName: string): boolean {
  // Attribute names are case-insensitive on an HTML element, so
  // `<div CLASS="sr-only">` carries the class. A Svelte component's props are
  // case-SENSITIVE identifiers, so `<Widget Class="sr-only" />` is a prop
  // named `Class` and applies nothing here. Components are the capitalized
  // (or dotted, or `svelte:`-namespaced) tag names.
  return isComponentTagName(tagName) ? name === 'class' : name.toLowerCase() === 'class';
}

/** Whether a tag name names a Svelte component rather than an HTML element. */
function isComponentTagName(tagName: string): boolean {
  return /^[A-Z]/.test(tagName) || tagName.includes('.') || tagName.includes(':');
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
  // Locate calls AND balance parentheses against the literal-masked text.
  // Balancing there is what keeps a `)` inside a quoted argument —
  // `classNames(format(')'), 'sr-only')` — from closing the call early and
  // truncating the arguments before the token. Locating there is what keeps
  // `"classNames('sr-only')"` (a documented example) and
  // `/classNames\('sr-only'\)/` (a test pattern) from being read as calls at
  // all: text inside a string or a regex applies no class. Offsets are
  // preserved by the mask, so slices still come from the original source.
  const balanceSource = maskScriptLiterals(source);

  while ((match = callPattern.exec(balanceSource)) !== null) {
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

/**
 * Whether the text before a literal makes it a module specifier —
 * `import … from '…'`, `export … from '…'`, a bare `import '…'`, a dynamic
 * `import('…')`, or `require('…')`. A specifier names a module, never a DOM
 * class, however class-shaped it happens to look.
 */
export function isModuleSpecifier(prefix: string): boolean {
  return /(?:^|[^\w$])(?:from|import|require)\s*\(?\s*$/.test(prefix);
}

/**
 * Whether the text before a literal makes it a class WRITE — the argument of
 * `classList.add`/`remove`/`toggle`/`replace`, the right-hand side of a
 * `className`/`class` assignment, or the value passed to
 * `setAttribute('class', …)`. Such a literal IS the class list the element
 * receives, whatever else it contains: HTML splits it on whitespace, so
 * `'state(active) sr-only'` applies the bare class even though the other
 * token is nothing a class-shaped literal would carry.
 */
export function isClassWriteArgument(prefix: string): boolean {
  return (
    /(?:^|[^\w$])classList\s*\.\s*(?:add|remove|toggle|replace)\s*\(\s*(?:["'`][^"'`]*["'`]\s*,\s*)*$/.test(
      prefix,
    ) ||
    /(?:^|[^\w$])(?:class(?:Name)?|classList\s*\.\s*value)\s*(?:\+?=)\s*$/.test(prefix) ||
    /(?:^|[^\w$])setAttribute\s*\(\s*["'`]class["'`]\s*,\s*$/i.test(prefix)
  );
}

/**
 * Blanks TypeScript declarations that are erased at compile time — `type X =
 * …` and `interface X { … }` — so a string LITERAL TYPE inside one is not
 * read as an applied class. Length is preserved, so offsets still map onto
 * the original text. A `type` alias runs to the terminating `;` or newline
 * at brace depth zero; an `interface` runs to its balanced closing brace.
 */
export function maskTypeDeclarations(source: string): string {
  const masked = maskStringLiterals(source);
  let output = '';
  let index = 0;
  const pattern =
    /(?<![\w$.])(?:type\s+[A-Za-z_$][\w$]*\s*[=<]|interface\s+[A-Za-z_$][\w$]*|declare\s)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(masked)) !== null) {
    if (match.index < index) continue;
    let cursor = match.index + match[0].length;
    let depth = 0;
    for (; cursor < masked.length; cursor++) {
      const character = masked[cursor];
      if (character === '{') depth++;
      else if (character === '}') {
        depth--;
        if (depth <= 0) {
          cursor++;
          break;
        }
      } else if (depth === 0 && (character === ';' || character === '\n')) break;
    }
    output += source.slice(index, match.index) + ' '.repeat(cursor - match.index);
    index = cursor;
    pattern.lastIndex = cursor;
  }
  return maskTypeExpressions(output + source.slice(index));
}

/**
 * Blanks the erased TYPE positions that are not whole declarations: an `as`
 * or `satisfies` assertion, a parameter or variable annotation. A literal in
 * one of them is a type, never a class. Only the literal is blanked, and its
 * length is kept, so everything around it still maps onto the original text.
 *
 * A variable annotation is bounded by the `=` that starts its initializer; a
 * parameter annotation by the `,` or `)` that ends it. An object literal's
 * `key: 'value'` is a VALUE and is deliberately not matched — it is a
 * property, not an annotation, and the two are told apart by what encloses
 * them, which is why only annotations inside a parameter list qualify. A
 * class member's type annotation is spelled exactly like an object literal's
 * property, so it is not matched either: without a parser the two cannot be
 * separated, and the safe direction is to keep reporting a class that might
 * really be applied rather than to stop reporting one that is.
 */
function maskTypeExpressions(source: string): string {
  const masked = maskStringLiterals(source);
  let output = '';
  let index = 0;
  // `as`/`satisfies` take a type directly; a `(name: 'literal'` is a
  // parameter annotation; a `const name: 'literal'` a variable one.
  const pattern = new RegExp(
    [
      // `value as 'sr-only'`, `value satisfies 'sr-only'`
      String.raw`(?<![\w$.])(?:as|satisfies)\s+`,
      // a parameter annotation, `(cls: 'sr-only')`
      String.raw`[(,]\s*[A-Za-z_$][\w$]*\??\s*:\s*`,
      // a variable annotation, `const cls: 'sr-only'`
      String.raw`(?<![\w$.])(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*:\s*`,
      // a return type, `function f(): 'sr-only'`
      String.raw`\)\s*:\s*`,
      // a generic constraint or default, `<T extends 'sr-only'>`
      String.raw`(?<![\w$.])extends\s+`,
      String.raw`<[^<>=]*=\s*`,
    ].join('|') + String.raw`(["'\`])`,
    'g',
  );
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(masked)) !== null) {
    const quoteIndex = match.index + match[0].length - 1;
    if (quoteIndex < index) continue;
    const end = stringLiteralEnd(masked, quoteIndex);
    output += source.slice(index, quoteIndex) + ' '.repeat(end - quoteIndex);
    index = end;
    pattern.lastIndex = end;
  }
  return output + source.slice(index);
}

/** Scans one file's text for bare `sr-only`-prefixed class usage sites. */
/** A lexical region of a Svelte file. Plain `.ts`/`.css` files are one `code` region. */
export type SourceRegion = {
  kind: 'markup' | 'script' | 'style' | 'code';
  start: number;
  text: string;
};

/** The language a scanned file is known to be, from its extension. */
export type SourceLanguage = 'svelte' | 'css' | 'script';

/** Maps a file path to the language the scanner should assume for it. */
export function languageForPath(path: string): SourceLanguage | undefined {
  if (path.endsWith('.svelte')) return 'svelte';
  if (path.endsWith('.css')) return 'css';
  if (/\.[cm]?[jt]sx?$/.test(path)) return 'script';
  return undefined;
}

/**
 * Splits a source file into `<script>`, `<style>`, and markup regions.
 *
 * This exists because a single set of regexes over a whole Svelte file cannot
 * be right, and three rounds of review found three separate proofs of that:
 * an apostrophe in ordinary prose (`don't`) read as a string delimiter and
 * masked the rest of the file, hiding a real selector; a markup example
 * stored in a script string reported a violation that does not exist; and a
 * `}` inside a class expression closed the expression early.
 *
 * Each matcher is only meaningful in one kind of region. Class attributes and
 * directives are markup. Selectors are CSS. `classNames()` is script. Running
 * every matcher everywhere is what produced both the false positives and the
 * false negatives, so the fix is to stop doing that rather than to add
 * another compensating heuristic.
 *
 * When the caller knows the language from the file extension it says so, and
 * a `.css` file is one `style` region no matter what its values contain — an
 * inline SVG data URL is HTML-looking text inside a CSS string, not markup,
 * and guessing from contents would have skipped the selector scan for the
 * whole file. Only a caller with no extension to go on (a unit test handing
 * over a snippet) falls back to inference: `markup` if the snippet looks like
 * markup, otherwise `code`, where every matcher runs.
 */
export function splitSourceRegions(source: string, language?: SourceLanguage): SourceRegion[] {
  if (language === 'css') return [{ kind: 'style', start: 0, text: source }];
  if (language === 'script') return [{ kind: 'script', start: 0, text: source }];
  const regions: SourceRegion[] = [];
  let cursor = 0;

  for (const block of findBlockElements(source)) {
    if (block.start > cursor)
      regions.push({ kind: 'markup', start: cursor, text: source.slice(cursor, block.start) });
    regions.push({
      kind: block.tag,
      start: block.innerStart,
      text: source.slice(block.innerStart, block.innerEnd),
    });
    cursor = block.end;
  }

  if (regions.length === 0) {
    if (language === 'svelte') return [{ kind: 'markup', start: 0, text: source }];
    const looksLikeMarkup = /<[a-zA-Z][\s\S]*>/.test(source);
    return [{ kind: looksLikeMarkup ? 'markup' : 'code', start: 0, text: source }];
  }

  if (cursor < source.length)
    regions.push({ kind: 'markup', start: cursor, text: source.slice(cursor) });
  return regions;
}

/**
 * Returns the span of every opening tag in a markup region, from `<` through
 * its closing `>`. Attributes only exist inside opening tags, so the
 * attribute and directive matchers run over these spans and nothing else —
 * rendered documentation such as `<code>class="sr-only"</code>` is text, and
 * text applies no class.
 *
 * Walking the tag by hand rather than with a regex is what lets a `>` inside
 * a quoted attribute value or a `class={a > b ? ...}` expression stay inside
 * the tag. Brace balancing runs against a string-masked copy so a brace in a
 * quoted string cannot close the expression early.
 *
 * A `{...}` expression met between tags is text as far as the DOM is
 * concerned — `<code>{`<span class="sr-only">`}</code>` renders the tag as
 * characters — so the walk steps over it without looking for tags inside.
 * The one exception is `{@html ...}`, whose string IS injected as markup, so
 * a tag inside it is a real element and is scanned like any other.
 */
export function extractOpeningTagSpans(text: string): Array<{ start: number; text: string }> {
  const spans: Array<{ start: number; text: string }> = [];
  const tagStartPattern = /^<[a-zA-Z][\w:.-]*/;
  let index = 0;
  while (index < text.length) {
    const character = text[index];
    if (character === '{') {
      if (/^\{\s*@html\b/.test(text.slice(index, index + 8))) {
        // The expression's strings are injected as markup, so tags inside
        // them are real elements — but the expression is still JavaScript, and
        // its comments and regex bodies render nothing. Walk a copy with those
        // blanked (both maskers preserve length, so offsets still line up) and
        // leave the string literals intact.
        const length = balancedExpressionLength(text, index);
        const inner = text.slice(index, index + length);
        // The `{@html` prefix is blanked first so the maskers see an
        // expression start: a regex literal is legal as the very first token,
        // and `@html` is not a name a regex could follow.
        const expression = inner.replace(/^\{\s*@html\b/, (match) => ' '.repeat(match.length));
        for (const span of extractOpeningTagSpans(
          maskRegexLiterals(maskScriptComments(expression)),
        )) {
          spans.push({ start: index + span.start, text: span.text });
        }
        index += length;
        continue;
      }
      index += balancedExpressionLength(text, index);
      continue;
    }
    if (character !== '<') {
      index++;
      continue;
    }
    const match = tagStartPattern.exec(text.slice(index));
    if (!match) {
      index++;
      continue;
    }
    const start = index;
    index += match[0].length;
    while (index < text.length) {
      const inner = text[index];
      if (inner === '>') break;
      if (inner === '"' || inner === "'") {
        const close = text.indexOf(inner, index + 1);
        index = close === -1 ? text.length : close + 1;
        continue;
      }
      if (inner === '{') {
        index += balancedExpressionLength(text, index);
        continue;
      }
      index++;
    }
    spans.push({ start, text: text.slice(start, index + 1) });
    index++;
  }
  return spans;
}

/** One attribute (or spread) read out of an opening tag by `extractTagAttributes`. */
export type TagAttribute =
  | { kind: 'attribute'; name: string; value: string; valueStart: number; quoted: boolean }
  | { kind: 'expression'; name: string; expression: string; expressionStart: number }
  | { kind: 'boolean'; name: string }
  | { kind: 'spread'; expression: string; expressionStart: number };

/**
 * Length of the balanced `{...}` starting at `text[openBraceIndex]`, braces
 * included. Balanced on the literal-masked text, so neither a `}` in a
 * quoted string nor one in a regex literal (`/}/.test(value)`) can close the
 * expression early.
 */
function balancedExpressionLength(text: string, openBraceIndex: number): number {
  // `{/if}` and `{/each}` close a Svelte block: that `/` opens no regex.
  const lead = BLOCK_CLOSER_PATTERN.exec(text.slice(openBraceIndex, openBraceIndex + 16))?.[0]
    .length;
  if (lead !== undefined) return lead;
  // Scanned in place rather than by masking a copy of everything that
  // follows: this runs at every `{` in a file, and slicing plus masking the
  // whole remainder each time made a large component quadratic. Strings and
  // regex literals are stepped over as units, which is what the mask was for.
  let depth = 0;
  let index = openBraceIndex;
  for (; index < text.length; index++) {
    const character = text[index] ?? '';
    if (character === '"' || character === "'" || character === '`') {
      index = stringLiteralEnd(text, index) - 1;
      continue;
    }
    if (character === '/' && regexCanStartAt(text, text[index + 1], index - 1)) {
      index = regexLiteralEnd(text, index) - 1;
      continue;
    }
    if (character === '{') depth++;
    else if (character === '}') {
      depth--;
      if (depth === 0) break;
    }
  }
  return index - openBraceIndex + 1;
}

const BLOCK_CLOSER_PATTERN = /^\{\s*\/[a-z]+\s*\}/;

/**
 * Number of `{` object-literal openers still open at `text[index]`, ignoring
 * `(` and `[` groups. Run it over a string-masked copy: a brace inside a
 * quoted value is not an opener.
 */
export function enclosingObjectLiterals(text: string, index: number): number {
  const stack: string[] = [];
  for (let position = 0; position < index; position++) {
    const character = text[position];
    if (character === '{' || character === '(' || character === '[') stack.push(character);
    else if (character === '}' || character === ')' || character === ']') stack.pop();
  }
  return stack.filter((opener) => opener === '{').length;
}

/**
 * Reads an opening tag attribute by attribute: `name="value"`, `name='value'`,
 * `name=value`, `name={expression}`, a bare boolean `name`, and a Svelte
 * `{...spread}`. Each value is returned on its own, with its offset into the
 * tag text, so a matcher can look at the value of the attribute actually
 * named `class` and nothing else — `data-example="class=sr-only"` is data,
 * not a class.
 */
export function extractTagAttributes(tagText: string): TagAttribute[] {
  const attributes: TagAttribute[] = [];
  const tagName = /^<[a-zA-Z][\w:.-]*/.exec(tagText);
  let index = tagName ? tagName[0].length : 1;
  const end = tagText.endsWith('>') ? tagText.length - 1 : tagText.length;

  while (index < end) {
    const character = tagText[index] ?? '';
    if (/\s|\//.test(character)) {
      index++;
      continue;
    }

    if (character === '{') {
      const length = balancedExpressionLength(tagText, index);
      const inner = tagText.slice(index + 1, index + length - 1);
      const spread = /^\s*\.\.\./.exec(inner);
      if (spread)
        attributes.push({
          kind: 'spread',
          expression: inner.slice(spread[0].length),
          expressionStart: index + 1 + spread[0].length,
        });
      index += length;
      continue;
    }

    const nameMatch = /^[^\s=/>{]+/.exec(tagText.slice(index, end));
    if (!nameMatch) {
      index++;
      continue;
    }
    const name = nameMatch[0];
    index += name.length;

    const equals = /^\s*=\s*/.exec(tagText.slice(index, end));
    if (!equals) {
      attributes.push({ kind: 'boolean', name });
      continue;
    }
    index += equals[0].length;

    const opener = tagText[index] ?? '';
    if (opener === '"' || opener === "'") {
      // A quoted value can interpolate, and the expression may use the same
      // quote: `class="foo {enabled ? "sr-only" : ""}"` is valid Svelte. So
      // the closing quote is found by walking, stepping over each balanced
      // `{…}` rather than taking the first quote that appears.
      let close = -1;
      for (let cursor = index + 1; cursor < end; cursor++) {
        const valueCharacter = tagText[cursor];
        if (valueCharacter === '{') {
          cursor += balancedExpressionLength(tagText, cursor) - 1;
          continue;
        }
        if (valueCharacter === opener) {
          close = cursor;
          break;
        }
      }
      const valueEnd = close === -1 ? end : close;
      attributes.push({
        kind: 'attribute',
        name,
        value: tagText.slice(index + 1, valueEnd),
        valueStart: index + 1,
        quoted: true,
      });
      index = close === -1 ? end : close + 1;
      continue;
    }

    if (opener === '{') {
      const length = balancedExpressionLength(tagText, index);
      attributes.push({
        kind: 'expression',
        name,
        expression: tagText.slice(index + 1, index + length - 1),
        expressionStart: index + 1,
      });
      index += length;
      continue;
    }

    const unquoted = /^[^\s>]*/.exec(tagText.slice(index, end));
    const value = unquoted?.[0] ?? '';
    attributes.push({ kind: 'attribute', name, value, valueStart: index, quoted: false });
    index += Math.max(value.length, 1);
  }

  return attributes;
}

/**
 * Matches a string literal whose whole content is a class list — tokens made
 * of class-name characters separated by whitespace, with nothing that would
 * make it prose, a selector, or markup (`,`, `<`, `{`, `;`, ...). A script
 * that computes a class through a variable, `const hiddenClass = condition ?
 * 'sr-only' : ''` followed by `class={hiddenClass}`, applies the class just
 * as surely as a `classNames()` call does, and the markup scan sees only the
 * identifier. Scanning class-shaped literals catches that without tracing
 * assignments, while a CSS-looking `'.sr-only {'` or a markup example
 * `"<span class='sr-only'>"` still stays inert. Template placeholders are
 * dropped before the shape test so `` `${base} sr-only` `` still qualifies.
 */
const CLASS_LIST_LITERAL_SHAPE = /^[\w\s:\-/.[\]%#!@]*$/;

/**
 * A class-shaped literal that is the argument of a DOM *read* — `classList.
 * contains('sr-only')`, `matches(...)`, `getElementsByClassName(...)` — asks
 * whether a class is present rather than putting it on an element, so it is
 * not a usage site. `classList.add(...)` and friends are writes and are not
 * in this list on purpose.
 */
const DOM_READ_CALL_PATTERN =
  /(?:contains|matches|closest|querySelector|querySelectorAll|getElementsByClassName)\s*\(\s*["'`]?\.?$/;

/**
 * An expression that reads an element's current class value: `className`,
 * `classList.value`, or `getAttribute('class')`. Comparing one of these to a
 * literal (`node.className === 'sr-only'`, in either order) or asking it a
 * string question (`className.includes('sr-only')`) inspects a class that is
 * already there; it applies nothing. A plain `=` is not in the comparison
 * set on purpose — `node.className = 'sr-only'` is a write.
 */
const CLASS_VALUE_READ_SOURCE = String.raw`(?:className|classList\s*\.\s*value|getAttribute\s*\(\s*["']class["']\s*\))`;
const CLASS_VALUE_COMPARISON_PREFIX_PATTERN = new RegExp(
  String.raw`${CLASS_VALUE_READ_SOURCE}\s*[!=]==?\s*["'\`]?\.?$`,
);
const CLASS_VALUE_STRING_READ_PATTERN = new RegExp(
  String.raw`${CLASS_VALUE_READ_SOURCE}\s*\.\s*(?:includes|indexOf|startsWith|endsWith)\s*\(\s*["'\`]?\.?$`,
);
const CLASS_VALUE_COMPARISON_SUFFIX_PATTERN = new RegExp(
  String.raw`^\.?["'\`]?\s*[!=]==?\s*(?:[\w$]+\s*\??\.\s*)*${CLASS_VALUE_READ_SOURCE}`,
);

/**
 * Whether a literal — given the text before it and, optionally, the text
 * after it — is a DOM read rather than an applied class: the argument of a
 * read call (`matches('.sr-only')` counts, so a bare token inside the
 * literal may be asked about too) or one side of a class-value comparison.
 */
export function isDomReadArgument(prefix: string, suffix = ''): boolean {
  return (
    DOM_READ_CALL_PATTERN.test(prefix) ||
    CLASS_VALUE_COMPARISON_PREFIX_PATTERN.test(prefix) ||
    CLASS_VALUE_STRING_READ_PATTERN.test(prefix) ||
    CLASS_VALUE_COMPARISON_SUFFIX_PATTERN.test(suffix)
  );
}
/**
 * Replaces every `${...}` placeholder with a single space, balancing braces
 * so a placeholder that contains its own object or arrow body —
 * `` `${condition ? classes({ active: true }) : ''} sr-only` `` — is removed
 * whole. A `[^}]*` regex stopped at the inner object's first `}`, left
 * punctuation behind, and failed the shape test for the entire literal, so
 * the token after it was never seen. Braces are counted on the string-masked
 * placeholder so a `}` inside a nested quote cannot end it early. Offsets
 * inside the result are NOT preserved (the token position is what matters,
 * and it moves left by the placeholder's length), so callers report the
 * literal's start, which is unaffected.
 */
export function blankTemplatePlaceholders(content: string): string {
  let output = '';
  let index = 0;
  for (const placeholder of templatePlaceholders(content)) {
    output += content.slice(index, placeholder.start - 2) + ' ';
    index = placeholder.start + placeholder.text.length + 1;
  }
  return output + content.slice(index);
}

const STRING_ESCAPE_PATTERN =
  /\\(?:u\{([0-9A-Fa-f]+)\}|u([0-9A-Fa-f]{4})|x([0-9A-Fa-f]{2})|\r\n|[\s\S])/g;
const SIMPLE_ESCAPES: Readonly<Record<string, string>> = {
  n: '\n',
  t: '\t',
  r: '\r',
  v: '\v',
  f: '\f',
  b: '\b',
  '0': '\0',
};

/**
 * Decodes the escape sequences of a string literal's content the way the
 * JavaScript runtime would, so `'foo\\nsr-only'` is seen as the two class
 * tokens it produces rather than one token glued to an `n`. The result is
 * padded with trailing spaces back to the input's length: an escape is never
 * shorter than what it decodes to, and keeping the length means an offset
 * into the decoded text still lands on the same line of the original. A
 * line continuation (backslash-newline) decodes to nothing; an unknown
 * escape decodes to the escaped character itself.
 */
export function decodeStringEscapes(content: string): string {
  const decoded = content.replace(
    STRING_ESCAPE_PATTERN,
    (
      match: string,
      braced: string | undefined,
      unicode: string | undefined,
      hex: string | undefined,
    ) => {
      const code = braced ?? unicode ?? hex;
      if (code !== undefined) {
        const codePoint = Number.parseInt(code, 16);
        return codePoint <= 0x10ffff ? codePointToCharacter(codePoint) : match;
      }
      const escaped = match.slice(1);
      if (escaped === '\n' || escaped === '\r\n' || escaped === '\r') return '';
      return SIMPLE_ESCAPES[escaped] ?? escaped;
    },
  );
  return decoded + ' '.repeat(Math.max(0, content.length - decoded.length));
}

/**
 * Decodes the escapes of every string literal inside a JavaScript expression
 * in place — each literal's content is replaced by its decoded, same-length
 * form, and a template literal's placeholders are left untouched because
 * they are code, not text. Offsets into the result are offsets into the
 * input.
 */
export function decodeExpressionStringEscapes(expression: string): string {
  let output = '';
  let index = 0;
  while (index < expression.length) {
    const quote = expression[index] ?? '';
    if (quote !== '"' && quote !== "'" && quote !== '`') {
      output += quote;
      index += 1;
      continue;
    }
    const end = stringLiteralEnd(expression, index);
    const closed = end > index + 1 && expression[end - 1] === quote;
    const content = expression.slice(index + 1, closed ? end - 1 : end);
    output += quote + decodeTemplateTextEscapes(content, quote === '`') + (closed ? quote : '');
    index = end;
  }
  return output;
}

/** Decodes escapes in a literal's text segments only, leaving `${...}` placeholders as written. */
function decodeTemplateTextEscapes(content: string, isTemplate: boolean): string {
  if (!isTemplate) return decodeStringEscapes(content);
  let output = '';
  let index = 0;
  for (const placeholder of templatePlaceholders(content)) {
    const placeholderEnd = placeholder.start + placeholder.text.length + 1;
    output +=
      decodeStringEscapes(content.slice(index, placeholder.start - 2)) +
      content.slice(placeholder.start - 2, placeholderEnd);
    index = placeholderEnd;
  }
  return output + decodeStringEscapes(content.slice(index));
}

/**
 * Every `${...}` placeholder body inside a template literal's content, with
 * the offset of the body's first character. Braces are balanced on the
 * string-masked content so a `}` inside a nested quote cannot end the
 * placeholder early; an unterminated placeholder runs to the end.
 */
export function templatePlaceholders(content: string): Array<{ start: number; text: string }> {
  const placeholders: Array<{ start: number; text: string }> = [];
  let index = 0;
  while (index < content.length) {
    if (content[index] !== '$' || content[index + 1] !== '{') {
      index += 1;
      continue;
    }
    // `templatePlaceholderEnd` balances braces with strings and regex
    // literals stepped over — the same walk `stringLiteralEnd` uses to
    // find the outer literal's closer, so the two can never disagree about
    // where a placeholder ends.
    const closerEnd = templatePlaceholderEnd(content, index + 1);
    const end =
      closerEnd === content.length && content[closerEnd - 1] !== '}' ? closerEnd : closerEnd - 1;
    placeholders.push({ start: index + 2, text: content.slice(index + 2, end) });
    index = end + 1;
  }
  return placeholders;
}

/** An `{@html identifier}` tag — the one markup form that follows a script binding. */
const HTML_REFERENCE_PATTERN = /\{\s*@html\s+(?:\(\s*)*([A-Za-z_$][\w$]*)(?:\s*\))*\s*\}/g;

/**
 * Every `const`, `let`, or `var` in a script whose initializer is a single
 * string literal, with the literal's content and where that content starts.
 * A type annotation between the name and the `=` is stepped over. The walk
 * runs on the regex-masked text so a declaration-shaped sequence inside a
 * regex is not mistaken for one, but reads the literal from the original so
 * its content survives. Only declarations at the top level of the text are
 * returned — see the scope note inside.
 */
export function extractStringBindings(
  text: string,
): Array<{ name: string; content: string; contentStart: number }> {
  const bindings: Array<{ name: string; content: string; contentStart: number }> = [];
  // The optional TypeScript annotation is matched as "anything up to the
  // `=`", not as a whitelist of type characters: `const html: string | null =`
  // and `const html: Record<string, string>[] =` are both ordinary
  // declarations, and a narrow character class silently stopped following
  // them. `[^=;\n]` keeps the match on one declaration.
  // A declaration OR a later assignment: `let html = '…'` followed by
  // `html = '<span class="sr-only">…'` injects the second string, so both
  // are recorded and both are scanned. The `(?<![\w$.])` keeps a property
  // write (`node.html = …`) from registering as the binding `html`, and the
  // `(?<![=!<>+\-*/%&|^])=(?!=)` pair keeps a comparison or an arrow from
  // reading as an assignment.
  const declarationPattern =
    /(?<![\w$.])(?:(?:const|let|var)\s+)?([A-Za-z_$][\w$]*)\s*(?::[^=;\n]+)?(?<![=!<>+\-*/%&|^])=(?!=)\s*(?=["'`])/g;
  // Declarations are located on a view with the strings blanked, so
  // declaration-shaped TEXT inside a string (a doc comment's example) cannot
  // register a binding — or shadow the real one. The literal each surviving
  // declaration opens is still read from the original source.
  const masked = maskStringLiterals(maskRegexLiterals(text));
  // Only a top-level declaration can be what the markup refers to: a
  // binding inside a function or block is out of scope there, so it is
  // neither registered nor allowed to shadow the top-level one. Depth is
  // counted on the fully masked text so a brace in a literal is not a scope.
  const structure = masked;
  let depth = 0;
  let structureCursor = 0;
  let declaration: RegExpExecArray | null;
  while ((declaration = declarationPattern.exec(masked)) !== null) {
    for (; structureCursor < declaration.index; structureCursor++) {
      if (structure[structureCursor] === '{') depth++;
      else if (structure[structureCursor] === '}') depth--;
    }
    if (depth !== 0) continue;
    const openIndex = declaration.index + declaration[0].length;
    const end = stringLiteralEnd(text, openIndex);
    const closed = end > openIndex + 1 && text[end - 1] === text[openIndex];
    if (!closed) continue;
    bindings.push({
      name: declaration[1] ?? '',
      content: text.slice(openIndex + 1, end - 1),
      contentStart: openIndex + 1,
    });
  }
  return bindings;
}

const CLASS_LIST_TOKEN_PATTERN = new RegExp(
  String.raw`(?<=^|[${HTML_ASCII_WHITESPACE}])sr-only(?:[-_]+\w+)*[-_]*(?=[${HTML_ASCII_WHITESPACE}]|$)`,
  'g',
);

/** Scans one file's text for bare `sr-only`-prefixed class usage sites. */
export function scanSource(
  original: string,
  language?: SourceLanguage,
): Array<{ lineNumber: number; line: string }> {
  const hits: Array<{ lineNumber: number; line: string }> = [];
  const masked = maskComments(original, language);
  const lines = original.split('\n');
  const record = (index: number): void => {
    const lineNumber = masked.slice(0, index).split('\n').length;
    hits.push({ lineNumber, line: (lines[lineNumber - 1] ?? '').trim() });
  };

  // `{@html x}` injects whatever string `x` holds as real markup, so when
  // `x` is bound to a string literal in a script region of this file, the
  // literal's tags are elements of this component and are scanned like the
  // ones written inline. Only a binding that resolves statically to one
  // literal is followed; anything computed is opaque to a text scanner.
  const regions = splitSourceRegions(masked, language);
  // Every literal a name is bound to, not just the last: a declaration and a
  // later reassignment are both strings `{@html name}` can inject.
  const htmlBindings = new Map<string, Array<{ content: string; offset: number }>>();
  for (const region of regions) {
    if (region.kind !== 'script' && region.kind !== 'code') continue;
    for (const binding of extractStringBindings(region.text)) {
      const bound = htmlBindings.get(binding.name) ?? [];
      bound.push({ content: binding.content, offset: region.start + binding.contentStart });
      htmlBindings.set(binding.name, bound);
    }
  }

  const scanMarkup = (region: string, regionOffset: number): void => {
    for (const span of extractOpeningTagSpans(region))
      scanOpeningTag(span.text, regionOffset + span.start);
    // `{@const cls = 'sr-only'}` declares a value in the markup itself, and
    // `<span class={cls}>` then applies it. The body is JavaScript, so it is
    // scanned as the script region it effectively is — which is what already
    // catches the same declaration written in a `<script>` block.
    for (let cursor = 0; cursor < region.length; ) {
      const brace = region.indexOf('{', cursor);
      if (brace === -1) break;
      const length = balancedExpressionLength(region, brace);
      const prefix = /^\{\s*@const\b/.exec(region.slice(brace, brace + 12));
      if (prefix)
        scanScript(
          region.slice(brace + prefix[0].length, brace + length - 1),
          regionOffset + brace + prefix[0].length,
        );
      cursor = brace + Math.max(length, 1);
    }
    HTML_REFERENCE_PATTERN.lastIndex = 0;
    let reference: RegExpExecArray | null;
    while ((reference = HTML_REFERENCE_PATTERN.exec(region)) !== null) {
      for (const binding of htmlBindings.get(reference[1] ?? '') ?? []) {
        // The binding's escapes are decoded first:
        // `'<span class="sr\u002donly">'` renders the bare class. The decode
        // preserves length, so the spans it yields still point at the source.
        const content = decodeStringEscapes(binding.content);
        for (const span of extractOpeningTagSpans(content))
          scanOpeningTag(span.text, binding.offset + span.start);
      }
    }
  };

  // A `class={...}` expression and a spread's `class:` property value are
  // JavaScript, so quotes inside them ARE string delimiters. Only a quoted
  // literal carrying the token counts — `class={hiddenClass}` routes through
  // a variable, which the script scan's class-shaped-literal pass catches.
  //
  // A quoted token that is the argument of a DOM read —
  // `class={node.classList.contains('sr-only') ? 'selected' : ''}` — asks
  // whether some OTHER element has the class; only the branches can land on
  // this one. The script pass already exempts those reads, and the same
  // filter applies here for the same reason.
  const scanClassExpression = (rawExpression: string, offset: number): void => {
    // Comments and regex bodies are masked first: neither
    // `condition /* 'sr-only' */ ? 'selected' : ''` nor
    // `/'sr-only'/.test(value) ? 'selected' : ''` can apply anything but
    // `selected`. Both masks keep every length, so offsets still map onto
    // the original text.
    const expression = maskRegexLiterals(maskScriptComments(rawExpression));
    let index = 0;
    while (index < expression.length) {
      const quote = expression[index] ?? '';
      if (quote !== '"' && quote !== "'" && quote !== '`') {
        index += 1;
        continue;
      }
      // Each literal is delimited first and decoded second, so the class
      // tokens are looked for in the literal's runtime VALUE: `'foo\\nsr-only'`
      // carries two, and `'foo\\'sr-only'` carries the single token
      // `foo'sr-only` — the quote its escape produced is a class-name
      // character, not the edge of a literal. Decoding preserves length, so
      // the recorded offset is still the literal's own.
      const end = stringLiteralEnd(expression, index);
      const closed = end > index + 1 && expression[end - 1] === quote;
      const decoded = decodeExpressionStringEscapes(expression.slice(index, end));
      let content = decoded.slice(1, closed ? -1 : undefined);
      if (quote === '`') {
        // A placeholder is code, not value text: its own literals are scanned
        // as expressions, and it is replaced by class-name filler of the same
        // length so it neither hides nor invents a token boundary in the text
        // around it.
        let maskedContent = '';
        let cursor = 0;
        for (const placeholder of templatePlaceholders(content)) {
          const placeholderStart = placeholder.start - 2;
          const placeholderEnd = placeholder.start + placeholder.text.length + 1;
          maskedContent +=
            content.slice(cursor, placeholderStart) + 'x'.repeat(placeholderEnd - placeholderStart);
          scanClassExpression(placeholder.text, offset + index + 1 + placeholder.start);
          cursor = placeholderEnd;
        }
        content = maskedContent + content.slice(cursor);
      }
      CLASS_ATTRIBUTE_VALUE_TOKEN_PATTERN.lastIndex = 0;
      if (
        CLASS_ATTRIBUTE_VALUE_TOKEN_PATTERN.test(content) &&
        !isDomReadArgument(expression.slice(0, index), expression.slice(end))
      )
        record(offset + index);
      index = end;
    }
  };

  /**
   * Records the class tokens of every literal that an expression hands to a
   * class write. Unlike {@link scanScriptLiterals} this looks at nothing
   * else, so an ordinary value in the same expression stays inert.
   */
  const scanClassWrites = (rawExpression: string, offset: number): void => {
    const expression = maskRegexLiterals(maskScriptComments(rawExpression));
    let index = 0;
    while (index < expression.length) {
      const quote = expression[index] ?? '';
      if (quote !== '"' && quote !== "'" && quote !== '`') {
        index += 1;
        continue;
      }
      const start = index;
      const end = stringLiteralEnd(expression, start);
      index = end;
      if (end <= start + 1 || expression[end - 1] !== quote) continue;
      if (!isClassWriteArgument(expression.slice(0, start))) continue;
      const content = decodeStringEscapes(
        blankTemplatePlaceholders(expression.slice(start + 1, end - 1)),
      );
      CLASS_LIST_TOKEN_PATTERN.lastIndex = 0;
      let tokenMatch: RegExpExecArray | null;
      while ((tokenMatch = CLASS_LIST_TOKEN_PATTERN.exec(content)) !== null)
        record(offset + start + 1 + tokenMatch.index);
    }
  };

  const scanOpeningTag = (text: string, offset: number): void => {
    const tagName = /^<([^\s/>]+)/.exec(text)?.[1] ?? '';
    for (const attribute of extractTagAttributes(text)) {
      if (attribute.kind === 'spread') {
        // Only a top-level property of the spread object lands on this
        // element: `{...{ config: { class: 'sr-only' } }}` passes `config`
        // along and applies no class here. The pattern runs over the raw
        // expression so a quoted key (`{ 'class': 'sr-only' }`) is still
        // visible, and each match is checked against the string-masked
        // expression: a bare `class` must survive masking (so `class:` inside
        // a quoted value is skipped) and a quoted key must be exactly the
        // string literal `class` (so `"'class': x"` inside a larger string is
        // skipped). A match then only counts when exactly one object literal
        // encloses it — `(hidden ? { class } : {})` still qualifies, a nested
        // object or an array element does not.
        // Comments are blanked before the key walk so `{ class /* why */: … }`
        // still reads as a `class` property; the mask preserves length, so
        // every offset below still lands on the original expression.
        const commentMasked = maskScriptComments(attribute.expression);
        const maskedExpression = maskStringLiterals(commentMasked);
        SPREAD_CLASS_PROPERTY_PATTERN.lastIndex = 0;
        let property: RegExpExecArray | null;
        while ((property = SPREAD_CLASS_PROPERTY_PATTERN.exec(commentMasked)) !== null) {
          if (!isSpreadClassKey(maskedExpression, property.index)) continue;
          if (enclosingObjectLiterals(maskedExpression, property.index) !== 1) continue;
          // The property value runs to the next `,` or `}` at depth zero of
          // the string-masked expression, so a comma inside a quoted class
          // list or a nested object does not end it early.
          const valueStart = property.index + property[0].length;
          let depth = 0;
          let valueEnd = valueStart;
          for (; valueEnd < maskedExpression.length; valueEnd++) {
            const character = maskedExpression[valueEnd];
            if (character === '{' || character === '(' || character === '[') depth++;
            else if (character === '}' || character === ')' || character === ']') {
              if (depth === 0) break;
              depth--;
            } else if (character === ',' && depth === 0) break;
          }
          scanClassExpression(
            attribute.expression.slice(valueStart, valueEnd),
            offset + attribute.expressionStart + valueStart,
          );
        }
        continue;
      }

      if (attribute.kind === 'boolean') {
        if (CLASS_DIRECTIVE_PATTERN.test(attribute.name))
          record(offset + text.indexOf(attribute.name));
        continue;
      }

      if (attribute.kind === 'expression') {
        if (CLASS_DIRECTIVE_PATTERN.test(attribute.name)) {
          record(offset + text.lastIndexOf(attribute.name, attribute.expressionStart));
        } else if (isClassAttributeName(attribute.name, tagName)) {
          scanClassExpression(attribute.expression, offset + attribute.expressionStart);
        } else {
          // Another attribute's expression is not a class — `title={'sr-only'}`
          // applies nothing — but its code can still write one:
          // `onclick={() => target.classList.add('sr-only')}`.
          scanClassWrites(attribute.expression, offset + attribute.expressionStart);
        }
        continue;
      }

      if (!isClassAttributeName(attribute.name, tagName)) continue;
      // A quoted value can still interpolate: `class="foo {cond ? 'x' : ''}"`.
      // The expression is JavaScript and is scanned as such — its comments
      // apply no class, its literals can — while the surrounding text keeps
      // its own token boundaries, so each interpolation is replaced by
      // class-name filler of the same length rather than cut out (`sr-only{x}`
      // is not the bare class, and must not become one here).
      let maskedValue = '';
      let cursor = 0;
      while (cursor < attribute.value.length) {
        const brace = attribute.value.indexOf('{', cursor);
        if (brace === -1) {
          maskedValue += attribute.value.slice(cursor);
          break;
        }
        const length = balancedExpressionLength(attribute.value, brace);
        maskedValue += attribute.value.slice(cursor, brace) + 'x'.repeat(length);
        scanClassExpression(
          attribute.value.slice(brace + 1, brace + length - 1),
          offset + attribute.valueStart + brace + 1,
        );
        cursor = brace + length;
      }
      const value = decodeCharacterReferences(maskedValue);
      CLASS_ATTRIBUTE_VALUE_TOKEN_PATTERN.lastIndex = 0;
      let tokenMatch: RegExpExecArray | null;
      while ((tokenMatch = CLASS_ATTRIBUTE_VALUE_TOKEN_PATTERN.exec(value)) !== null)
        record(offset + attribute.valueStart + tokenMatch.index);
    }
  };

  const scanStyle = (text: string, offset: number): void => {
    // CSS strings are real strings, so masking is safe and necessary here:
    // `content: '.sr-only'` applies no class.
    const cssText = decodeCssIdentifierEscapes(maskStringLiterals(text));
    // A class attribute selector's value IS a string, so it is read from the
    // unmasked text and then held to the selector-context test on the masked
    // text, where a quoted selector inside a declaration is followed by `;`.
    CSS_CLASS_ATTRIBUTE_SELECTOR_PATTERN.lastIndex = 0;
    let attributeMatch: RegExpExecArray | null;
    while ((attributeMatch = CSS_CLASS_ATTRIBUTE_SELECTOR_PATTERN.exec(text)) !== null) {
      const value = attributeMatch[2] ?? attributeMatch[3] ?? attributeMatch[4] ?? '';
      const caseInsensitive = (attributeMatch[5] ?? '').trim().toLowerCase() === 'i';
      if (!classAttributeSelectorMatches(attributeMatch[1] ?? '', value, caseInsensitive)) continue;
      if (isCssSelectorContext(cssText, attributeMatch.index + attributeMatch[0].length))
        record(offset + attributeMatch.index);
    }
    CSS_SELECTOR_PATTERN.lastIndex = 0;
    let cssMatch: RegExpExecArray | null;
    while ((cssMatch = CSS_SELECTOR_PATTERN.exec(cssText)) !== null) {
      if (isCssSelectorContext(cssText, cssMatch.index + cssMatch[0].length))
        record(offset + cssMatch.index);
    }
  };

  const scanScript = (rawText: string, offset: number): void => {
    // A `type`/`interface` declaration is erased before anything runs, so a
    // string literal inside one is a TYPE, not a class: `type Legacy =
    // 'sr-only' | 'visible'` applies nothing. Blanking them keeps every
    // offset (the mask is length-preserving).
    const text = maskTypeDeclarations(rawText);
    for (const call of extractClassNamesCallArguments(text)) {
      // `classNames(/sr-only/.test(value) && 'selected')` can only apply
      // `selected`; the regex body is masked (length preserved) so only
      // string-literal contents are searched.
      const argumentsText = maskRegexLiterals(call.argumentsText);
      const tokenPattern = new RegExp(CLASS_TOKEN_SOURCE, 'g');
      let tokenMatch: RegExpExecArray | null;
      while ((tokenMatch = tokenPattern.exec(argumentsText)) !== null) {
        // `classNames(node.classList.contains('sr-only') && 'selected')`
        // reads the class off another element; only `selected` can land.
        if (isDomReadArgument(argumentsText.slice(0, tokenMatch.index))) continue;
        record(offset + call.startIndex + 1 + tokenMatch.index);
      }
    }

    scanScriptLiterals(maskRegexLiterals(text), offset);
  };

  // Class-shaped string literals anywhere in the script, so a class routed
  // through a variable is still a usage site. A class attribute or selector
  // written inside a script string is an example or a test assertion, not
  // an applied class, and fails the shape test.
  //
  // Runs over the regex-masked text so a quote inside a regex literal —
  // `/classNames\\('sr-only'\\)/` — is not mistaken for a string.
  //
  // A template literal's placeholders are expressions of their own, so a
  // class built entirely inside one — `` `${condition ? 'sr-only' : ''}` ``
  // — is scanned the same way before the placeholder is blanked for the
  // outer literal's shape test.
  //
  // Literals are located with `stringLiteralEnd`, the same walk every mask
  // uses, so a template literal nested inside a placeholder is part of the
  // outer literal rather than its closer. A placeholder's expression is
  // masked for comments and regex literals before the recursive scan, since
  // the file-level masks stepped over the whole template as one string.
  const scanScriptLiterals = (literalSource: string, offset: number): void => {
    let index = 0;
    while (index < literalSource.length) {
      const quote = literalSource[index] ?? '';
      if (quote !== '"' && quote !== "'" && quote !== '`') {
        index += 1;
        continue;
      }
      const start = index;
      const end = stringLiteralEnd(literalSource, start);
      index = end;
      if (end <= start + 1 || literalSource[end - 1] !== quote) continue;
      const literalPrefix = literalSource.slice(0, start);
      if (isDomReadArgument(literalPrefix, literalSource.slice(end))) continue;
      if (isModuleSpecifier(literalPrefix)) continue;
      const content = literalSource.slice(start + 1, end - 1);
      const contentOffset = offset + start + 1;
      if (quote === '`') {
        for (const placeholder of templatePlaceholders(content))
          scanScriptLiterals(
            maskRegexLiterals(maskScriptComments(placeholder.text)),
            contentOffset + placeholder.start,
          );
      }
      // Escapes are decoded after the placeholders are blanked, so an
      // escaped whitespace separates class tokens the way it does at runtime
      // while a placeholder's code is never read as text.
      const shape = decodeStringEscapes(blankTemplatePlaceholders(content));
      // The shape test is what separates a class list routed through a
      // variable from prose or a markup example. A literal handed straight to
      // a class write needs no such inference — it IS the class list.
      if (!CLASS_LIST_LITERAL_SHAPE.test(shape) && !isClassWriteArgument(literalPrefix)) continue;
      CLASS_LIST_TOKEN_PATTERN.lastIndex = 0;
      let tokenMatch: RegExpExecArray | null;
      while ((tokenMatch = CLASS_LIST_TOKEN_PATTERN.exec(shape)) !== null)
        record(contentOffset + tokenMatch.index);
    }
  };

  for (const region of regions) {
    if (region.kind === 'markup') scanMarkup(region.text, region.start);
    else if (region.kind === 'style') scanStyle(region.text, region.start);
    else if (region.kind === 'script') scanScript(region.text, region.start);
    else {
      // A plain `.ts` or `.css` file: no markup text to confuse the string
      // scanner, so every matcher can run safely over the whole thing.
      scanMarkup(region.text, region.start);
      scanStyle(region.text, region.start);
      scanScript(region.text, region.start);
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

/**
 * Scans every production source file under `sourceRoot` for bare
 * `sr-only`-prefixed usage: `.css`, `.svelte`, and every script extension
 * `languageForPath` knows. Script files are in the walk because a class can
 * be authored there and only BOUND in a component — `export const hidden =
 * 'sr-only'` in a `.svelte.ts` module, then `class={hidden}` — and the
 * markup scan of the component sees nothing but an identifier.
 */
export async function scan(
  sourceRoot: string = defaultSourceRoot,
): Promise<VisuallyHiddenClassFlag[]> {
  const flags: VisuallyHiddenClassFlag[] = [];
  const glob = new Glob('**/*.{css,svelte,ts,mts,cts,tsx,js,mjs,cjs,jsx}');

  for await (const relativePath of glob.scan({ cwd: sourceRoot })) {
    if (isTestPath(relativePath)) continue;
    const filePath = `src/lib/${toPosixPath(relativePath)}`;
    const source = await Bun.file(join(sourceRoot, relativePath)).text();

    for (const hit of scanSource(source, languageForPath(relativePath))) {
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
