/** An addressable entity selected from a chat composer suggestion list. */
export type ChatComposerMention = {
  label: string;
  uri: string;
};

/** A mention's location in a parsed composer text projection. */
export type ChatComposerMentionRange = ChatComposerMention & {
  start: number;
  end: number;
};

/** Plain textarea text and the addressable entity mentions it contains. */
export type ChatComposerMentionParseResult = {
  text: string;
  mentions: ChatComposerMentionRange[];
};

type ParsedLink = {
  label: string;
  uri: string;
  end: number;
};

type CodeFence = {
  delimiter: '`' | '~';
  minimumLength: number;
};

const ABSOLUTE_URI_SCHEME = /^([A-Za-z][A-Za-z0-9+.-]*):/u;
const NON_ENTITY_URI_SCHEMES = new Set([
  'about',
  'blob',
  'data',
  'file',
  'http',
  'https',
  'javascript',
  'mailto',
  'tel',
  'vbscript',
]);

function escapeLabel(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('[', '\\[').replaceAll(']', '\\]');
}

function escapeUri(value: string): string {
  return value.replaceAll('\\', '\\\\').replace(/([()\s])/gu, '\\$1');
}

function unescapeMarkdown(value: string, escapeWhitespace = false): string | null {
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

function hasEscapedPrefix(value: string, index: number): boolean {
  let slashCount = 0;

  for (let cursor = index - 1; cursor >= 0 && value[cursor] === '\\'; cursor -= 1) {
    slashCount += 1;
  }

  return slashCount % 2 === 1;
}

function isEntityUri(uri: string): boolean {
  const match = ABSOLUTE_URI_SCHEME.exec(uri);
  return match !== null && !NON_ENTITY_URI_SCHEMES.has(match[1]!.toLowerCase());
}

function countRun(value: string, start: number, character: string): number {
  let length = 0;

  while (value[start + length] === character) length += 1;

  return length;
}

function isIndentedAtMostThreeSpaces(value: string, index: number): boolean {
  const lineStart = value.lastIndexOf('\n', index - 1) + 1;
  return /^ {0,3}$/u.test(value.slice(lineStart, index));
}

function isIndentedCodeStart(value: string, index: number): boolean {
  return value.lastIndexOf('\n', index - 1) + 1 === index && value.startsWith('    ', index);
}

function getOpeningCodeFence(value: string, start: number): CodeFence | null {
  const delimiter = value[start];
  if ((delimiter !== '`' && delimiter !== '~') || !isIndentedAtMostThreeSpaces(value, start)) {
    return null;
  }

  const minimumLength = countRun(value, start, delimiter);
  const lineEnd = value.indexOf('\n', start + minimumLength);
  const info = value.slice(start + minimumLength, lineEnd === -1 ? value.length : lineEnd);
  if (delimiter === '`' && info.includes('`')) return null;

  return minimumLength >= 3 ? { delimiter, minimumLength } : null;
}

function isClosingCodeFence(value: string, start: number, fence: CodeFence): boolean {
  if (!isIndentedAtMostThreeSpaces(value, start)) return false;

  const length = countRun(value, start, fence.delimiter);
  if (length < fence.minimumLength) return false;

  const lineEnd = value.indexOf('\n', start + length);
  return /^ *\r?$/u.test(value.slice(start + length, lineEnd === -1 ? value.length : lineEnd));
}

function getOrdinaryLinkEnd(value: string, start: number): number | null {
  let labelEnd = start + 1;
  while (labelEnd < value.length) {
    if (value[labelEnd] === '\\') labelEnd += 2;
    else if (value[labelEnd] === '[') return null;
    else if (value[labelEnd] === ']') break;
    else labelEnd += 1;
  }
  if (value[labelEnd] !== ']' || value[labelEnd + 1] !== '(') return null;

  let depth = 0;
  for (let index = labelEnd + 2; index < value.length; index += 1) {
    if (value[index] === '\\') {
      index += 1;
    } else if (value[index] === '(') {
      depth += 1;
    } else if (value[index] === ')') {
      if (depth === 0) return index + 1;
      depth -= 1;
    }
  }

  return null;
}

function getInlineCodeSpanEnd(value: string, start: number): number | null {
  const delimiterLength = countRun(value, start, '`');

  for (let index = start + delimiterLength; index < value.length; index += 1) {
    if (value[index] !== '`') continue;

    const closingLength = countRun(value, index, '`');
    if (closingLength === delimiterLength) return index + closingLength;

    index += closingLength - 1;
  }

  return null;
}

function parseLink(value: string, start: number): ParsedLink | null {
  if (value[start] !== '[') return null;

  let labelEnd = start + 1;
  while (labelEnd < value.length) {
    if (value[labelEnd] === '\\') {
      labelEnd += 2;
      continue;
    }

    if (value[labelEnd] === '[') return null;
    if (value[labelEnd] === ']') break;
    labelEnd += 1;
  }

  if (value[labelEnd] !== ']' || value[labelEnd + 1] !== '(') return null;

  const destinationStart = labelEnd + 2;
  let destinationEnd = destinationStart;
  let nestedParentheses = 0;

  while (destinationEnd < value.length) {
    const character = value[destinationEnd]!;

    if (character === '\\') {
      destinationEnd += 2;
      continue;
    }

    if (/\s/u.test(character)) return null;
    if (character === '(') {
      nestedParentheses += 1;
      destinationEnd += 1;
      continue;
    }
    if (character === ')') {
      if (nestedParentheses === 0) break;
      nestedParentheses -= 1;
    }

    destinationEnd += 1;
  }

  if (value[destinationEnd] !== ')') return null;

  const label = unescapeMarkdown(value.slice(start + 1, labelEnd));
  const uri = unescapeMarkdown(value.slice(destinationStart, destinationEnd), true);
  if (label === null || uri === null || !isEntityUri(uri)) return null;

  return { label, uri, end: destinationEnd + 1 };
}

/** Serializes an entity mention as Markdown suitable for a plain textarea. */
export function serializeChatComposerMention({ label, uri }: ChatComposerMention): string {
  if (!isEntityUri(uri)) {
    throw new TypeError('serializeChatComposerMention requires an absolute non-web entity URI.');
  }

  return `[${escapeLabel(label)}](${escapeUri(uri)})`;
}

/** Deserializes one serialized entity mention, or returns `null` for any other text. */
export function deserializeChatComposerMention(value: string): ChatComposerMention | null {
  const link = parseLink(value, 0);
  if (link === null || link.end !== value.length) return null;

  return { label: link.label, uri: link.uri };
}

/** Projects entity mentions to visible text and reports their UTF-16 ranges. */
export function parseChatComposerMentions(value: string): ChatComposerMentionParseResult {
  const mentions: ChatComposerMentionRange[] = [];
  let text = '';
  let sourceIndex = 0;
  let codeFence: CodeFence | null = null;

  while (sourceIndex < value.length) {
    if (codeFence !== null) {
      if (
        value[sourceIndex] === codeFence.delimiter &&
        isClosingCodeFence(value, sourceIndex, codeFence)
      ) {
        const closingLength = countRun(value, sourceIndex, codeFence.delimiter);
        text += value.slice(sourceIndex, sourceIndex + closingLength);
        sourceIndex += closingLength;
        codeFence = null;
        continue;
      }

      text += value[sourceIndex];
      sourceIndex += 1;
      continue;
    }

    if (isIndentedCodeStart(value, sourceIndex)) {
      const lineEnd = value.indexOf('\n', sourceIndex);
      const end = lineEnd === -1 ? value.length : lineEnd + 1;
      text += value.slice(sourceIndex, end);
      sourceIndex = end;
      continue;
    }

    const openingCodeFence = getOpeningCodeFence(value, sourceIndex);
    if (openingCodeFence !== null) {
      codeFence = openingCodeFence;
      text += value[sourceIndex];
      sourceIndex += 1;
      continue;
    }

    if (value[sourceIndex] === '`') {
      const codeSpanEnd = getInlineCodeSpanEnd(value, sourceIndex);
      if (codeSpanEnd !== null) {
        text += value.slice(sourceIndex, codeSpanEnd);
        sourceIndex = codeSpanEnd;
        continue;
      }
    }

    if (
      value[sourceIndex] === '[' &&
      (value[sourceIndex - 1] !== '!' || hasEscapedPrefix(value, sourceIndex - 1)) &&
      !hasEscapedPrefix(value, sourceIndex)
    ) {
      const link = parseLink(value, sourceIndex);
      if (link !== null) {
        const start = text.length;
        text += link.label;
        mentions.push({ label: link.label, uri: link.uri, start, end: text.length });
        sourceIndex = link.end;
        continue;
      }

      const ordinaryLinkEnd = getOrdinaryLinkEnd(value, sourceIndex);
      if (ordinaryLinkEnd !== null) {
        text += value.slice(sourceIndex, ordinaryLinkEnd);
        sourceIndex = ordinaryLinkEnd;
        continue;
      }
    }

    text += value[sourceIndex];
    sourceIndex += 1;
  }

  return { text, mentions };
}
