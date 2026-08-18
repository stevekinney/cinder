import {
  hasEscapedPrefix,
  makeScanMetadata,
  type ScanMetadata,
} from './chat-composer-mention-scan.ts';

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
  prefix: string;
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
const VOID_HTML_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'source',
  'track',
  'wbr',
]);
const RAW_TEXT_HTML_TAGS = new Set(['pre', 'script', 'style', 'textarea']);

function escapeLabel(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('[', '\\[').replaceAll(']', '\\]');
}

function escapeUri(value: string): string {
  return value.replaceAll('\\', '\\\\').replace(/([()[\]\s])/gu, '\\$1');
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

function isEntityUri(uri: string): boolean {
  const match = ABSOLUTE_URI_SCHEME.exec(uri);
  return match !== null && !NON_ENTITY_URI_SCHEMES.has(match[1]!.toLowerCase());
}

function countRun(value: string, start: number, character: string): number {
  let length = 0;

  while (value[start + length] === character) length += 1;

  return length;
}

function isIndentedCodeStart(value: string, index: number, metadata: ScanMetadata): boolean {
  const lineStart = metadata.lineStarts[index] ?? 0;
  if (lineStart !== index || (!value.startsWith('    ', index) && value[index] !== '\t'))
    return false;

  if (lineStart === 0) return true;

  const previousLineStart = metadata.lineStarts[lineStart - 1] ?? 0;
  return /^\s*$/u.test(value.slice(previousLineStart, lineStart - 1));
}

function getContainerPrefix(value: string, start: number, metadata: ScanMetadata): string {
  const lineStart = metadata.lineStarts[start] ?? 0;
  return value.slice(lineStart, metadata.containerStarts[lineStart]);
}

function getOpeningCodeFence(
  value: string,
  start: number,
  metadata: ScanMetadata,
): CodeFence | null {
  const delimiter = value[start];
  const prefix = getContainerPrefix(value, start, metadata);
  const lineStart = metadata.lineStarts[start] ?? 0;
  if (
    (delimiter !== '`' && delimiter !== '~') ||
    hasEscapedPrefix(start, metadata) ||
    start !== metadata.containerStarts[lineStart] ||
    (prefix.length > 3 && !/[>*+\-0-9.]/u.test(prefix))
  ) {
    return null;
  }

  const minimumLength = countRun(value, start, delimiter);
  const lineEnd = value.indexOf('\n', start + minimumLength);
  const info = value.slice(start + minimumLength, lineEnd === -1 ? value.length : lineEnd);
  if (delimiter === '`' && info.includes('`')) return null;

  return minimumLength >= 3 ? { delimiter, minimumLength, prefix } : null;
}

function isClosingCodeFence(
  value: string,
  start: number,
  fence: CodeFence,
  metadata: ScanMetadata,
): boolean {
  const lineStart = metadata.lineStarts[start] ?? 0;
  if (!value.startsWith(fence.prefix, lineStart) || start !== metadata.containerStarts[lineStart])
    return false;

  const length = countRun(value, start, fence.delimiter);
  if (length < fence.minimumLength) return false;

  const lineEnd = value.indexOf('\n', start + length);
  return /^ *\r?$/u.test(value.slice(start + length, lineEnd === -1 ? value.length : lineEnd));
}

function getHtmlTagEnd(value: string, start: number): number | null {
  if (!/[A-Za-z/!?]/u.test(value[start + 1] ?? '')) return null;

  let quote: '"' | "'" | null = null;
  for (let index = start + 1; index < value.length; index += 1) {
    const character = value[index];
    if (quote !== null) {
      if (character === quote) quote = null;
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (character === '<') {
      return null;
    } else if (character === '>') {
      return index;
    }
  }
  return null;
}

function getHtmlBlockBlankLineEnd(value: string, start: number): number | null {
  let lineEnd = value.indexOf('\n', start);
  while (lineEnd !== -1) {
    let cursor = lineEnd + 1;
    while (value[cursor] === ' ' || value[cursor] === '\t' || value[cursor] === '\r') cursor += 1;
    if (value[cursor] === '\n') return cursor + 1;
    lineEnd = value.indexOf('\n', cursor);
  }
  return null;
}

function getClosingHtmlBlockEnd(value: string, start: number, tag: string): number | null {
  const normalizedTag = tag.toLowerCase();
  let candidate = value.indexOf('</', start);
  while (candidate !== -1) {
    const nameStart = candidate + 2;
    const nameEnd = nameStart + tag.length;
    if (
      value.slice(nameStart, nameEnd).toLowerCase() === normalizedTag &&
      /[\s>]/u.test(value[nameEnd] ?? '')
    ) {
      const tagEnd = getHtmlTagEnd(value, candidate);
      if (tagEnd !== null) return tagEnd + 1;
    }
    candidate = value.indexOf('</', candidate + 2);
  }
  return null;
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
  let quote: '"' | "'" | null = null;
  for (let index = labelEnd + 2; index < value.length; index += 1) {
    const character = value[index];
    if (character === '\\') {
      index += 1;
    } else if (quote !== null) {
      if (character === quote) quote = null;
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (character === '[') {
      return null;
    } else if (character === '(') {
      depth += 1;
    } else if (character === ')') {
      if (depth === 0) return index + 1;
      depth -= 1;
    }
  }

  return null;
}

function getReferenceDefinitionEnd(
  value: string,
  start: number,
  metadata: ScanMetadata,
): number | null {
  const lineStart = metadata.lineStarts[start] ?? 0;
  if (!/^ {0,3}$/u.test(value.slice(lineStart, start))) return null;

  let labelEnd = start + 1;
  while (labelEnd < value.length && value[labelEnd] !== ']') {
    if (value[labelEnd] === '\\') labelEnd += 2;
    else labelEnd += 1;
  }

  if (value[labelEnd] !== ']' || value[labelEnd + 1] !== ':') return null;

  let destinationStart = labelEnd + 2;
  while (value[destinationStart] === ' ' || value[destinationStart] === '\t') destinationStart += 1;
  if (!/\S/u.test(value[destinationStart] ?? '')) return null;

  const lineEnd = value.indexOf('\n', destinationStart);
  return lineEnd === -1 ? value.length : lineEnd;
}

function getInlineCodeSpanEnd(start: number, metadata: ScanMetadata): number | null {
  const end = metadata.codeSpanEnds[start];
  return end === undefined || end < 0 ? null : end;
}

function getMathEnd(value: string, start: number, metadata: ScanMetadata): number | null {
  if (hasEscapedPrefix(start, metadata)) return null;

  const delimiterLength = countRun(value, start, '$');
  if (delimiterLength > 2) return null;
  if (delimiterLength === 1 && /[0-9\s]/u.test(value[start + 1] ?? '')) return null;
  const end = metadata.mathEnds[start];
  return end === undefined || end < 0 ? null : end;
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
    if (character === '[') return null;
    if (character === ')') {
      if (nestedParentheses === 0) break;
      nestedParentheses -= 1;
    }

    destinationEnd += 1;
  }

  if (value[destinationEnd] !== ')') return null;

  const label = unescapeMarkdown(value.slice(start + 1, labelEnd));
  const uri = unescapeMarkdown(value.slice(destinationStart, destinationEnd), true);
  if (label === null || label.length === 0 || uri === null || !isEntityUri(uri)) return null;

  return { label, uri, end: destinationEnd + 1 };
}

/** Serializes an entity mention as Markdown suitable for a plain textarea. */
export function serializeChatComposerMention({ label, uri }: ChatComposerMention): string {
  if (label.length === 0) {
    throw new TypeError('serializeChatComposerMention requires a non-empty label.');
  }

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
  const metadata = makeScanMetadata(value);
  let text = '';
  let sourceIndex = 0;
  let codeFence: CodeFence | null = null;
  let indentedCode = false;
  let htmlComment = false;
  let htmlBlock: { tag: string; closesWithTag: boolean } | null = null;

  while (sourceIndex < value.length) {
    if (htmlComment) {
      const end = value.indexOf('-->', sourceIndex);
      if (end === -1) {
        text += value.slice(sourceIndex);
        break;
      }
      text += value.slice(sourceIndex, end + 3);
      sourceIndex = end + 3;
      htmlComment = false;
      continue;
    }
    if (htmlBlock !== null) {
      const end = htmlBlock.closesWithTag
        ? getClosingHtmlBlockEnd(value, sourceIndex, htmlBlock.tag)
        : getHtmlBlockBlankLineEnd(value, sourceIndex);
      if (end === null) {
        text += value.slice(sourceIndex);
        break;
      }
      text += value.slice(sourceIndex, end);
      sourceIndex = end;
      htmlBlock = null;
      continue;
    }
    if (codeFence !== null) {
      if (
        value[sourceIndex] === codeFence.delimiter &&
        (sourceIndex === 0 || /[\n >*+\-.]/u.test(value[sourceIndex - 1]!)) &&
        isClosingCodeFence(value, sourceIndex, codeFence, metadata)
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

    if (metadata.escaped[sourceIndex] === 0 && isIndentedCodeStart(value, sourceIndex, metadata)) {
      indentedCode = true;
    }
    if (indentedCode && (sourceIndex === 0 || value[sourceIndex - 1] === '\n')) {
      const lineEnd = value.indexOf('\n', sourceIndex);
      const end = lineEnd === -1 ? value.length : lineEnd + 1;
      const line = value.slice(sourceIndex, lineEnd === -1 ? value.length : lineEnd);
      if (line.trim().length === 0 || (!/^ {4}/u.test(line) && !line.startsWith('\t'))) {
        indentedCode = false;
      } else {
        text += value.slice(sourceIndex, end);
        sourceIndex = end;
        continue;
      }
    }

    if (value[sourceIndex] === '<' && !hasEscapedPrefix(sourceIndex, metadata)) {
      if (value.startsWith('<!--', sourceIndex)) {
        htmlComment = true;
        text += '<!--';
        sourceIndex += 4;
        continue;
      }
      const tagEnd = getHtmlTagEnd(value, sourceIndex);
      if (tagEnd !== null) {
        const tag = /^<([A-Za-z][A-Za-z0-9-]*)(?:\s|>)/u.exec(value.slice(sourceIndex, tagEnd + 1));
        text += value.slice(sourceIndex, tagEnd + 1);
        sourceIndex = tagEnd + 1;
        if (
          tag !== null &&
          !value.slice(sourceIndex - 2, sourceIndex).includes('/') &&
          !VOID_HTML_TAGS.has(tag[1]!.toLowerCase())
        ) {
          const lineStart = metadata.lineStarts[sourceIndex - 1] ?? 0;
          if (
            /^\s*<[A-Za-z][A-Za-z0-9-]*(?:\s[^>]*)?>$/u.test(value.slice(lineStart, sourceIndex)) &&
            value[sourceIndex] === '\n'
          ) {
            const normalizedTag = tag[1]!.toLowerCase();
            htmlBlock = {
              tag: normalizedTag,
              closesWithTag: RAW_TEXT_HTML_TAGS.has(normalizedTag),
            };
          }
        }
        continue;
      }
    }

    const openingCodeFence =
      (value[sourceIndex] === '`' || value[sourceIndex] === '~') &&
      (sourceIndex === 0 || /[\n >*+\-.]/u.test(value[sourceIndex - 1]!))
        ? getOpeningCodeFence(value, sourceIndex, metadata)
        : null;
    if (openingCodeFence !== null) {
      codeFence = openingCodeFence;
      const run = countRun(value, sourceIndex, openingCodeFence.delimiter);
      text += value.slice(sourceIndex, sourceIndex + run);
      sourceIndex += run;
      continue;
    }

    if (value[sourceIndex] === '$') {
      const mathEnd = getMathEnd(value, sourceIndex, metadata);
      if (mathEnd !== null) {
        text += value.slice(sourceIndex, mathEnd);
        sourceIndex = mathEnd;
        continue;
      }
    }

    if (value[sourceIndex] === '`') {
      const codeSpanEnd = hasEscapedPrefix(sourceIndex, metadata)
        ? null
        : getInlineCodeSpanEnd(sourceIndex, metadata);
      if (codeSpanEnd !== null) {
        text += value.slice(sourceIndex, codeSpanEnd);
        sourceIndex = codeSpanEnd;
        continue;
      }
    }

    if (value[sourceIndex] === '[' && !hasEscapedPrefix(sourceIndex, metadata)) {
      if (value[sourceIndex - 1] === '!' && !hasEscapedPrefix(sourceIndex - 1, metadata)) {
        const imageEnd = getOrdinaryLinkEnd(value, sourceIndex);
        if (imageEnd !== null) {
          text += value.slice(sourceIndex, imageEnd);
          sourceIndex = imageEnd;
          continue;
        }
      }

      const referenceDefinitionEnd = getReferenceDefinitionEnd(value, sourceIndex, metadata);
      if (referenceDefinitionEnd !== null) {
        text += value.slice(sourceIndex, referenceDefinitionEnd);
        sourceIndex = referenceDefinitionEnd;
        continue;
      }

      const link = parseLink(value, sourceIndex);
      if (link !== null) {
        const start = text.length;
        text += link.label;
        mentions.push({ label: link.label, uri: link.uri, start, end: text.length });
        sourceIndex = link.end;
        continue;
      }

      const ordinaryLinkEnd =
        value[sourceIndex + 1] === '[' ? null : getOrdinaryLinkEnd(value, sourceIndex);
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
