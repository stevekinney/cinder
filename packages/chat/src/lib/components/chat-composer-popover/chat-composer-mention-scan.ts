import { getLineEnd, getLineEndingLength } from './chat-composer-mention-lines.ts';

export type ScanMetadata = {
  escaped: Uint8Array;
  lineStarts: Int32Array;
  containerStarts: Map<number, number>;
  containerContexts: Map<number, ContainerContext>;
  codeSpanEnds: Map<number, number>;
  mathEnds: Map<number, number>;
};

export type ContainerContext = {
  quoteDepth: number;
  listDepth: number;
  listContinuationIndentation: number;
  maximumIndentation: number;
};

export type CodeFence = {
  delimiter: '`' | '~';
  minimumLength: number;
  container: ContainerContext;
};

const EMPTY_CONTAINER_CONTEXT: ContainerContext = {
  quoteDepth: 0,
  listDepth: 0,
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
  const mathEnds = new Map<number, number>();
  const paragraphBreaks = new Set<number>();
  let previousLineWasParagraph = false;

  let backslashes = 0;
  let lineStart = 0;
  for (let index = 0; index < value.length; index += 1) {
    escaped[index] = backslashes % 2;
    lineStarts[index] = lineStart;
    backslashes = value[index] === '\\' ? backslashes + 1 : 0;
    if (value[index] === '\n' || (value[index] === '\r' && value[index + 1] !== '\n')) {
      if (/^\s*$/u.test(value.slice(lineStart, index))) paragraphBreaks.add(index);
      lineStart = index + 1;
    }
  }

  for (let start = 0; start < value.length; ) {
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

      const markerStart = cursor;
      let markerWidth = 0;
      if (
        (value[cursor] === '-' || value[cursor] === '*' || value[cursor] === '+') &&
        /[\t \r\n]/u.test(value[cursor + 1] ?? '\n')
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
      cursor += Math.min(4, followingWhitespace);
      maximumIndentation = Math.max(maximumIndentation, followingWhitespace);
      listDepth += 1;
      listContinuationIndentation += markerWidth + Math.max(1, Math.min(4, followingWhitespace));
    }
    if (cursor !== start) containerStarts.set(start, cursor);
    if (quoteDepth > 0 || listDepth > 0 || maximumIndentation > 0) {
      containerContexts.set(start, {
        quoteDepth,
        listDepth,
        listContinuationIndentation,
        maximumIndentation,
      });
    }
    const lineEnd = getLineEnd(value, start);
    const content = value.slice(cursor, lineEnd).trim();
    previousLineWasParagraph =
      quoteDepth === 0 &&
      listDepth === 0 &&
      content.length > 0 &&
      !/^(?:#{1,6}(?:[ \t]+|$)|(?:[*_-][ \t]*){3,}$|(?:`{3,}|~{3,})|<|\[[^\]^]+\]:)/u.test(content);
    if (lineEnd === value.length) break;
    start = lineEnd + getLineEndingLength(value, lineEnd);
  }

  const nextCodeRun = new Map<number, number>();
  const nextMathClose = new Map<number, number>();
  for (let index = value.length - 1; index >= 0; ) {
    const character = value[index];
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
    if (character === '`') {
      const next = nextCodeRun.get(length);
      if (next !== undefined) codeSpanEnds.set(start, next + length);
      nextCodeRun.set(length, start);
    } else if (escaped[start] !== 1) {
      const next = nextMathClose.get(length);
      if (next !== undefined) mathEnds.set(start, next + length);
      if (
        length === 2 ||
        (length === 1 &&
          !/\s/u.test(value[start - 1] ?? '') &&
          !/[0-9]/u.test(value[index + 1] ?? ''))
      ) {
        nextMathClose.set(length, start);
      }
    }
    index = start - 1;
  }

  return { escaped, lineStarts, containerStarts, containerContexts, codeSpanEnds, mathEnds };
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
    ? { delimiter, minimumLength, container: getContainerContext(lineStart, metadata) }
    : null;
}

export function isClosingCodeFence(
  value: string,
  start: number,
  fence: CodeFence,
  metadata: ScanMetadata,
): boolean {
  const lineStart = metadata.lineStarts[start] ?? 0;
  if (
    !isContainerActive(fence.container, lineStart, metadata) ||
    start !== (metadata.containerStarts.get(lineStart) ?? lineStart)
  ) {
    return false;
  }

  const length = countRun(value, start, fence.delimiter);
  if (length < fence.minimumLength) return false;
  const lineEnd = getLineEnd(value, start + length);
  return /^ *$/u.test(value.slice(start + length, lineEnd));
}

export function hasEscapedPrefix(index: number, metadata: ScanMetadata): boolean {
  return metadata.escaped[index] === 1;
}

export function getMathEnd(value: string, start: number, metadata: ScanMetadata): number | null {
  if (hasEscapedPrefix(start, metadata)) return null;
  const delimiterLength = value[start + 1] !== '$' ? 1 : value[start + 2] !== '$' ? 2 : 3;
  if (delimiterLength > 2 || (delimiterLength === 1 && /\s/u.test(value[start + 1] ?? ''))) {
    return null;
  }
  return metadata.mathEnds.get(start) ?? null;
}

export function isIndentedCodeStart(value: string, index: number, metadata: ScanMetadata): boolean {
  const lineStart = metadata.lineStarts[index] ?? 0;
  if (lineStart !== index || !isIndentedCodeLine(value, lineStart)) return false;
  if (lineStart === 0) return true;

  const previousLineStart = metadata.lineStarts[lineStart - 1] ?? 0;
  if (/^\s*$/u.test(value.slice(previousLineStart, lineStart - 1))) return true;

  const previousContentStart = metadata.containerStarts.get(previousLineStart) ?? previousLineStart;
  const previousLine = value.slice(previousContentStart, lineStart - 1).trimEnd();
  const previousContainer = metadata.containerContexts.get(previousLineStart);
  return (
    (previousContainer?.quoteDepth ?? 0) > 0 ||
    (previousContainer?.listDepth ?? 0) > 0 ||
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
