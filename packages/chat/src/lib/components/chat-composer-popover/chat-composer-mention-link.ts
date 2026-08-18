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
  return value.replaceAll('\\', '\\\\').replace(/([()[\]<>])/gu, '\\$1');
}

export function hasMarkdownParagraphBreak(value: string): boolean {
  return /(?:\r\n?|\n)[ \t]*(?:\r\n?|\n)/u.test(value);
}

export function getGfmLiteralAutolinkEnd(value: string, start: number): number | null {
  if (
    (start > 0 && /[A-Za-z0-9_]/u.test(value[start - 1]!)) ||
    (!value.startsWith('http://', start) &&
      !value.startsWith('https://', start) &&
      !value.startsWith('www.', start))
  ) {
    return null;
  }

  let cursor = start;
  while (cursor < value.length && !/[\s<>]/u.test(value[cursor]!)) cursor += 1;
  return cursor;
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
  if (value[labelEnd] !== ']' || value[labelEnd + 1] !== '(') return null;

  let cursor = labelEnd + 2;
  if (value[cursor] === '<') {
    cursor += 1;
    while (cursor < value.length && value[cursor] !== '>') {
      if (value[cursor] === '\\') cursor += 1;
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
        cursor += 2;
        continue;
      }
      if (character === '[') return null;
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
  while (cursor < value.length && value[cursor] !== closer) {
    const character = value[cursor];
    if (character === '\\') {
      cursor += 1;
    } else if (isLineEnding(character) && opener === '(') {
      return null;
    }
    cursor += 1;
  }
  if (value[cursor] !== closer) return null;
  cursor += 1;
  const closingWhitespaceStart = cursor;
  while (/\s/u.test(value[cursor] ?? '')) cursor += 1;
  if (hasMarkdownParagraphBreak(value.slice(closingWhitespaceStart, cursor))) return null;

  return value[cursor] === ')' ? cursor + 1 : null;
}

export function unescapeMarkdown(value: string, escapeWhitespace = false): string | null {
  let unescaped = '';

  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== '\\') {
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
