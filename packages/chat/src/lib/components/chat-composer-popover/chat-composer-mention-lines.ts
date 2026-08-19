export function getLineEnd(value: string, start: number): number {
  for (let index = start; index < value.length; index += 1) {
    if (value[index] === '\n' || value[index] === '\r') return index;
  }
  return value.length;
}

export function getLineEndingLength(value: string, lineEnd: number): number {
  if (lineEnd >= value.length) return 0;
  return value[lineEnd] === '\r' && value[lineEnd + 1] === '\n' ? 2 : 1;
}

export function isLineEnding(character: string | undefined): boolean {
  return character === '\n' || character === '\r';
}
