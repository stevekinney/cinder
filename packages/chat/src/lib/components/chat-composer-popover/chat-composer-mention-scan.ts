import { isInterruptingHtmlBlockStart } from './chat-composer-mention-html-tags.ts';
import { getLineEnd, getLineEndingLength } from './chat-composer-mention-lines.ts';

export type ScanMetadata = {
  escaped: Uint8Array;
  lineStarts: Int32Array;
  containerStarts: Map<number, number>;
  containerContexts: Map<number, ContainerContext>;
  codeSpanEnds: Map<number, number>;
  labelBounds: Map<number, { end: number; containsNestedLink: boolean }>;
  mathEnds: Map<number, number>;
  paragraphLineStarts: Set<number>;
  completedBlockLineStarts: Set<number>;
};

export type ContainerContext = {
  quoteDepth: number;
  listDepth: number;
  startsListItem: boolean;
  listContinuationIndentation: number;
  maximumIndentation: number;
};

export type CodeFence = {
  delimiter: '`' | '~';
  minimumLength: number;
  container: ContainerContext;
  openingLineStart: number;
};

const EMPTY_CONTAINER_CONTEXT: ContainerContext = {
  quoteDepth: 0,
  listDepth: 0,
  startsListItem: false,
  listContinuationIndentation: 0,
  maximumIndentation: 0,
};

export function countRun(value: string, start: number, character: string): number {
  let length = 0;
  while (value[start + length] === character) length += 1;
  return length;
}

export function makeScanMetadata(value: string): ScanMetadata {
  const escaped = new Uint8Array(value.length);
  const lineStarts = new Int32Array(value.length);
  const containerStarts = new Map<number, number>();
  const containerContexts = new Map<number, ContainerContext>();
  const codeSpanEnds = new Map<number, number>();
  const labelBounds = new Map<number, { end: number; containsNestedLink: boolean }>();
  const mathEnds = new Map<number, number>();
  const paragraphBreaks = new Set<number>();
  const paragraphLineStarts = new Set<number>();
  const completedBlockLineStarts = new Set<number>();
  let previousLineWasParagraph = false;
  let previousQuoteDepth = 0;

  let backslashes = 0;
  let lineStart = 0;
  let nestedLinkCount = 0;
  const labelStack: Array<{ start: number; nestedLinkCount: number }> = [];
  for (let index = 0; index < value.length; index += 1) {
    escaped[index] = backslashes % 2;
    lineStarts[index] = lineStart;
    if (escaped[index] === 0) {
      if (value[index] === '!' && value[index + 1] === '[') nestedLinkCount += 1;
      if (value[index] === '[') {
        labelStack.push({ start: index, nestedLinkCount });
      } else if (value[index] === ']' && labelStack.length > 0) {
        const opening = labelStack.pop()!;
        labelBounds.set(opening.start, {
          end: index,
          containsNestedLink: nestedLinkCount > opening.nestedLinkCount,
        });
        if (value[index + 1] === '(' || value[index + 1] === '[') nestedLinkCount += 1;
      }
    }
    backslashes = value[index] === '\\' ? backslashes + 1 : 0;
    if (value[index] === '\n' || (value[index] === '\r' && value[index + 1] !== '\n')) {
      if (/^\s*$/u.test(value.slice(lineStart, index))) paragraphBreaks.add(index);
      lineStart = index + 1;
    }
  }

  for (let start = 0; start < value.length; ) {
    const lineEnd = getLineEnd(value, start);
    let cursor = start;
    let quoteDepth = 0;
    let listDepth = 0;
    let listContinuationIndentation = 0;
    let maximumIndentation = 0;
    let indentation = 0;
    const consumeIndentation = (limit: number) => {
      let available = 0;
      while (value[cursor + available] === ' ') available += 1;
      indentation = Math.min(limit, available);
      maximumIndentation = Math.max(maximumIndentation, available);
      cursor += indentation;
    };

    consumeIndentation(3);
    while (cursor < value.length) {
      if (value[cursor] === '>') {
        quoteDepth += 1;
        cursor += 1;
        consumeIndentation(4);
        continue;
      }

      if (quoteDepth !== previousQuoteDepth) previousLineWasParagraph = false;

      const markerStart = cursor;
      let markerWidth = 0;
      if (
        (value[cursor] === '-' || value[cursor] === '*' || value[cursor] === '+') &&
        /[\t \r\n]/u.test(value[cursor + 1] ?? '\n') &&
        !(previousLineWasParagraph && /^[ \t]*$/u.test(value.slice(cursor + 1, lineEnd)))
      ) {
        markerWidth = 1;
      } else {
        while (/\d/u.test(value[cursor] ?? '')) cursor += 1;
        if (
          cursor > markerStart &&
          cursor - markerStart <= 9 &&
          (value[cursor] === '.' || value[cursor] === ')') &&
          /[\t \r\n]/u.test(value[cursor + 1] ?? '\n') &&
          (!previousLineWasParagraph || value.slice(markerStart, cursor) === '1')
        ) {
          markerWidth = cursor - markerStart + 1;
        }
      }
      if (markerWidth === 0) {
        cursor = markerStart;
        break;
      }

      cursor = markerStart + markerWidth;
      let followingWhitespace = 0;
      while (/[ \t]/u.test(value[cursor + followingWhitespace] ?? '')) followingWhitespace += 1;
      const consumedWhitespace = followingWhitespace > 4 ? 1 : followingWhitespace;
      cursor += consumedWhitespace;
      maximumIndentation = Math.max(maximumIndentation, followingWhitespace);
      listDepth += 1;
      listContinuationIndentation += markerWidth + Math.max(1, consumedWhitespace);
    }
    if (cursor !== start) containerStarts.set(start, cursor);
    if (quoteDepth > 0 || listDepth > 0 || maximumIndentation > 0) {
      containerContexts.set(start, {
        quoteDepth,
        listDepth,
        startsListItem: listDepth > 0,
        listContinuationIndentation,
        maximumIndentation,
      });
    }
    const content = value.slice(cursor, lineEnd).trim();
    const completedBlock =
      /^(?:#{1,6}(?:[ \t]+|$)|(?:[*_-][ \t]*){3,}$|(?:=+|-+)[ \t]*$|(?:`{3,}|~{3,}))/u.test(
        content,
      );
    if (completedBlock) completedBlockLineStarts.add(start);
    const startsBlock: boolean =
      completedBlock ||
      isInterruptingHtmlBlockStart(content) ||
      (!previousLineWasParagraph &&
        /^<\/?[A-Za-z][A-Za-z0-9-]*(?:\s[^>]*)?>[ \t]*$/u.test(content));
    previousLineWasParagraph =
      listDepth === 0 && content.length > 0 && !startsBlock && !/^\[[^\]^]+\]:/u.test(content);
    if (content.length > 0 && !startsBlock && !/^\[[^\]^]+\]:/u.test(content)) {
      paragraphLineStarts.add(start);
    }
    previousQuoteDepth = quoteDepth;
    if (lineEnd === value.length) break;
    start = lineEnd + getLineEndingLength(value, lineEnd);
  }

  const nextCodeRun = new Map<number, number>();
  const nextMathClose = new Map<number, number>();
  for (let index = value.length - 1; index >= 0; ) {
    const character = value[index];
    if (index === lineStarts[index] && !paragraphLineStarts.has(index)) {
      nextCodeRun.clear();
      nextMathClose.delete(1);
    }
    if (index === lineStarts[index] && containerContexts.get(index)?.startsListItem) {
      nextCodeRun.clear();
    }
    if (paragraphBreaks.has(index)) {
      nextCodeRun.clear();
      nextMathClose.delete(1);
    }
    if (character !== '`' && character !== '$') {
      index -= 1;
      continue;
    }

    let start = index;
    while (start > 0 && value[start - 1] === character) start -= 1;
    const length = index - start + 1;
    if (character === '`' && escaped[start] !== 1) {
      const next = nextCodeRun.get(length);
      if (next !== undefined) codeSpanEnds.set(start, next + length);
      nextCodeRun.set(length, start);
    } else if (escaped[start] !== 1) {
      const next = nextMathClose.get(length);
      if (next !== undefined) mathEnds.set(start, next + length);
      if (
        length >= 2 ||
        (length === 1 &&
          !/\s/u.test(value[start - 1] ?? '') &&
          !/[0-9]/u.test(value[index + 1] ?? ''))
      ) {
        nextMathClose.set(length, start);
      }
    }
    index = start - 1;
  }

  return {
    escaped,
    lineStarts,
    containerStarts,
    containerContexts,
    codeSpanEnds,
    labelBounds,
    mathEnds,
    paragraphLineStarts,
    completedBlockLineStarts,
  };
}

export function isContainerActive(
  expected: ContainerContext,
  lineStart: number,
  metadata: ScanMetadata,
): boolean {
  const current = getContainerContext(lineStart, metadata);
  if (current.quoteDepth < expected.quoteDepth) return false;
  if (expected.listDepth === 0 || current.listDepth >= expected.listDepth) return true;
  return current.maximumIndentation >= expected.listContinuationIndentation;
}

export function getContainerContext(lineStart: number, metadata: ScanMetadata): ContainerContext {
  return metadata.containerContexts.get(lineStart) ?? EMPTY_CONTAINER_CONTEXT;
}

export function getOpeningCodeFence(
  value: string,
  start: number,
  metadata: ScanMetadata,
): CodeFence | null {
  const delimiter = value[start];
  const lineStart = metadata.lineStarts[start] ?? 0;
  if (
    (delimiter !== '`' && delimiter !== '~') ||
    hasEscapedPrefix(start, metadata) ||
    start !== (metadata.containerStarts.get(lineStart) ?? lineStart)
  ) {
    return null;
  }

  const minimumLength = countRun(value, start, delimiter);
  const lineEnd = getLineEnd(value, start + minimumLength);
  const information = value.slice(start + minimumLength, lineEnd);
  if (delimiter === '`' && information.includes('`')) return null;

  return minimumLength >= 3
    ? {
        delimiter,
        minimumLength,
        container: getContainerContext(lineStart, metadata),
        openingLineStart: lineStart,
      }
    : null;
}

export function isFenceContainerActive(
  fence: CodeFence,
  lineStart: number,
  metadata: ScanMetadata,
): boolean {
  const current = getContainerContext(lineStart, metadata);
  if (
    lineStart !== fence.openingLineStart &&
    current.startsListItem &&
    current.listDepth <= fence.container.listDepth
  ) {
    return false;
  }
  return isContainerActive(fence.container, lineStart, metadata);
}

export function isClosingCodeFence(
  value: string,
  start: number,
  fence: CodeFence,
  metadata: ScanMetadata,
): boolean {
  const lineStart = metadata.lineStarts[start] ?? 0;
  if (
    !isFenceContainerActive(fence, lineStart, metadata) ||
    start !== (metadata.containerStarts.get(lineStart) ?? lineStart)
  ) {
    return false;
  }

  const length = countRun(value, start, fence.delimiter);
  if (length < fence.minimumLength) return false;
  const lineEnd = getLineEnd(value, start + length);
  return /^[ \t]*$/u.test(value.slice(start + length, lineEnd));
}

export function hasEscapedPrefix(index: number, metadata: ScanMetadata): boolean {
  return metadata.escaped[index] === 1;
}

export function getMathEnd(value: string, start: number, metadata: ScanMetadata): number | null {
  if (hasEscapedPrefix(start, metadata)) return null;
  if (value[start + 1] !== '$' && /\s/u.test(value[start + 1] ?? '')) {
    return null;
  }
  return metadata.mathEnds.get(start) ?? null;
}

export function isIndentedCodeStart(value: string, index: number, metadata: ScanMetadata): boolean {
  const lineStart = metadata.lineStarts[index] ?? 0;
  const containerStart = metadata.containerStarts.get(lineStart) ?? lineStart;
  const startsListContent =
    index === containerStart && getContainerContext(lineStart, metadata).startsListItem;
  if ((lineStart !== index && !startsListContent) || !isIndentedCodeLine(value, index))
    return false;
  if (lineStart === 0) return true;

  const previousLineStart = metadata.lineStarts[lineStart - 1] ?? 0;
  const beforeBlankLine = metadata.lineStarts[previousLineStart - 1] ?? previousLineStart;
  if (/^\s*$/u.test(value.slice(previousLineStart, lineStart - 1))) {
    const parentContainer = getContainerContext(beforeBlankLine, metadata);
    if (parentContainer.listDepth === 0) return true;
    return (
      getContainerContext(lineStart, metadata).maximumIndentation >=
      parentContainer.listContinuationIndentation + 4
    );
  }

  const previousContentStart = metadata.containerStarts.get(previousLineStart) ?? previousLineStart;
  const previousLine = value.slice(previousContentStart, lineStart - 1).trimEnd();
  const previousContainer = metadata.containerContexts.get(previousLineStart);
  const currentContainer = metadata.containerContexts.get(lineStart);
  return (
    (currentContainer?.quoteDepth ?? 0) > (previousContainer?.quoteDepth ?? 0) ||
    (currentContainer?.listDepth ?? 0) > (previousContainer?.listDepth ?? 0) ||
    /^(?:#{1,6}(?:[ \t]+|$)|(?:=+|-+)[ \t]*$|(?:`{3,}|~{3,})|<\/?[A-Za-z]|<!--|<\?|<!\[CDATA\[)/u.test(
      previousLine,
    )
  );
}

export function isIndentedCodeLine(value: string, lineStart: number): boolean {
  let cursor = lineStart;
  let column = 0;
  while (cursor < value.length) {
    if (value[cursor] === ' ') {
      column += 1;
      cursor += 1;
    } else if (value[cursor] === '\t') {
      column += 4 - (column % 4);
      cursor += 1;
    } else if (value[cursor] === '>' && column <= 3) {
      cursor += 1;
      if (value[cursor] === ' ') cursor += 1;
      column = 0;
    } else {
      break;
    }
  }
  return column >= 4;
}
