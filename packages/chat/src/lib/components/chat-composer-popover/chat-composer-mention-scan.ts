export type ScanMetadata = {
  escaped: Uint8Array;
  lineStarts: Int32Array;
  containerStarts: Int32Array;
  codeSpanEnds: Int32Array;
  mathEnds: Int32Array;
};

export function makeScanMetadata(value: string): ScanMetadata {
  const escaped = new Uint8Array(value.length);
  const lineStarts = new Int32Array(value.length);
  const containerStarts = new Int32Array(value.length);
  const codeSpanEnds = new Int32Array(value.length);
  const mathEnds = new Int32Array(value.length);
  codeSpanEnds.fill(-1);
  mathEnds.fill(-1);

  let backslashes = 0;
  let lineStart = 0;
  for (let index = 0; index < value.length; index += 1) {
    escaped[index] = backslashes % 2;
    lineStarts[index] = lineStart;
    backslashes = value[index] === '\\' ? backslashes + 1 : 0;
    if (value[index] === '\n') lineStart = index + 1;
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
    if (value[cursor] === '-' || value[cursor] === '*' || value[cursor] === '+') {
      hasContainer = true;
      cursor += 1;
      if (value[cursor] === ' ') cursor += 1;
    } else {
      const markerStart = cursor;
      while (/\d/u.test(value[cursor] ?? '')) cursor += 1;
      if (cursor > markerStart && value[cursor] === '.') {
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
    containerStarts[start] = cursor;
    const lineEnd = value.indexOf('\n', start);
    if (lineEnd === -1) break;
    start = lineEnd + 1;
  }

  const nextCodeRun = new Map<number, number>();
  const nextMathClose = new Map<number, number>();
  for (let index = value.length - 1; index >= 0; ) {
    const character = value[index];
    if (character !== '`' && character !== '$') {
      index -= 1;
      continue;
    }

    let start = index;
    while (start > 0 && value[start - 1] === character) start -= 1;
    const length = index - start + 1;
    if (character === '`') {
      const next = nextCodeRun.get(length);
      if (next !== undefined) codeSpanEnds[start] = next + length;
      nextCodeRun.set(length, start);
    } else if (escaped[start] !== 1) {
      const next = nextMathClose.get(length);
      if (next !== undefined) mathEnds[start] = next + length;
      if (
        length === 2 ||
        (length === 1 &&
          !/[0-9\s]/u.test(value[start - 1] ?? '') &&
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
