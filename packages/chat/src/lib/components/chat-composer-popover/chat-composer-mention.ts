/** An addressable entity selected from a chat composer suggestion list. */
export type ChatComposerMention = {
  label: string;
  uri: string;
};

/** A mention's location in a parsed composer text projection. */
export type ChatComposerMentionRange = ChatComposerMention & {
  start: number;
  end: number;
};

/** Plain textarea text and the addressable entity mentions it contains. */
export type ChatComposerMentionParseResult = {
  text: string;
  mentions: ChatComposerMentionRange[];
};

type ParsedLink = {
  label: string;
  uri: string;
  end: number;
};

const ABSOLUTE_URI_SCHEME = /^([A-Za-z][A-Za-z0-9+.-]*):/u;
const WEB_URI_SCHEMES = new Set(['http', 'https', 'mailto']);

function escapeLabel(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('[', '\\[').replaceAll(']', '\\]');
}

function escapeUri(value: string): string {
  return value.replaceAll('\\', '\\\\').replace(/([()\s])/gu, '\\$1');
}

function unescapeMarkdown(value: string): string | null {
  let unescaped = '';

  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== '\\') {
      unescaped += value[index];
      continue;
    }

    const escapedCharacter = value[index + 1];
    if (escapedCharacter === undefined) return null;

    unescaped += escapedCharacter;
    index += 1;
  }

  return unescaped;
}

function hasEscapedPrefix(value: string, index: number): boolean {
  let slashCount = 0;

  for (let cursor = index - 1; cursor >= 0 && value[cursor] === '\\'; cursor -= 1) {
    slashCount += 1;
  }

  return slashCount % 2 === 1;
}

function isEntityUri(uri: string): boolean {
  const match = ABSOLUTE_URI_SCHEME.exec(uri);
  return match !== null && !WEB_URI_SCHEMES.has(match[1]!.toLowerCase());
}

function parseLink(value: string, start: number): ParsedLink | null {
  if (value[start] !== '[') return null;

  let labelEnd = start + 1;
  while (labelEnd < value.length) {
    if (value[labelEnd] === '\\') {
      labelEnd += 2;
      continue;
    }

    if (value[labelEnd] === ']') break;
    labelEnd += 1;
  }

  if (value[labelEnd] !== ']' || value[labelEnd + 1] !== '(') return null;

  const destinationStart = labelEnd + 2;
  let destinationEnd = destinationStart;
  let nestedParentheses = 0;

  while (destinationEnd < value.length) {
    const character = value[destinationEnd]!;

    if (character === '\\') {
      destinationEnd += 2;
      continue;
    }

    if (/\s/u.test(character)) return null;
    if (character === '(') {
      nestedParentheses += 1;
      destinationEnd += 1;
      continue;
    }
    if (character === ')') {
      if (nestedParentheses === 0) break;
      nestedParentheses -= 1;
    }

    destinationEnd += 1;
  }

  if (value[destinationEnd] !== ')') return null;

  const label = unescapeMarkdown(value.slice(start + 1, labelEnd));
  const uri = unescapeMarkdown(value.slice(destinationStart, destinationEnd));
  if (label === null || uri === null || !isEntityUri(uri)) return null;

  return { label, uri, end: destinationEnd + 1 };
}

/** Serializes an entity mention as Markdown suitable for a plain textarea. */
export function serializeChatComposerMention({ label, uri }: ChatComposerMention): string {
  return `[${escapeLabel(label)}](${escapeUri(uri)})`;
}

/** Deserializes one serialized entity mention, or returns `null` for any other text. */
export function deserializeChatComposerMention(value: string): ChatComposerMention | null {
  const link = parseLink(value, 0);
  if (link === null || link.end !== value.length) return null;

  return { label: link.label, uri: link.uri };
}

/** Projects entity mentions to visible text and reports their UTF-16 ranges. */
export function parseChatComposerMentions(value: string): ChatComposerMentionParseResult {
  const mentions: ChatComposerMentionRange[] = [];
  let text = '';
  let sourceIndex = 0;

  while (sourceIndex < value.length) {
    if (
      value[sourceIndex] === '[' &&
      value[sourceIndex - 1] !== '!' &&
      !hasEscapedPrefix(value, sourceIndex)
    ) {
      const link = parseLink(value, sourceIndex);
      if (link !== null) {
        const start = text.length;
        text += link.label;
        mentions.push({ label: link.label, uri: link.uri, start, end: text.length });
        sourceIndex = link.end;
        continue;
      }
    }

    text += value[sourceIndex];
    sourceIndex += 1;
  }

  return { text, mentions };
}
