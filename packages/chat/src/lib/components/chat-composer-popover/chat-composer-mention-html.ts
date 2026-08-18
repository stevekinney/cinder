import type { ScanMetadata } from './chat-composer-mention-scan.ts';

const VOID_HTML_TAGS = new Set(
  'area base br col embed hr img input link meta source track wbr'.split(' '),
);
const RAW_TEXT_HTML_TAGS = new Set(['pre', 'script', 'style', 'textarea']);
const BLOCK_HTML_TAGS = new Set(
  'address article aside blockquote body caption center colgroup dd details dialog dir div dl dt fieldset figcaption figure footer form frameset h1 h2 h3 h4 h5 h6 head header html iframe legend li main menu nav noframes ol p section summary table tbody td tfoot th thead title tr ul'.split(
    ' ',
  ),
);

export function isVoidHtmlTag(tag: string): boolean {
  return VOID_HTML_TAGS.has(tag);
}

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
    if (quote !== null) {
      if (character === quote) quote = null;
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (character === '<') {
      return null;
    } else if (character === '>') {
      const token = value.slice(start, index + 1);
      return /^(?:<\/?[A-Za-z][A-Za-z0-9-]*(?:\s+[A-Za-z_:][A-Za-z0-9_.:-]*(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*\s*\/?>|<![A-Z][^>]*>|<\?[^>]*\?>)$/u.test(
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

export function getHtmlBlockBlankLineEnd(value: string, start: number): number | null {
  let lineEnd = value.indexOf('\n', start);
  while (lineEnd !== -1) {
    let cursor = lineEnd + 1;
    while (value[cursor] === ' ' || value[cursor] === '\t' || value[cursor] === '\r') cursor += 1;
    if (value[cursor] === '\n') return cursor + 1;
    lineEnd = value.indexOf('\n', cursor);
  }
  return null;
}

export function getClosingHtmlBlockEnd(value: string, start: number, tag: string): number | null {
  const normalizedTag = tag.toLowerCase();
  let candidate = value.indexOf('</', start);
  while (candidate !== -1) {
    const nameStart = candidate + 2;
    const nameEnd = nameStart + tag.length;
    if (
      value.slice(nameStart, nameEnd).toLowerCase() === normalizedTag &&
      /[\s>]/u.test(value[nameEnd] ?? '')
    ) {
      const tagEnd = getHtmlTagEnd(value, candidate);
      if (tagEnd !== null) return tagEnd + 1;
    }
    candidate = value.indexOf('</', candidate + 2);
  }
  return null;
}
