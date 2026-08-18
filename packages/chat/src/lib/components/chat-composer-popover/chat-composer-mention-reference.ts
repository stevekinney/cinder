import type { ScanMetadata } from './chat-composer-mention-scan.ts';

export function getReferenceDefinitionEnd(
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

  const lineEnd = value.indexOf('\n', labelEnd + 2);
  const end = lineEnd === -1 ? value.length : lineEnd;
  let cursor = labelEnd + 2;
  while (value[cursor] === ' ' || value[cursor] === '\t') cursor += 1;
  if (cursor >= end) return null;

  if (value[cursor] === '<') {
    cursor += 1;
    while (cursor < end && value[cursor] !== '>') {
      if (value[cursor] === '\\') cursor += 1;
      cursor += 1;
    }
    if (value[cursor] !== '>') return null;
    cursor += 1;
  } else {
    let parentheses = 0;
    while (cursor < end && !/\s/u.test(value[cursor]!)) {
      if (value[cursor] === '\\') cursor += 1;
      else if (value[cursor] === '(') parentheses += 1;
      else if (value[cursor] === ')') {
        if (parentheses === 0) break;
        parentheses -= 1;
      }
      cursor += 1;
    }
    if (parentheses !== 0) return null;
  }

  while (value[cursor] === ' ' || value[cursor] === '\t') cursor += 1;
  if (cursor < end && value[cursor] !== '\r') {
    const opener = value[cursor];
    const closer = opener === '(' ? ')' : opener;
    if (opener !== '"' && opener !== "'" && opener !== '(') return null;
    cursor += 1;
    while (cursor < end && value[cursor] !== closer) {
      if (value[cursor] === '\\') cursor += 1;
      cursor += 1;
    }
    if (value[cursor] !== closer) return null;
    cursor += 1;
    while (value[cursor] === ' ' || value[cursor] === '\t') cursor += 1;
  }

  if (cursor !== end && !(value[cursor] === '\r' && cursor + 1 === end)) return null;
  if (lineEnd === -1) return end;

  const titleLineStart = lineEnd + 1;
  const titleLineEnd = value.indexOf('\n', titleLineStart);
  const titleEnd = titleLineEnd === -1 ? value.length : titleLineEnd;
  let titleCursor = titleLineStart;
  let indentation = 0;
  while (indentation < 4 && value[titleCursor] === ' ') {
    titleCursor += 1;
    indentation += 1;
  }
  if (indentation > 3) return end;

  const opener = value[titleCursor];
  const closer = opener === '(' ? ')' : opener;
  if (opener !== '"' && opener !== "'" && opener !== '(') return end;
  titleCursor += 1;
  while (titleCursor < titleEnd && value[titleCursor] !== closer) {
    if (value[titleCursor] === '\\') titleCursor += 1;
    titleCursor += 1;
  }
  if (value[titleCursor] !== closer) return end;
  titleCursor += 1;
  while (value[titleCursor] === ' ' || value[titleCursor] === '\t') titleCursor += 1;

  return titleCursor === titleEnd || (value[titleCursor] === '\r' && titleCursor + 1 === titleEnd)
    ? titleEnd
    : end;
}
