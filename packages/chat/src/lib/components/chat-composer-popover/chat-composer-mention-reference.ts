import { getHtmlBlockEndAt } from './chat-composer-mention-html.ts';
import { getLineEnd, getLineEndingLength } from './chat-composer-mention-lines.ts';
import { normalizeReferenceLabel } from './chat-composer-mention-link.ts';
import {
  getContainerContext,
  getOpeningCodeFence,
  isClosingCodeFence,
  isContainerActive,
  isFenceContainerActive,
  isIndentedCodeLine,
  isIndentedCodeStart,
  type CodeFence,
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
      if (
        value[cursor] === '\\' &&
        /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/u.test(value[cursor + 1] ?? '')
      ) {
        cursor += 2;
        continue;
      } else if (value[cursor] === '<' || value[cursor] === '>') return null;
      else if (value[cursor] === '(') parentheses += 1;
      else if (value[cursor] === ')') {
        if (parentheses === 0) break;
        parentheses -= 1;
      }
      cursor += 1;
    }
    if (parentheses !== 0) return null;
  }

  const destinationEnd = cursor;
  while (value[cursor] === ' ' || value[cursor] === '\t') cursor += 1;
  if (cursor < end && value[cursor] !== '\r') {
    if (cursor === destinationEnd) return null;
    const opener = value[cursor];
    const closer = opener === '(' ? ')' : opener;
    if (opener !== '"' && opener !== "'" && opener !== '(') return null;
    cursor += 1;
    while (value[cursor] !== closer) {
      if (opener === '(' && value[cursor] === '(') return null;
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
    if (opener === '(' && value[titleCursor] === '(') return end;
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

function getReferenceLabelSource(
  value: string,
  start: number,
  end: number,
  metadata: ScanMetadata,
): string {
  let label = '';
  let cursor = start;
  while (cursor < end) {
    const lineEnd = Math.min(getLineEnd(value, cursor), end);
    label += value.slice(cursor, lineEnd);
    if (lineEnd === end) break;
    const nextLineStart = lineEnd + getLineEndingLength(value, lineEnd);
    label += ' ';
    cursor = metadata.containerStarts.get(nextLineStart) ?? nextLineStart;
  }
  return label;
}

export function collectResolvedReferenceLabels(value: string, metadata: ScanMetadata): Set<string> {
  const labels = new Set<string>();
  let codeFence: CodeFence | null = null;
  let htmlBlockEnd = 0;
  let indentedCode = false;
  for (let lineStart = 0; lineStart < value.length; ) {
    const lineEnd = getLineEnd(value, lineStart);
    let candidate = metadata.containerStarts.get(lineStart) ?? lineStart;
    let indentation = 0;
    while (indentation < 3 && value[candidate] === ' ') {
      candidate += 1;
      indentation += 1;
    }
    let literalBlockLine = lineStart < htmlBlockEnd;
    if (!literalBlockLine && codeFence !== null) {
      if (!isFenceContainerActive(codeFence, lineStart, metadata)) {
        codeFence = null;
      } else {
        if (
          value[candidate] === codeFence.delimiter &&
          isClosingCodeFence(value, candidate, codeFence, metadata)
        ) {
          codeFence = null;
        }
        literalBlockLine = true;
      }
    }
    if (!literalBlockLine && indentedCode) {
      const line = value.slice(lineStart, lineEnd);
      if (line.trim().length === 0 || !isIndentedCodeLine(value, lineStart)) {
        indentedCode = false;
      } else {
        literalBlockLine = true;
      }
    }
    if (!literalBlockLine && isIndentedCodeStart(value, lineStart, metadata)) {
      indentedCode = true;
      literalBlockLine = true;
    }
    if (!literalBlockLine) {
      const openingCodeFence = getOpeningCodeFence(value, candidate, metadata);
      if (openingCodeFence !== null) {
        codeFence = openingCodeFence;
        literalBlockLine = true;
      }
    }
    if (!literalBlockLine) {
      const detectedHtmlBlockEnd = getHtmlBlockEndAt(value, candidate, metadata);
      if (detectedHtmlBlockEnd !== null) {
        htmlBlockEnd = detectedHtmlBlockEnd;
        literalBlockLine = true;
      }
    }
    if (
      !literalBlockLine &&
      value[candidate] === '[' &&
      getReferenceDefinitionEnd(value, candidate, metadata) !== null
    ) {
      let labelEnd = candidate + 1;
      while (labelEnd < value.length && value[labelEnd] !== ']') {
        labelEnd += value[labelEnd] === '\\' ? 2 : 1;
      }
      labels.add(
        normalizeReferenceLabel(getReferenceLabelSource(value, candidate + 1, labelEnd, metadata)),
      );
    }
    if (lineEnd === value.length) break;
    lineStart = lineEnd + getLineEndingLength(value, lineEnd);
  }
  return labels;
}
