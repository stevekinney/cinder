import { decodeNamedCharacterReference } from 'decode-named-character-reference';
import { decodeNumericCharacterReference } from 'micromark-util-decode-numeric-character-reference';

import { isLineEnding } from './chat-composer-mention-lines.ts';

const ABSOLUTE_URI_SCHEME = /^([A-Za-z][A-Za-z0-9+.-]*):/u;
const NON_ENTITY_URI_SCHEMES = new Set([
  'about',
  'blob',
  'data',
  'file',
  'ftp',
  'ftps',
  'http',
  'https',
  'javascript',
  'mailto',
  'tel',
  'vbscript',
  'ws',
  'wss',
]);
export function escapeMentionLabel(value: string): string {
  return value.replace(/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/gu, '\\$&');
}

export function escapeMentionUri(value: string): string {
  return value.replaceAll('\\', '\\\\').replace(/([&()[\]<>|])/gu, '\\$1');
}

export function hasMarkdownParagraphBreak(value: string): boolean {
  return /(?:\r\n?|\n)[ \t]*(?:\r\n?|\n)/u.test(value);
}

export type ParsedMentionLink = {
  label: string;
  uri: string;
  end: number;
};

type MentionLabelBounds = { end: number; containsNestedLink: boolean };

function projectMentionLabel(value: string): string | null {
  const escaped = new Uint8Array(value.length);
  const removed = new Uint8Array(value.length);
  const openers = new Map<string, number[]>();
  const codeEnds = new Map<number, number>();
  const nextCodeRun = new Map<number, number>();
  let backslashes = 0;
  for (let index = 0; index < value.length; index += 1) {
    escaped[index] = backslashes % 2;
    backslashes = value[index] === '\\' ? backslashes + 1 : 0;
  }

  for (let index = value.length - 1; index >= 0; ) {
    if (value[index] !== '`') {
      index -= 1;
      continue;
    }
    let start = index;
    while (start > 0 && value[start - 1] === '`') start -= 1;
    const length = index - start + 1;
    if (escaped[start] === 0) {
      const next = nextCodeRun.get(length);
      if (next !== undefined) codeEnds.set(start, next);
      nextCodeRun.set(length, start);
    }
    index = start - 1;
  }

  for (let index = 0; index < value.length; ) {
    const codeEnd = codeEnds.get(index);
    if (codeEnd !== undefined) {
      index = codeEnd;
      while (value[index] === '`') index += 1;
      continue;
    }
    if (escaped[index] === 1 || !/[*_~]/u.test(value[index]!)) {
      index += 1;
      continue;
    }
    const character = value[index]!;
    let length = 1;
    while (value[index + length] === character) length += 1;
    if (character === '~' && length !== 2) {
      return null;
    }
    const before = value[index - 1] ?? '';
    const after = value[index + length] ?? '';
    const beforeWhitespace = before.length === 0 || /\s/u.test(before);
    const afterWhitespace = after.length === 0 || /\s/u.test(after);
    const beforePunctuation = /[\p{P}\p{S}]/u.test(before);
    const afterPunctuation = /[\p{P}\p{S}]/u.test(after);
    const leftFlanking =
      !afterWhitespace && (!afterPunctuation || beforeWhitespace || beforePunctuation);
    const rightFlanking =
      !beforeWhitespace && (!beforePunctuation || afterWhitespace || afterPunctuation);
    const canOpen =
      character === '_' ? leftFlanking && (!rightFlanking || beforePunctuation) : leftFlanking;
    const canClose =
      character === '_' ? rightFlanking && (!leftFlanking || afterPunctuation) : rightFlanking;
    const key = `${character}${length}`;
    const stack = openers.get(key) ?? [];
    if (canClose && stack.length > 0) {
      const opening = stack.pop()!;
      removed.fill(1, opening, opening + length);
      removed.fill(1, index, index + length);
    } else if (canOpen) {
      stack.push(index);
      openers.set(key, stack);
    }
    index += length;
  }
  if ([...openers.values()].some((stack) => stack.length > 0)) return null;

  let projected = '';
  let plain = '';
  const flushPlain = () => {
    const decoded = unescapeMarkdown(plain);
    if (decoded === null) return false;
    projected += decoded;
    plain = '';
    return true;
  };
  for (let index = 0; index < value.length; ) {
    const codeEnd = codeEnds.get(index);
    if (codeEnd !== undefined) {
      if (!flushPlain()) return null;
      const openingLength = countRepeated(value, index, '`');
      let code = value.slice(index + openingLength, codeEnd).replace(/\r\n?|\n/gu, ' ');
      if (code.startsWith(' ') && code.endsWith(' ') && /[^ ]/u.test(code))
        code = code.slice(1, -1);
      projected += code;
      index = codeEnd + openingLength;
      continue;
    }
    if (removed[index] === 0 && escaped[index] === 0 && /[*_~]/u.test(value[index]!)) return null;
    if (removed[index] === 0) plain += value[index];
    index += 1;
  }
  return flushPlain() ? projected : null;
}

function countRepeated(value: string, start: number, character: string): number {
  let length = 0;
  while (value[start + length] === character) length += 1;
  return length;
}

export function parseMentionLink(
  value: string,
  start: number,
  knownLabelBounds?: MentionLabelBounds | null,
): ParsedMentionLink | null {
  if (value[start] !== '[') return null;

  if (knownLabelBounds === null || knownLabelBounds?.containsNestedLink) return null;
  let labelEnd = knownLabelBounds?.end ?? start + 1;
  if (knownLabelBounds === undefined) {
    let labelDepth = 0;
    while (labelEnd < value.length) {
      if (value[labelEnd] === '\\') {
        labelEnd += 2;
        continue;
      }

      if (value[labelEnd] === '!' && value[labelEnd + 1] === '[') return null;
      if (value[labelEnd] === '[') {
        labelDepth += 1;
        labelEnd += 1;
        continue;
      }
      if (value[labelEnd] === ']') {
        if (labelDepth === 0) break;
        labelDepth -= 1;
        if (value[labelEnd + 1] === '(' || value[labelEnd + 1] === '[') return null;
      }
      labelEnd += 1;
    }
  }

  if (value[labelEnd] !== ']' || value[labelEnd + 1] !== '(') return null;

  const destinationStart = labelEnd + 2;
  let destinationEnd = destinationStart;
  let rawDestinationStart = destinationStart;
  let rawDestinationEnd = destinationStart;
  let nestedParentheses = 0;

  if (value[destinationStart] === '<') {
    rawDestinationStart += 1;
    destinationEnd += 1;
    while (destinationEnd < value.length && value[destinationEnd] !== '>') {
      if (value[destinationEnd] === '\\') {
        destinationEnd += 2;
        continue;
      }
      if (isLineEnding(value[destinationEnd]) || value[destinationEnd] === '<') return null;
      destinationEnd += 1;
    }
    if (value[destinationEnd] !== '>') return null;
    rawDestinationEnd = destinationEnd;
    destinationEnd += 1;
  } else {
    while (destinationEnd < value.length) {
      const character = value[destinationEnd]!;

      if (character === '\\') {
        destinationEnd += 2;
        continue;
      }

      if (/\s/u.test(character)) break;
      if (character === '(') {
        nestedParentheses += 1;
        destinationEnd += 1;
        continue;
      }
      if (character === '[' || character === '<' || character === '>') return null;
      if (character === ')') {
        if (nestedParentheses === 0) break;
        nestedParentheses -= 1;
      }

      destinationEnd += 1;
    }
    rawDestinationEnd = destinationEnd;
  }

  if (nestedParentheses !== 0) return null;
  let linkEnd = destinationEnd;
  if (/\s/u.test(value[linkEnd] ?? '')) {
    const titleWhitespaceStart = linkEnd;
    while (/\s/u.test(value[linkEnd] ?? '')) linkEnd += 1;
    if (hasMarkdownParagraphBreak(value.slice(titleWhitespaceStart, linkEnd))) return null;
    const opener = value[linkEnd];
    const closer = opener === '(' ? ')' : opener;
    if (opener !== '"' && opener !== "'" && opener !== '(') return null;
    linkEnd += 1;
    const titleStart = linkEnd;
    while (linkEnd < value.length && value[linkEnd] !== closer) {
      if (opener === '(' && value[linkEnd] === '(') return null;
      if (value[linkEnd] === '\\') linkEnd += 1;
      linkEnd += 1;
    }
    if (value[linkEnd] !== closer || hasMarkdownParagraphBreak(value.slice(titleStart, linkEnd))) {
      return null;
    }
    linkEnd += 1;
    const closingWhitespaceStart = linkEnd;
    while (/\s/u.test(value[linkEnd] ?? '')) linkEnd += 1;
    if (hasMarkdownParagraphBreak(value.slice(closingWhitespaceStart, linkEnd))) return null;
  }
  if (value[linkEnd] !== ')') return null;

  const rawLabel = value.slice(start + 1, labelEnd);
  if (hasMarkdownParagraphBreak(rawLabel)) return null;
  const label = projectMentionLabel(rawLabel);
  const uri = unescapeMarkdown(value.slice(rawDestinationStart, rawDestinationEnd));
  if (label === null || label.length === 0 || uri === null || !isEntityUri(uri)) return null;

  return { label, uri, end: linkEnd + 1 };
}

export function scanGfmLiteralAutolink(
  value: string,
  start: number,
): { end: number | null; scanEnd: number } {
  const prefixLength = value.startsWith('https://', start)
    ? 8
    : value.startsWith('http://', start) || value.startsWith('ftp://', start)
      ? 7
      : value.startsWith('www.', start)
        ? 4
        : 0;
  if ((start > 0 && /[A-Za-z0-9_]/u.test(value[start - 1]!)) || prefixLength === 0) {
    return { end: null, scanEnd: start };
  }

  const domainStart = start + prefixLength;
  let cursor = domainStart;
  while (/[A-Za-z0-9.-]/u.test(value[cursor] ?? '')) cursor += 1;
  if (
    !/^(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/u.test(
      value.slice(domainStart, cursor),
    )
  )
    return { end: null, scanEnd: domainStart };

  if (value[cursor] === ':') {
    cursor += 1;
    const portStart = cursor;
    while (/[0-9]/u.test(value[cursor] ?? '')) cursor += 1;
    if (cursor === portStart) return { end: null, scanEnd: domainStart };
  }
  if (cursor < value.length && !/[\s<>/?#]/u.test(value[cursor]!)) {
    return { end: null, scanEnd: domainStart };
  }
  while (cursor < value.length && !/[\s<>]/u.test(value[cursor]!)) cursor += 1;
  return { end: cursor, scanEnd: cursor };
}

export function getOrdinaryLinkEnd(
  value: string,
  start: number,
  allowNestedLabel = false,
): number | null {
  let labelEnd = start + 1;
  let labelDepth = 0;
  while (labelEnd < value.length) {
    if (value[labelEnd] === '\\') labelEnd += 2;
    else if (allowNestedLabel && value[labelEnd] === '!' && value[labelEnd + 1] === '[')
      return null;
    else if (value[labelEnd] === '[') {
      if (!allowNestedLabel) return null;
      labelDepth += 1;
      labelEnd += 1;
    } else if (value[labelEnd] === ']') {
      if (labelDepth === 0) break;
      labelDepth -= 1;
      labelEnd += 1;
    } else labelEnd += 1;
  }
  if (hasMarkdownParagraphBreak(value.slice(start + 1, labelEnd))) return null;
  if (value[labelEnd] !== ']' || value[labelEnd + 1] !== '(') return null;

  let cursor = labelEnd + 2;
  if (value[cursor] === '<') {
    cursor += 1;
    while (cursor < value.length && value[cursor] !== '>') {
      if (value[cursor] === '\\') {
        cursor += 2;
        continue;
      }
      if (isLineEnding(value[cursor]) || value[cursor] === '<') return null;
      cursor += 1;
    }
    if (value[cursor] !== '>') return null;
    cursor += 1;
  } else {
    let depth = 0;
    while (cursor < value.length && !/\s/u.test(value[cursor]!)) {
      const character = value[cursor];
      if (character === '\\') {
        if (value[cursor + 1] === '<' || /\s/u.test(value[cursor + 1] ?? '')) return null;
        cursor += 2;
        continue;
      }
      if (character === '[' || character === '<' || character === '>') return null;
      if (character === '(') depth += 1;
      if (character === ')') {
        if (depth === 0) return cursor + 1;
        depth -= 1;
      }
      cursor += 1;
    }
    if (depth !== 0) return null;
  }

  if (!/\s/u.test(value[cursor] ?? '')) return value[cursor] === ')' ? cursor + 1 : null;
  const titleWhitespaceStart = cursor;
  while (/\s/u.test(value[cursor] ?? '')) cursor += 1;
  if (hasMarkdownParagraphBreak(value.slice(titleWhitespaceStart, cursor))) return null;

  const opener = value[cursor];
  const closer = opener === '(' ? ')' : opener;
  if (opener !== '"' && opener !== "'" && opener !== '(') return null;
  cursor += 1;
  const titleStart = cursor;
  while (cursor < value.length && value[cursor] !== closer) {
    const character = value[cursor];
    if (opener === '(' && character === '(') return null;
    if (character === '\\') {
      cursor += 1;
    }
    cursor += 1;
  }
  if (value[cursor] !== closer) return null;
  if (hasMarkdownParagraphBreak(value.slice(titleStart, cursor))) return null;
  cursor += 1;
  const closingWhitespaceStart = cursor;
  while (/\s/u.test(value[cursor] ?? '')) cursor += 1;
  if (hasMarkdownParagraphBreak(value.slice(closingWhitespaceStart, cursor))) return null;

  return value[cursor] === ')' ? cursor + 1 : null;
}

export function getReferenceImageEnd(
  value: string,
  start: number,
  resolvedLabels: ReadonlySet<string> = new Set(),
): number | null {
  if (value[start] !== '!' || value[start + 1] !== '[') return null;
  let cursor = start + 2;
  let depth = 0;
  while (cursor < value.length) {
    if (value[cursor] === '\\') {
      cursor += 2;
      continue;
    }
    if (value[cursor] === '!' && value[cursor + 1] === '[') return null;
    if (value[cursor] === '[') depth += 1;
    else if (value[cursor] === ']') {
      if (depth === 0) break;
      depth -= 1;
    }
    cursor += 1;
  }
  if (value[cursor] !== ']') return null;
  if (value[cursor + 1] === '(') return null;
  const description = value.slice(start + 2, cursor);
  if (value[cursor + 1] !== '[') {
    return resolvedLabels.has(normalizeReferenceLabel(description)) ? cursor + 1 : null;
  }
  const referenceStart = cursor + 2;
  let referenceEnd = referenceStart;
  while (referenceEnd < value.length && value[referenceEnd] !== ']') {
    if (value[referenceEnd] === '\\') referenceEnd += 2;
    else referenceEnd += 1;
  }
  if (value[referenceEnd] !== ']') return null;
  const reference = value.slice(referenceStart, referenceEnd) || description;
  return resolvedLabels.has(normalizeReferenceLabel(reference)) ? referenceEnd + 1 : null;
}

export function normalizeReferenceLabel(value: string): string {
  return (unescapeMarkdown(value) ?? value)
    .replace(/[\t\n\r ]+/gu, ' ')
    .trim()
    .toLowerCase()
    .toUpperCase();
}

export function unescapeMarkdown(value: string, escapeWhitespace = false): string | null {
  let unescaped = '';

  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== '\\') {
      if (value[index] === '&') {
        const limit = Math.min(value.length, index + 33);
        let semicolon = index + 1;
        while (semicolon < limit && value[semicolon] !== ';') semicolon += 1;
        if (semicolon < limit) {
          const reference = value.slice(index + 1, semicolon);
          const hexadecimal = /^#[xX]([0-9A-Fa-f]{1,6})$/u.exec(reference);
          const decimal = /^#([0-9]{1,7})$/u.exec(reference);
          const named =
            hexadecimal === null && decimal === null
              ? decodeNamedCharacterReference(reference)
              : false;
          const decoded =
            hexadecimal !== null
              ? decodeNumericCharacterReference(hexadecimal[1]!, 16)
              : decimal !== null
                ? decodeNumericCharacterReference(decimal[1]!, 10)
                : named;
          if (decoded !== false) {
            unescaped += decoded;
            index = semicolon;
            continue;
          }
        }
      }
      unescaped += value[index];
      continue;
    }

    const escapedCharacter = value[index + 1];
    if (escapedCharacter === undefined) return null;

    const isPunctuation = /[!"#$%&'()*+,-./:;<=>?@[\]^_`{|}~\\]/u.test(escapedCharacter);
    if (!isPunctuation && !(escapeWhitespace && /\s/u.test(escapedCharacter))) {
      unescaped += `\\${escapedCharacter}`;
      index += 1;
      continue;
    }

    unescaped += escapedCharacter;
    index += 1;
  }

  return unescaped;
}

export function isEntityUri(uri: string): boolean {
  const match = ABSOLUTE_URI_SCHEME.exec(uri);
  return match !== null && !/\s/u.test(uri) && !NON_ENTITY_URI_SCHEMES.has(match[1]!.toLowerCase());
}
