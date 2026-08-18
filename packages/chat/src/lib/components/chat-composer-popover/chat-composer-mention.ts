import {
  canStartHtmlBlock,
  closesHtmlBlockWithTag,
  getAutolinkEnd,
  getClosingHtmlBlockEnd,
  getHtmlBlockBlankLineEnd,
  getHtmlDelimitedBlockEnd,
  getHtmlTagEnd,
  isInterruptingHtmlBlockTag,
  isVoidHtmlTag,
} from './chat-composer-mention-html.ts';
import { getLineEnd, getLineEndingLength, isLineEnding } from './chat-composer-mention-lines.ts';
import {
  escapeMentionLabel,
  escapeMentionUri,
  getGfmLiteralAutolinkEnd,
  hasMarkdownParagraphBreak,
  isEntityUri,
  unescapeMarkdown,
} from './chat-composer-mention-link.ts';
import { getReferenceDefinitionEnd } from './chat-composer-mention-reference.ts';
import {
  countRun,
  getContainerContext,
  getMathEnd,
  getOpeningCodeFence,
  hasEscapedPrefix,
  isClosingCodeFence,
  isContainerActive,
  isIndentedCodeLine,
  isIndentedCodeStart,
  makeScanMetadata,
  type CodeFence,
  type ContainerContext,
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

function isAtBlockStart(value: string, index: number, metadata: ScanMetadata): boolean {
  const lineStart = metadata.lineStarts[index] ?? 0;
  const containerStart = metadata.containerStarts.get(lineStart) ?? lineStart;
  return /^ {0,3}$/u.test(value.slice(containerStart, index));
}

function getOrdinaryLinkEnd(value: string, start: number, allowNestedLabel = false): number | null {
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

function getInlineCodeSpanEnd(start: number, metadata: ScanMetadata): number | null {
  return metadata.codeSpanEnds.get(start) ?? null;
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

  const rawLabel = value.slice(start + 1, labelEnd);
  if (hasMarkdownParagraphBreak(rawLabel)) return null;
  const label = unescapeMarkdown(rawLabel);
  const uri = unescapeMarkdown(value.slice(destinationStart, destinationEnd));
  if (label === null || label.length === 0 || uri === null || !isEntityUri(uri)) return null;

  return { label, uri, end: destinationEnd + 1 };
}

/** Serializes an entity mention as Markdown suitable for a plain textarea. */
export function serializeChatComposerMention({ label, uri }: ChatComposerMention): string {
  if (label.length === 0) {
    throw new TypeError('serializeChatComposerMention requires a non-empty label.');
  }

  if (hasMarkdownParagraphBreak(label)) {
    throw new TypeError('serializeChatComposerMention does not accept paragraph breaks in labels.');
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
  let htmlDelimitedBlock: { terminator: string; container: ContainerContext } | null = null;
  let htmlBlock: {
    tag: string;
    closesWithTag: boolean;
    container: ContainerContext;
  } | null = null;

  while (sourceIndex < value.length) {
    if (htmlDelimitedBlock !== null) {
      const end = getHtmlDelimitedBlockEnd(
        value,
        sourceIndex,
        htmlDelimitedBlock.terminator,
        htmlDelimitedBlock.container,
        metadata,
      );
      if (end === null) {
        text += value.slice(sourceIndex);
        break;
      }
      text += value.slice(sourceIndex, end);
      sourceIndex = end;
      htmlDelimitedBlock = null;
      continue;
    }
    if (htmlBlock !== null) {
      const end = htmlBlock.closesWithTag
        ? getClosingHtmlBlockEnd(value, sourceIndex, htmlBlock.tag, htmlBlock.container, metadata)
        : getHtmlBlockBlankLineEnd(value, sourceIndex, htmlBlock.container, metadata);
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
      const lineStart = metadata.lineStarts[sourceIndex] ?? 0;
      if (
        sourceIndex === lineStart &&
        !isContainerActive(codeFence.container, lineStart, metadata)
      ) {
        codeFence = null;
        continue;
      }
      if (
        value[sourceIndex] === codeFence.delimiter &&
        (sourceIndex === 0 || /[\r\n >*+\-.]/u.test(value[sourceIndex - 1]!)) &&
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
    if (indentedCode && (sourceIndex === 0 || isLineEnding(value[sourceIndex - 1]))) {
      const lineEnd = getLineEnd(value, sourceIndex);
      const end = lineEnd + getLineEndingLength(value, lineEnd);
      const line = value.slice(sourceIndex, lineEnd);
      if (line.trim().length === 0 || !isIndentedCodeLine(value, sourceIndex)) {
        indentedCode = false;
      } else {
        text += value.slice(sourceIndex, end);
        sourceIndex = end;
        continue;
      }
    }

    if (value[sourceIndex] === '<' && !hasEscapedPrefix(sourceIndex, metadata)) {
      if (value.startsWith('<!--', sourceIndex)) {
        const isBlock = isAtBlockStart(value, sourceIndex, metadata);
        const closingStart = value.indexOf('-->', sourceIndex + 4);
        if (closingStart !== -1 || isBlock) {
          const lineStart = metadata.lineStarts[sourceIndex] ?? 0;
          if (isBlock) {
            htmlDelimitedBlock = {
              terminator: '-->',
              container: getContainerContext(lineStart, metadata),
            };
          }
          text += '<!--';
          sourceIndex += 4;
          if (!isBlock && closingStart !== -1) {
            text += value.slice(sourceIndex, closingStart + 3);
            sourceIndex = closingStart + 3;
          }
          continue;
        }
      }
      if (value.startsWith('<?', sourceIndex) && isAtBlockStart(value, sourceIndex, metadata)) {
        const lineStart = metadata.lineStarts[sourceIndex] ?? 0;
        htmlDelimitedBlock = {
          terminator: '?>',
          container: getContainerContext(lineStart, metadata),
        };
        text += '<?';
        sourceIndex += 2;
        continue;
      }
      if (
        /^<![A-Z]/u.test(value.slice(sourceIndex)) &&
        isAtBlockStart(value, sourceIndex, metadata)
      ) {
        const lineStart = metadata.lineStarts[sourceIndex] ?? 0;
        htmlDelimitedBlock = {
          terminator: '>',
          container: getContainerContext(lineStart, metadata),
        };
        text += '<!';
        sourceIndex += 2;
        continue;
      }
      if (value.startsWith('<![CDATA[', sourceIndex)) {
        const closingStart = value.indexOf(']]>', sourceIndex + 9);
        const end = closingStart === -1 ? value.length : closingStart + 3;
        text += value.slice(sourceIndex, end);
        sourceIndex = end;
        continue;
      }
      const rawBlock = /^<(pre|script|style|textarea)(?=[\s>])/iu.exec(value.slice(sourceIndex));
      if (rawBlock !== null && isAtBlockStart(value, sourceIndex, metadata)) {
        const lineStart = metadata.lineStarts[sourceIndex] ?? 0;
        htmlBlock = {
          tag: rawBlock[1]!.toLowerCase(),
          closesWithTag: true,
          container: getContainerContext(lineStart, metadata),
        };
        text += '<';
        sourceIndex += 1;
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
        const tag = /^<\/?([A-Za-z][A-Za-z0-9-]*)(?=\s|\/?>)/u.exec(
          value.slice(sourceIndex, tagEnd + 1),
        );
        text += value.slice(sourceIndex, tagEnd + 1);
        sourceIndex = tagEnd + 1;
        if (tag !== null) {
          const lineStart = metadata.lineStarts[sourceIndex - 1] ?? 0;
          const normalizedTag = tag[1]!.toLowerCase();
          const containerStart = metadata.containerStarts.get(lineStart) ?? lineStart;
          const startsAtBlockColumn = /^ {0,3}$/u.test(value.slice(containerStart, tagStart));
          const isStandaloneTag =
            /^\s*<[A-Za-z][A-Za-z0-9-]*(?:\s[^>]*)?>$/u.test(value.slice(lineStart, sourceIndex)) &&
            isLineEnding(value[sourceIndex]);
          const canOwnHtmlBlock =
            isInterruptingHtmlBlockTag(normalizedTag) ||
            (!value.slice(sourceIndex - 2, sourceIndex).includes('/') &&
              !isVoidHtmlTag(normalizedTag));
          if (
            canOwnHtmlBlock &&
            startsAtBlockColumn &&
            (isInterruptingHtmlBlockTag(normalizedTag) ||
              (isStandaloneTag && canStartHtmlBlock(value, lineStart, metadata)))
          ) {
            htmlBlock = {
              tag: normalizedTag,
              closesWithTag: closesHtmlBlockWithTag(normalizedTag),
              container: getContainerContext(lineStart, metadata),
            };
          }
        }
        continue;
      }
    }

    const gfmLiteralAutolinkEnd = getGfmLiteralAutolinkEnd(value, sourceIndex);
    if (gfmLiteralAutolinkEnd !== null) {
      text += value.slice(sourceIndex, gfmLiteralAutolinkEnd);
      sourceIndex = gfmLiteralAutolinkEnd;
      continue;
    }

    const openingCodeFence =
      (value[sourceIndex] === '`' || value[sourceIndex] === '~') &&
      (sourceIndex === 0 || /[\r\n >*+\-.]/u.test(value[sourceIndex - 1]!))
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
        const imageEnd = getOrdinaryLinkEnd(value, sourceIndex, true);
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
