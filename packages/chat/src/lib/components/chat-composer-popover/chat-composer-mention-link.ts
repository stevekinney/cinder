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
  return value.replaceAll('\\', '\\\\').replaceAll('[', '\\[').replaceAll(']', '\\]');
}

export function escapeMentionUri(value: string): string {
  return value.replaceAll('\\', '\\\\').replace(/([()[\]\s])/gu, '\\$1');
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
  return match !== null && !NON_ENTITY_URI_SCHEMES.has(match[1]!.toLowerCase());
}
