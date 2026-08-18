import {
  canStartHtmlBlock,
  closesHtmlBlockWithTag,
  getAutolinkEnd,
  getClosingHtmlBlockEnd,
  getHtmlBlockBlankLineEnd,
  getHtmlTagEnd,
  isInterruptingHtmlBlockTag,
  isVoidHtmlTag,
} from './chat-composer-mention-html.ts';
import {
  escapeMentionLabel,
  escapeMentionUri,
  isEntityUri,
  unescapeMarkdown,
} from './chat-composer-mention-link.ts';
import { getReferenceDefinitionEnd } from './chat-composer-mention-reference.ts';
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
  return value.slice(lineStart, metadata.containerStarts.get(lineStart) ?? lineStart);
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
    start !== (metadata.containerStarts.get(lineStart) ?? lineStart) ||
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
  if (
    !value.startsWith(fence.prefix, lineStart) ||
    start !== (metadata.containerStarts.get(lineStart) ?? lineStart)
  )
    return false;

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

function getInlineCodeSpanEnd(start: number, metadata: ScanMetadata): number | null {
  return metadata.codeSpanEnds.get(start) ?? null;
}

function getMathEnd(value: string, start: number, metadata: ScanMetadata): number | null {
  if (hasEscapedPrefix(start, metadata)) return null;

  const delimiterLength = value[start + 1] !== '$' ? 1 : value[start + 2] !== '$' ? 2 : 3;
  if (delimiterLength > 2) return null;
  if (delimiterLength === 1 && /[0-9\s]/u.test(value[start + 1] ?? '')) return null;
  return metadata.mathEnds.get(start) ?? null;
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

  return `[${escapeMentionLabel(label)}](${escapeMentionUri(uri)})`;
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
      if (value.startsWith('<![CDATA[', sourceIndex)) {
        const closingStart = value.indexOf(']]>', sourceIndex + 9);
        const end = closingStart === -1 ? value.length : closingStart + 3;
        text += value.slice(sourceIndex, end);
        sourceIndex = end;
        continue;
      }
      const autolinkEnd = getAutolinkEnd(value, sourceIndex);
      if (autolinkEnd !== null) {
        text += value.slice(sourceIndex, autolinkEnd);
        sourceIndex = autolinkEnd;
        continue;
      }
      const tagEnd = getHtmlTagEnd(value, sourceIndex);
      if (tagEnd !== null) {
        const tagStart = sourceIndex;
        const tag = /^<([A-Za-z][A-Za-z0-9-]*)(?:\s|>)/u.exec(value.slice(sourceIndex, tagEnd + 1));
        text += value.slice(sourceIndex, tagEnd + 1);
        sourceIndex = tagEnd + 1;
        if (
          tag !== null &&
          !value.slice(sourceIndex - 2, sourceIndex).includes('/') &&
          !isVoidHtmlTag(tag[1]!.toLowerCase())
        ) {
          const lineStart = metadata.lineStarts[sourceIndex - 1] ?? 0;
          const normalizedTag = tag[1]!.toLowerCase();
          const startsAtBlockColumn = /^ {0,3}$/u.test(value.slice(lineStart, tagStart));
          const isStandaloneTag =
            /^\s*<[A-Za-z][A-Za-z0-9-]*(?:\s[^>]*)?>$/u.test(value.slice(lineStart, sourceIndex)) &&
            value[sourceIndex] === '\n';
          if (
            startsAtBlockColumn &&
            (isInterruptingHtmlBlockTag(normalizedTag) ||
              (isStandaloneTag && canStartHtmlBlock(value, lineStart, metadata)))
          ) {
            htmlBlock = {
              tag: normalizedTag,
              closesWithTag: closesHtmlBlockWithTag(normalizedTag),
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
