import { getLineEnd, getLineEndingLength, isLineEnding } from './chat-composer-mention-lines.ts';
import {
  isContainerActive,
  type ContainerContext,
  type ScanMetadata,
} from './chat-composer-mention-scan.ts';

const RAW_TEXT_HTML_TAGS = new Set(['pre', 'script', 'style', 'textarea']);
const BLOCK_HTML_TAGS = new Set(
  'address article aside blockquote body caption center colgroup dd details dialog dir div dl dt fieldset figcaption figure footer form frameset h1 h2 h3 h4 h5 h6 head header hr html iframe legend li main menu nav noframes ol p section summary table tbody td tfoot th thead title tr ul'.split(
    ' ',
  ),
);

export function closesHtmlBlockWithTag(tag: string): boolean {
  return RAW_TEXT_HTML_TAGS.has(tag);
}

export function isInterruptingHtmlBlockTag(tag: string): boolean {
  return RAW_TEXT_HTML_TAGS.has(tag) || BLOCK_HTML_TAGS.has(tag);
}

export function canStartHtmlBlock(
  value: string,
  lineStart: number,
  metadata: ScanMetadata,
): boolean {
  if (lineStart === 0) return true;

  const previousLineStart = metadata.lineStarts[lineStart - 1] ?? 0;
  return /^\s*$/u.test(value.slice(previousLineStart, lineStart - 1));
}

export function getHtmlTagEnd(value: string, start: number): number | null {
  if (!/[A-Za-z/!?]/u.test(value[start + 1] ?? '')) return null;

  let quote: '"' | "'" | null = null;
  for (let index = start + 1; index < value.length; index += 1) {
    const character = value[index];
    if (isLineEnding(character)) {
      let next = index + getLineEndingLength(value, index);
      while (value[next] === ' ' || value[next] === '\t') next += 1;
      if (isLineEnding(value[next])) return null;
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
    if (/^[ \t]*$/u.test(value.slice(lineStart, lineEnd))) {
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
