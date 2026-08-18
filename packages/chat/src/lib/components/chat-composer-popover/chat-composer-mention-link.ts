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
