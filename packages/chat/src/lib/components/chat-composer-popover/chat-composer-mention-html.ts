import {
  closesHtmlBlockWithTag,
  isInterruptingHtmlBlockTag,
} from './chat-composer-mention-html-tags.ts';
import { getLineEnd, getLineEndingLength, isLineEnding } from './chat-composer-mention-lines.ts';
import {
  getContainerContext,
  isContainerActive,
  type ContainerContext,
  type ScanMetadata,
} from './chat-composer-mention-scan.ts';
export {
  closesHtmlBlockWithTag,
  isInterruptingHtmlBlockTag,
} from './chat-composer-mention-html-tags.ts';

export function isValidHtmlComment(value: string, start: number, end: number): boolean {
  const content = value.slice(start + 4, end - 3);
  return (
    value.startsWith('<!--', start) &&
    value.startsWith('-->', end - 3) &&
    content[0] !== '>' &&
    !content.startsWith('->') &&
    !content.endsWith('-') &&
    !content.includes('--')
  );
}

export function canStartHtmlBlock(
  value: string,
  lineStart: number,
  metadata: ScanMetadata,
): boolean {
  if (lineStart === 0) return true;

  const previousLineStart = metadata.lineStarts[lineStart - 1] ?? 0;
  if (metadata.completedBlockLineStarts.has(previousLineStart)) return true;
  const current = metadata.containerContexts.get(lineStart);
  const previous = metadata.containerContexts.get(previousLineStart);
  if (
    (current?.quoteDepth ?? 0) > (previous?.quoteDepth ?? 0) ||
    (current?.listDepth ?? 0) > (previous?.listDepth ?? 0)
  )
    return true;
  return /^\s*$/u.test(value.slice(previousLineStart, lineStart - 1));
}

export function getHtmlTagEnd(
  value: string,
  start: number,
  metadata?: ScanMetadata,
): number | null {
  if (!/[A-Za-z/!?]/u.test(value[start + 1] ?? '')) return null;

  const startingLine = metadata?.lineStarts[start] ?? 0;
  const startingContainer =
    metadata === undefined ? null : getContainerContext(startingLine, metadata);
  let quote: '"' | "'" | null = null;
  for (let index = start + 1; index < value.length; index += 1) {
    const character = value[index];
    if (isLineEnding(character)) {
      let next = index + getLineEndingLength(value, index);
      while (value[next] === ' ' || value[next] === '\t') next += 1;
      if (isLineEnding(value[next])) return null;
      if (metadata !== undefined && startingContainer !== null) {
        const nextLineStart = index + getLineEndingLength(value, index);
        const nextContainer = getContainerContext(nextLineStart, metadata);
        if (
          nextContainer.quoteDepth !== startingContainer.quoteDepth ||
          nextContainer.listDepth !== startingContainer.listDepth ||
          metadata.completedBlockLineStarts.has(nextLineStart) ||
          !metadata.paragraphLineStarts.has(nextLineStart)
        )
          return null;
      }
    }
    if (quote !== null) {
      if (character === quote) quote = null;
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (character === '<') {
      return null;
    } else if (character === '>') {
      const token = value.slice(start, index + 1);
      return /^(?:<[A-Za-z][A-Za-z0-9-]*(?:\s+[A-Za-z_:][A-Za-z0-9_.:-]*(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*\s*\/?>|<\/[A-Za-z][A-Za-z0-9-]*\s*>|<![A-Z][^>]*>|<\?[^>]*\?>)$/u.test(
        token,
      )
        ? index
        : null;
    }
  }
  return null;
}

export function getAutolinkEnd(value: string, start: number): number | null {
  let cursor = start + 1;
  while (cursor < value.length && value[cursor] !== '>') {
    if (value[cursor] === '<' || /\s/u.test(value[cursor]!)) return null;
    cursor += 1;
  }
  if (value[cursor] !== '>') return null;

  const destination = value.slice(start + 1, cursor);
  const uri = /^[A-Za-z][A-Za-z0-9+.-]{1,31}:[^<>]*$/u.test(destination);
  const email =
    /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*$/u.test(
      destination,
    );
  return uri || email ? cursor + 1 : null;
}

function getContainerBoundary(
  value: string,
  start: number,
  container: ContainerContext,
  metadata: ScanMetadata,
): number {
  let lineStart = metadata.lineStarts[start] ?? start;
  while (lineStart < value.length) {
    if (!isContainerActive(container, lineStart, metadata)) return lineStart;
    const lineEnd = getLineEnd(value, lineStart);
    lineStart = lineEnd + getLineEndingLength(value, lineEnd);
  }
  return value.length;
}

export function getHtmlDelimitedBlockEnd(
  value: string,
  start: number,
  terminator: string,
  container: ContainerContext,
  metadata: ScanMetadata,
): number | null {
  const boundary = getContainerBoundary(value, start, container, metadata);
  const closingStart = value.indexOf(terminator, start);
  if (closingStart !== -1 && closingStart + terminator.length <= boundary) {
    const closingLineEnd = getLineEnd(value, closingStart + terminator.length);
    return Math.min(boundary, closingLineEnd + getLineEndingLength(value, closingLineEnd));
  }
  return boundary < value.length ? boundary : null;
}

export function getHtmlBlockBlankLineEnd(
  value: string,
  start: number,
  container: ContainerContext,
  metadata: ScanMetadata,
): number | null {
  const boundary = getContainerBoundary(value, start, container, metadata);
  let lineEnd = getLineEnd(value, start);
  let lineStart = lineEnd + getLineEndingLength(value, lineEnd);
  while (lineStart < boundary) {
    lineEnd = getLineEnd(value, lineStart);
    const contentStart = metadata.containerStarts.get(lineStart) ?? lineStart;
    if (/^[ \t]*$/u.test(value.slice(contentStart, lineEnd))) {
      return lineEnd + getLineEndingLength(value, lineEnd);
    }
    lineStart = lineEnd + getLineEndingLength(value, lineEnd);
  }
  return boundary < value.length ? boundary : null;
}

export function getClosingHtmlBlockEnd(
  value: string,
  start: number,
  tag: string,
  container: ContainerContext,
  metadata: ScanMetadata,
): number | null {
  const boundary = getContainerBoundary(value, start, container, metadata);
  const normalizedTag = tag.toLowerCase();
  let candidate = value.indexOf('</', start);
  while (candidate !== -1 && candidate < boundary) {
    const nameStart = candidate + 2;
    const nameEnd = nameStart + tag.length;
    if (value.slice(nameStart, nameEnd).toLowerCase() === normalizedTag && value[nameEnd] === '>') {
      const tagEnd = getHtmlTagEnd(value, candidate)!;
      const closingLineEnd = getLineEnd(value, tagEnd + 1);
      return Math.min(boundary, closingLineEnd + getLineEndingLength(value, closingLineEnd));
    }
    candidate = value.indexOf('</', candidate + 2);
  }
  return boundary < value.length ? boundary : null;
}

export function getHtmlBlockEndAt(
  value: string,
  start: number,
  metadata: ScanMetadata,
): number | null {
  if (value[start] !== '<') return null;
  const lineStart = metadata.lineStarts[start] ?? 0;
  const containerStart = metadata.containerStarts.get(lineStart) ?? lineStart;
  if (!/^ {0,3}$/u.test(value.slice(containerStart, start))) return null;
  const container = getContainerContext(lineStart, metadata);
  const completeBlock = (end: number | null) => end ?? value.length;

  if (value.startsWith('<!--', start)) {
    return completeBlock(getHtmlDelimitedBlockEnd(value, start, '-->', container, metadata));
  }
  if (value.startsWith('<?', start)) {
    return completeBlock(getHtmlDelimitedBlockEnd(value, start, '?>', container, metadata));
  }
  if (value.startsWith('<![CDATA[', start)) {
    return completeBlock(getHtmlDelimitedBlockEnd(value, start, ']]>', container, metadata));
  }
  if (/^<![A-Z]/u.test(value.slice(start))) {
    return completeBlock(getHtmlDelimitedBlockEnd(value, start, '>', container, metadata));
  }

  const blockTagPrefix = /^<\/?([A-Za-z][A-Za-z0-9-]*)(?=[\s>])/u.exec(value.slice(start));
  if (blockTagPrefix !== null && isInterruptingHtmlBlockTag(blockTagPrefix[1]!.toLowerCase())) {
    const normalizedTag = blockTagPrefix[1]!.toLowerCase();
    return closesHtmlBlockWithTag(normalizedTag)
      ? completeBlock(getClosingHtmlBlockEnd(value, start, normalizedTag, container, metadata))
      : completeBlock(getHtmlBlockBlankLineEnd(value, start, container, metadata));
  }

  const tagEnd = getHtmlTagEnd(value, start);
  if (tagEnd === null) return null;
  const tag = /^<\/?([A-Za-z][A-Za-z0-9-]*)(?=\s|\/?>)/u.exec(value.slice(start, tagEnd + 1));
  if (tag === null) return null;
  const lineEnd = getLineEnd(value, tagEnd + 1);
  const isStandaloneTag =
    /^\s*(?:<\/?[A-Za-z][A-Za-z0-9-]*(?:\s[^>]*)?>)[ \t]*$/u.test(
      value.slice(containerStart, lineEnd),
    ) && isLineEnding(value[lineEnd]);
  if (!(isStandaloneTag && canStartHtmlBlock(value, lineStart, metadata))) return null;
  return completeBlock(getHtmlBlockBlankLineEnd(value, tagEnd + 1, container, metadata));
}
