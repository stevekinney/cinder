import { getLineEnd, getLineEndingLength } from './chat-composer-mention-lines.ts';
import {
  getContainerContext,
  isContainerActive,
  type ScanMetadata,
} from './chat-composer-mention-scan.ts';

export function getReferenceDefinitionEnd(
  value: string,
  start: number,
  metadata: ScanMetadata,
): number | null {
  const lineStart = metadata.lineStarts[start] ?? 0;
  const containerStart = metadata.containerStarts.get(lineStart) ?? lineStart;
  if (start - containerStart > 3) return null;
  for (let index = containerStart; index < start; index += 1) {
    if (value[index] !== ' ') return null;
  }
  if (lineStart > 0) {
    const previousLineStart = metadata.lineStarts[lineStart - 1] ?? 0;
    const currentContainer = getContainerContext(lineStart, metadata);
    const previousContainer = getContainerContext(previousLineStart, metadata);
    if (
      currentContainer.quoteDepth === previousContainer.quoteDepth &&
      currentContainer.listDepth === previousContainer.listDepth &&
      metadata.paragraphLineStarts.has(previousLineStart)
    )
      return null;
  }
  let labelEnd = start + 1;
  if (value[labelEnd] === '^') return null;
  while (labelEnd < value.length && value[labelEnd] !== ']') {
    if (labelEnd - start > 999 || value[labelEnd] === '[') return null;
    if (value[labelEnd] === '\\') labelEnd += 2;
    else labelEnd += 1;
  }
  if (/(?:\r\n?|\n)[ \t>]*(?:\r\n?|\n)/u.test(value.slice(start + 1, labelEnd))) return null;
  if (!/\S/u.test(value.slice(start + 1, labelEnd))) return null;
  if (value[labelEnd] !== ']' || value[labelEnd + 1] !== ':') return null;

  let lineEnd = getLineEnd(value, labelEnd + 2);
  let end = lineEnd;
  let cursor = labelEnd + 2;
  while (value[cursor] === ' ' || value[cursor] === '\t') cursor += 1;
  if (cursor >= end) {
    if (lineEnd === value.length) return null;
    const nextLineStart = lineEnd + getLineEndingLength(value, lineEnd);
    if (!isContainerActive(getContainerContext(lineStart, metadata), nextLineStart, metadata)) {
      return null;
    }
    if (getContainerContext(nextLineStart, metadata).maximumIndentation > 3) return null;
    cursor = metadata.containerStarts.get(nextLineStart) ?? nextLineStart;
    lineEnd = getLineEnd(value, cursor);
    end = lineEnd;
    if (cursor >= end) return null;
  }

  if (value[cursor] === '<') {
    cursor += 1;
    while (cursor < end && value[cursor] !== '>') {
      if (value[cursor] === '\\') cursor += 1;
      else if (value[cursor] === '<' || value[cursor] === '\r' || value[cursor] === '\n')
        return null;
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
    while (value[cursor] !== closer) {
      if (cursor >= end) {
        if (lineEnd === value.length) return null;
        const nextLineStart = lineEnd + getLineEndingLength(value, lineEnd);
        if (!isContainerActive(getContainerContext(lineStart, metadata), nextLineStart, metadata)) {
          return null;
        }
        const nextContainer = getContainerContext(nextLineStart, metadata);
        if (nextContainer.maximumIndentation > 3) return null;
        cursor = metadata.containerStarts.get(nextLineStart) ?? nextLineStart;
        lineEnd = getLineEnd(value, cursor);
        end = lineEnd;
        if (cursor >= end) return null;
        continue;
      }
      if (value[cursor] === '\\') cursor += 1;
      cursor += 1;
    }
    cursor += 1;
    while (value[cursor] === ' ' || value[cursor] === '\t') cursor += 1;
    return cursor === end || (value[cursor] === '\r' && cursor + 1 === end) ? end : null;
  }

  if (cursor !== end && !(value[cursor] === '\r' && cursor + 1 === end)) return null;
  if (lineEnd === value.length) return end;

  const physicalTitleLineStart = lineEnd + getLineEndingLength(value, lineEnd);
  if (
    !isContainerActive(getContainerContext(lineStart, metadata), physicalTitleLineStart, metadata)
  ) {
    return end;
  }
  const titleLineStart =
    metadata.containerStarts.get(physicalTitleLineStart) ?? physicalTitleLineStart;
  const titleEnd = getLineEnd(value, titleLineStart);
  let titleCursor = titleLineStart;
  if (getContainerContext(physicalTitleLineStart, metadata).maximumIndentation > 3) return end;

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
