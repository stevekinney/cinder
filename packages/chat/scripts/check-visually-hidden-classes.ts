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
 * `(`, `,`, `=`, `:`, `[`, `!`, `&`, `|`, `?`, `{`, `}`, `;`, `return`, or at
 * the very beginning), so `a / b / c` is division and stays visible. The
 * heuristic is the classic one every non-parsing tokenizer uses; it is
 * exactly as good as it needs to be for the two consumers here.
 */
export function maskRegexLiterals(source: string): string {
  let output = '';
  let index = 0;
  while (index < source.length) {
    const character = source[index] ?? '';
    if (character === '"' || character === "'" || character === '`') {
      output += character;
      index += 1;
      while (index < source.length) {
        const inner = source[index] ?? '';
        output += inner;
        index += 1;
        if (inner === '\\') {
          output += source[index] ?? '';
          index += 1;
          continue;
        }
        if (inner === character) break;
      }
      continue;
    }
    if (character !== '/' || !regexCanStartAt(source, index)) {
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

function regexCanStartAt(source: string, slashIndex: number): boolean {
  const next = source[slashIndex + 1];
  if (next === '/' || next === '*' || next === undefined) return false;
  const before = source.slice(0, slashIndex).replace(/\s+$/, '');
  if (before === '') return true;
  if (/[(,=:[!&|?{};]$/.test(before)) return true;
  return /(?:^|[^\w$])(?:return|typeof|case|do|else|in|of|yield|await)$/.test(before);
}

/** Strings and regex literals blanked together — the view a script scanner locates syntax in. */
export function maskScriptLiterals(source: string): string {
  return maskStringLiterals(maskRegexLiterals(source));
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
 * Matches the bare token anywhere inside an attribute VALUE. The value has
 * already been isolated by `extractTagAttributes`, so this runs over `sr-only
 * label` rather than over the whole tag — a `class=sr-only` substring inside
 * `data-example="..."` never reaches it.
 */
const ATTRIBUTE_VALUE_TOKEN_PATTERN = new RegExp(BARE_TOKEN_SOURCE, 'g');

/** Matches a Svelte class directive NAME: `class:sr-only` (with or without `={expr}`). */
const CLASS_DIRECTIVE_PATTERN = new RegExp(String.raw`^class:${BARE_TOKEN_SOURCE}$`);

/**
 * Matches a `class` property inside a spread object — `{...{ class: 'sr-only' }}`.
 * Only the property's value is scanned afterwards, so `title: 'sr-only'` in
 * the same object is not a hit.
 */
const SPREAD_CLASS_PROPERTY_PATTERN = /(?<![\w$.])(?:class|['"]class['"])\s*:\s*/g;

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
  const blockPattern = /<(script|style)\b[^>]*>([\s\S]*?)<\/\1\s*>/g;
  const regions: SourceRegion[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = blockPattern.exec(source)) !== null) {
    if (match.index > cursor)
      regions.push({ kind: 'markup', start: cursor, text: source.slice(cursor, match.index) });
    const innerStart = match.index + match[0].indexOf('>') + 1;
    regions.push({
      kind: match[1] === 'script' ? 'script' : 'style',
      start: innerStart,
      text: match[2] ?? '',
    });
    cursor = match.index + match[0].length;
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
        index++;
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

/** Length of the balanced `{...}` starting at `text[openBraceIndex]`, braces included. */
function balancedExpressionLength(text: string, openBraceIndex: number): number {
  const balance = maskStringLiterals(text.slice(openBraceIndex));
  let depth = 0;
  let relative = 0;
  for (; relative < balance.length; relative++) {
    if (balance[relative] === '{') depth++;
    else if (balance[relative] === '}') {
      depth--;
      if (depth === 0) break;
    }
  }
  return relative + 1;
}

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
      const close = tagText.indexOf(opener, index + 1);
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
  /(?:contains|matches|closest|querySelector|querySelectorAll|getElementsByClassName)\s*\(\s*$/;
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
  const masked = maskStringLiterals(content);
  let output = '';
  let index = 0;
  while (index < content.length) {
    if (content[index] === '$' && content[index + 1] === '{') {
      let depth = 0;
      let end = index + 1;
      for (; end < content.length; end++) {
        if (masked[end] === '{') depth++;
        else if (masked[end] === '}') {
          depth--;
          if (depth === 0) break;
        }
      }
      output += ' ';
      index = end + 1;
      continue;
    }
    output += content[index];
    index++;
  }
  return output;
}

const CLASS_LIST_TOKEN_PATTERN = new RegExp(String.raw`(?<=^|\s)sr-only(?:[-_]\w+)*(?=\s|$)`, 'g');

/** Scans one file's text for bare `sr-only`-prefixed class usage sites. */
export function scanSource(
  original: string,
  language?: SourceLanguage,
): Array<{ lineNumber: number; line: string }> {
  const hits: Array<{ lineNumber: number; line: string }> = [];
  const masked = maskComments(original);
  const lines = original.split('\n');
  const record = (index: number): void => {
    const lineNumber = masked.slice(0, index).split('\n').length;
    hits.push({ lineNumber, line: (lines[lineNumber - 1] ?? '').trim() });
  };

  const scanMarkup = (region: string, regionOffset: number): void => {
    for (const span of extractOpeningTagSpans(region))
      scanOpeningTag(span.text, regionOffset + span.start);
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
  const scanClassExpression = (expression: string, offset: number): void => {
    QUOTED_TOKEN_PATTERN.lastIndex = 0;
    let quotedMatch: RegExpExecArray | null;
    while ((quotedMatch = QUOTED_TOKEN_PATTERN.exec(expression)) !== null) {
      if (DOM_READ_CALL_PATTERN.test(expression.slice(0, quotedMatch.index))) continue;
      record(offset + quotedMatch.index);
    }
  };

  const scanOpeningTag = (text: string, offset: number): void => {
    for (const attribute of extractTagAttributes(text)) {
      if (attribute.kind === 'spread') {
        // Only a top-level property of the spread object lands on this
        // element: `{...{ config: { class: 'sr-only' } }}` passes `config`
        // along and applies no class here. The pattern therefore runs over
        // the string-masked expression (so `class:` inside a quoted value is
        // blank) and a match only counts when exactly one object literal
        // encloses it — `(hidden ? { class } : {})` still qualifies, a
        // nested object or an array element does not.
        const maskedExpression = maskStringLiterals(attribute.expression);
        SPREAD_CLASS_PROPERTY_PATTERN.lastIndex = 0;
        let property: RegExpExecArray | null;
        while ((property = SPREAD_CLASS_PROPERTY_PATTERN.exec(maskedExpression)) !== null) {
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
        } else if (attribute.name === 'class') {
          scanClassExpression(attribute.expression, offset + attribute.expressionStart);
        }
        continue;
      }

      if (attribute.name !== 'class') continue;
      ATTRIBUTE_VALUE_TOKEN_PATTERN.lastIndex = 0;
      let tokenMatch: RegExpExecArray | null;
      while ((tokenMatch = ATTRIBUTE_VALUE_TOKEN_PATTERN.exec(attribute.value)) !== null)
        record(offset + attribute.valueStart + tokenMatch.index);
    }
  };

  const scanStyle = (text: string, offset: number): void => {
    // CSS strings are real strings, so masking is safe and necessary here:
    // `content: '.sr-only'` applies no class.
    const cssText = maskStringLiterals(text);
    CSS_SELECTOR_PATTERN.lastIndex = 0;
    let cssMatch: RegExpExecArray | null;
    while ((cssMatch = CSS_SELECTOR_PATTERN.exec(cssText)) !== null) {
      if (isCssSelectorContext(cssText, cssMatch.index + cssMatch[0].length))
        record(offset + cssMatch.index);
    }
  };

  const scanScript = (text: string, offset: number): void => {
    for (const call of extractClassNamesCallArguments(text)) {
      const tokenPattern = new RegExp(BARE_TOKEN_SOURCE, 'g');
      let tokenMatch: RegExpExecArray | null;
      while ((tokenMatch = tokenPattern.exec(call.argumentsText)) !== null)
        record(offset + call.startIndex + 1 + tokenMatch.index);
    }

    // Class-shaped string literals anywhere in the script, so a class routed
    // through a variable is still a usage site. A class attribute or selector
    // written inside a script string is an example or a test assertion, not
    // an applied class, and fails the shape test.
    //
    // Runs over the regex-masked text so a quote inside a regex literal —
    // `/classNames\\('sr-only'\\)/` — is not mistaken for a string.
    const literalPattern = /(["'`])((?:\\.|(?!\1)[^\\])*)\1/g;
    const literalSource = maskRegexLiterals(text);
    let literalMatch: RegExpExecArray | null;
    while ((literalMatch = literalPattern.exec(literalSource)) !== null) {
      if (DOM_READ_CALL_PATTERN.test(literalSource.slice(0, literalMatch.index))) continue;
      const content = literalMatch[2] ?? '';
      const shape = blankTemplatePlaceholders(content);
      if (!CLASS_LIST_LITERAL_SHAPE.test(shape)) continue;
      CLASS_LIST_TOKEN_PATTERN.lastIndex = 0;
      let tokenMatch: RegExpExecArray | null;
      while ((tokenMatch = CLASS_LIST_TOKEN_PATTERN.exec(shape)) !== null)
        record(offset + literalMatch.index + 1 + tokenMatch.index);
    }
  };

  for (const region of splitSourceRegions(masked, language)) {
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
  const glob = new Glob('**/*.{css,svelte,ts,mts,cts,js,mjs,cjs}');

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
