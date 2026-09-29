/**
 * The placeholder token grammar for one plain text run.
 *
 * `parsePlaceholderTokens` is re-exported by `template-placeholders.ts`. It
 * knows nothing about Markdown: the Markdown-aware scanner and rich-editor
 * adapters call it once per eligible text run, so a token can never span a
 * node, mark or formatting boundary.
 *
 * @module
 */

import type { PlaceholderToken } from './types.js';

const OPEN_BRACE = 0x7b;
const CLOSE_BRACE = 0x7d;
const BACKSLASH = 0x5c;
const LINE_FEED = 0x0a;
const CARRIAGE_RETURN = 0x0d;
const SPACE = 0x20;
const TAB = 0x09;

/** The CommonMark escapable ASCII punctuation set. */
const ESCAPABLE_PUNCTUATION = '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~';

function isLineEnd(code: number): boolean {
  return code === LINE_FEED || code === CARRIAGE_RETURN;
}

/** The index of the first CR or LF at or after `start`, or the text length. */
function lineEndFrom(text: string, start: number): number {
  let index = start;
  while (index < text.length && !isLineEnd(text.charCodeAt(index))) index++;
  return index;
}

/** Whether an odd number of backslashes immediately precedes `index`. */
function isEscaped(text: string, index: number): boolean {
  let count = 0;
  for (let cursor = index - 1; cursor >= 0 && text.charCodeAt(cursor) === BACKSLASH; cursor--) {
    count++;
  }
  return count % 2 === 1;
}

/**
 * Resolve CommonMark backslash escapes in placeholder token body text.
 *
 * The body is read left to right, after token boundaries are found and before
 * horizontal-whitespace trimming: a backslash immediately followed by an
 * escapable ASCII punctuation character contributes that character and
 * consumes both, so `\\_` (a backslash escaping a backslash) contributes a
 * literal `\` followed by a separately read `_`. Any other backslash,
 * including one with nothing after it, contributes itself and consumes only
 * itself. Token scanning applies this to every body; editors apply it to the
 * part of a body typed so far.
 *
 * @param body - Raw body text, or a prefix of it, as written in Markdown source.
 * @returns The text with escapes resolved.
 */
export function unescapePlaceholderBody(body: string): string {
  if (!body.includes('\\')) return body;
  let result = '';
  for (let index = 0; index < body.length; index++) {
    const char = body[index]!;
    const next = body[index + 1];
    if (char === '\\' && next !== undefined && ESCAPABLE_PUNCTUATION.includes(next)) {
      result += next;
      index++;
    } else {
      result += char;
    }
  }
  return result;
}

/** Trim only horizontal whitespace (spaces and tabs) from both ends. */
function trimHorizontal(body: string): string {
  let start = 0;
  let end = body.length;
  while (start < end && isHorizontalSpace(body.charCodeAt(start))) start++;
  while (end > start && isHorizontalSpace(body.charCodeAt(end - 1))) end--;
  return body.slice(start, end);
}

function isHorizontalSpace(code: number): boolean {
  return code === SPACE || code === TAB;
}

/**
 * The end of a malformed brace span that starts at `start`: single braces
 * are balanced until the depth returns to zero, or the span stops at the
 * line end when it never does.
 */
function balancedSpanEnd(text: string, start: number, lineEnd: number): number {
  let depth = 0;
  for (let index = start; index < lineEnd; index++) {
    const code = text.charCodeAt(index);
    if (code === OPEN_BRACE) depth++;
    else if (code === CLOSE_BRACE && --depth === 0) return index + 1;
  }
  return lineEnd;
}

function malformed(text: string, start: number, end: number, path: string): PlaceholderToken {
  return {
    raw: text.slice(start, end),
    path,
    startOffset: start,
    endOffset: end,
    kind: 'malformed',
  };
}

/** Read the token whose opening `{{` starts at `start`. */
function readToken(text: string, start: number): PlaceholderToken {
  const lineEnd = lineEndFrom(text, start);
  if (text.charCodeAt(start + 2) === OPEN_BRACE) {
    return malformed(text, start, balancedSpanEnd(text, start, lineEnd), '');
  }
  const bodyStart = start + 2;
  const close = text.indexOf('}}', bodyStart);
  const nested = text.indexOf('{{', bodyStart);
  const closeOnLine = close !== -1 && close < lineEnd;
  if (nested !== -1 && nested < lineEnd && (!closeOnLine || nested < close)) {
    return malformed(text, start, balancedSpanEnd(text, start, lineEnd), '');
  }
  if (!closeOnLine) {
    return malformed(
      text,
      start,
      lineEnd,
      trimHorizontal(unescapePlaceholderBody(text.slice(bodyStart, lineEnd))),
    );
  }
  return {
    raw: text.slice(start, close + 2),
    path: trimHorizontal(unescapePlaceholderBody(text.slice(bodyStart, close))),
    startOffset: start,
    endOffset: close + 2,
    kind: 'placeholder',
  };
}

/**
 * Parse every `{{path}}` token in one plain text run with original offsets.
 *
 * Grammar:
 * - A token is `{{`, optional spaces or tabs, a body, optional spaces or tabs
 *   and `}}`. `path` is the body without that horizontal whitespace; its
 *   format is checked by {@link validatePlaceholderTokens}, not here.
 * - Inside the body, a backslash immediately before a CommonMark-escapable
 *   ASCII punctuation character (`` !"#$%&'()*+,-./:;<=>?@[\]^_`{|}~ ``) is
 *   an escape: read left to right, it consumes both characters and
 *   contributes the punctuation character, so `\\_` (an escaped backslash)
 *   contributes `\_`. Any other backslash, including one with nothing after
 *   it, stays in the path as itself. Escapes are resolved before horizontal
 *   whitespace is trimmed and affect only path extraction: they never change
 *   where a token starts, ends, or whether it is malformed.
 * - No token spans a line ending (LF, CR or CRLF).
 * - An opening `{{` preceded by an odd number of consecutive backslashes is
 *   literal; an even number (including zero) leaves it active. This
 *   delimiter-parity rule is blind to escapes inside a body.
 * - Triple braces (`{{{`) and a nested `{{` before the closing `}}` make a
 *   `malformed` token over the balanced brace span, or up to the line end
 *   when the braces never balance. `{{{name}}}` is one malformed token.
 * - An unclosed `{{` makes a `malformed` token that stops before the line
 *   end, so later lines can still hold independent tokens.
 * - Repeated and adjacent tokens are separate tokens.
 *
 * Offsets are zero-based, end-exclusive UTF-16 indices into `text`. A
 * malformed token's `path` is the trimmed, escape-resolved text after an
 * unclosed opener, or empty for a nested or triple-brace span. Never throws.
 *
 * @param text - One plain text run; Markdown structure is not interpreted.
 * @returns Tokens in source order.
 */
export function parsePlaceholderTokens(text: string): PlaceholderToken[] {
  const tokens: PlaceholderToken[] = [];
  let position = 0;
  while (position < text.length) {
    const open = text.indexOf('{{', position);
    if (open === -1) break;
    if (isEscaped(text, open)) {
      position = open + 1;
      continue;
    }
    const token = readToken(text, open);
    tokens.push(token);
    position = token.endOffset;
  }
  return tokens;
}
