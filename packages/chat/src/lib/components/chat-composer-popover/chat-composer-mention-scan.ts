import { getLineEnd, getLineEndingLength } from './chat-composer-mention-lines.ts';

export type ScanMetadata = {
  escaped: Uint8Array;
  lineStarts: Int32Array;
  containerStarts: Map<number, number>;
  codeSpanEnds: Map<number, number>;
  mathEnds: Map<number, number>;
};

export function makeScanMetadata(value: string): ScanMetadata {
  const escaped = new Uint8Array(value.length);
  const lineStarts = new Int32Array(value.length);
  const containerStarts = new Map<number, number>();
  const codeSpanEnds = new Map<number, number>();
  const mathEnds = new Map<number, number>();
  const paragraphBreaks = new Set<number>();

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
    let hasContainer = false;
    let indentation = 0;
    while (indentation < 3 && value[cursor] === ' ') {
      cursor += 1;
      indentation += 1;
    }
    while (value[cursor] === '>') {
      hasContainer = true;
      cursor += 1;
      if (value[cursor] === ' ') cursor += 1;
    }
    if (
      (value[cursor] === '-' || value[cursor] === '*' || value[cursor] === '+') &&
      /[\t \r\n]/u.test(value[cursor + 1] ?? '\n')
    ) {
      hasContainer = true;
      cursor += 1;
      if (value[cursor] === ' ') cursor += 1;
    } else {
      const markerStart = cursor;
      while (/\d/u.test(value[cursor] ?? '')) cursor += 1;
      if (
        cursor > markerStart &&
        value[cursor] === '.' &&
        /[\t \r\n]/u.test(value[cursor + 1] ?? '\n')
      ) {
        hasContainer = true;
        cursor += 1;
        if (value[cursor] === ' ') cursor += 1;
      }
    }
    if (hasContainer) {
      indentation = 0;
      while (indentation < 3 && value[cursor] === ' ') {
        cursor += 1;
        indentation += 1;
      }
    }
    containerStarts.set(start, cursor);
    const lineEnd = getLineEnd(value, start);
    if (lineEnd === value.length) break;
    start = lineEnd + getLineEndingLength(value, lineEnd);
  }

  const nextCodeRun = new Map<number, number>();
  const nextMathClose = new Map<number, number>();
  for (let index = value.length - 1; index >= 0; ) {
    const character = value[index];
    if (paragraphBreaks.has(index)) nextCodeRun.clear();
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

  return { escaped, lineStarts, containerStarts, codeSpanEnds, mathEnds };
}

export function hasEscapedPrefix(index: number, metadata: ScanMetadata): boolean {
  return metadata.escaped[index] === 1;
}

export function isIndentedCodeStart(value: string, index: number, metadata: ScanMetadata): boolean {
  const lineStart = metadata.lineStarts[index] ?? 0;
  if (lineStart !== index || !isIndentedCodeLine(value, lineStart)) return false;
  if (lineStart === 0) return true;

  const previousLineStart = metadata.lineStarts[lineStart - 1] ?? 0;
  return /^\s*$/u.test(value.slice(previousLineStart, lineStart - 1));
}

export function isIndentedCodeLine(value: string, lineStart: number): boolean {
  let cursor = lineStart;
  let indentation = 0;
  while (indentation < 3 && value[cursor] === ' ') {
    cursor += 1;
    indentation += 1;
  }

  if (value[cursor] !== '>') cursor = lineStart;
  while (value[cursor] === '>') {
    cursor += 1;
    if (value[cursor] === ' ') cursor += 1;
  }

  return value.startsWith('    ', cursor) || value[cursor] === '\t';
}
