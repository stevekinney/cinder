import type {
  AnchorUpdate,
  CommentAnchor,
  PersistedAnchor,
  ReviewState,
} from 'cinder/commentary/comments';
import {
  parseFrontMatter,
  serializeYaml,
  stringifyFrontMatter,
  validateFrontMatter,
} from 'cinder/markdown/pipeline';

export type ReviewEditorFrontMatterState = {
  hasFrontMatter: boolean;
  data: Record<string, unknown> | null;
  raw: string | null;
  body: string;
  bodyOffset: number;
};

export type ParsedYamlValue = { valid: true; value: unknown } | { valid: false; error: string };

export function parseReviewEditorFrontMatter(markdown: string): ReviewEditorFrontMatterState {
  const parsed = parseFrontMatter(markdown);
  const bodyOffset = parsed.hasFrontMatter ? markdown.length - parsed.body.length : 0;

  return {
    hasFrontMatter: parsed.hasFrontMatter,
    data: parsed.data,
    raw: parsed.hasFrontMatter ? (parsed.raw ?? '') : null,
    body: parsed.hasFrontMatter ? parsed.body : markdown,
    bodyOffset,
  };
}

export function reviewStateToMarkdown(
  state: Pick<ReviewState, 'content' | 'frontMatter' | 'frontMatterRaw'>,
): string {
  if (parseReviewEditorFrontMatter(state.content).hasFrontMatter) return state.content;
  if (state.frontMatterRaw == null && state.frontMatter == null) return state.content;
  if (state.frontMatterRaw === undefined) return state.content;

  return stringifyFrontMatter(state.frontMatter ?? null, state.content, {
    originalRaw: state.frontMatterRaw,
    originalData: state.frontMatter ?? null,
    preserveEmptyFrontMatter: true,
  });
}

export function combineFrontMatterAndBody(
  frontMatter: ReviewEditorFrontMatterState,
  body: string,
): string {
  if (!frontMatter.hasFrontMatter) return body;

  if (frontMatter.data === null && frontMatter.raw !== null && frontMatter.raw.trim() !== '') {
    return `---\n${frontMatter.raw}\n---\n${body}`;
  }

  return stringifyFrontMatter(frontMatter.data, body, {
    originalRaw: frontMatter.raw,
    originalData: frontMatter.data,
    preserveEmptyFrontMatter: true,
  });
}

export function replaceFrontMatterData(
  markdown: string,
  data: Record<string, unknown> | null,
): string {
  const frontMatter = parseReviewEditorFrontMatter(markdown);
  if (!frontMatter.hasFrontMatter) return markdown;

  return stringifyFrontMatter(data, frontMatter.body, {
    originalRaw: frontMatter.raw,
    originalData: frontMatter.data,
    preserveEmptyFrontMatter: true,
  });
}

export function serializeYamlFieldValue(value: unknown): string {
  const raw = serializeYaml({ value });
  if (raw.startsWith('value:\n')) {
    return raw.slice('value:\n'.length).replace(/^  /gm, '');
  }
  return raw.replace(/^value:\s?/, '');
}

export function parseYamlFieldValue(raw: string): ParsedYamlValue {
  const validation = validateFrontMatter(`value:\n${indentYaml(raw)}`);
  if (!validation.valid) {
    return { valid: false, error: validation.error ?? 'Invalid YAML syntax' };
  }

  const parsed = parseFrontMatter(`---\nvalue:\n${indentYaml(raw)}\n---\n`);
  return { valid: true, value: parsed.data?.['value'] };
}

export function documentPositionToBodyPosition(position: number, bodyOffset: number): number {
  return Math.max(0, position - bodyOffset);
}

export function bodyPositionToDocumentPosition(position: number, bodyOffset: number): number {
  return position + bodyOffset;
}

export function documentAnchorToBodyAnchor(
  anchor: CommentAnchor,
  bodyOffset: number,
): CommentAnchor {
  return offsetAnchor(anchor, -bodyOffset);
}

export function documentPersistedAnchorToBodyAnchor(
  anchor: PersistedAnchor,
  bodyOffset: number,
): PersistedAnchor {
  return offsetPersistedAnchor(anchor, -bodyOffset);
}

export function bodyAnchorToDocumentAnchor(
  anchor: CommentAnchor,
  bodyOffset: number,
  documentText?: string,
): CommentAnchor {
  return offsetAnchor(anchor, bodyOffset, documentText);
}

export function remapDocumentAnchorBodyOffset(
  anchor: CommentAnchor,
  previousBodyOffset: number,
  nextBodyOffset: number,
  nextDocumentText?: string,
): CommentAnchor {
  if (previousBodyOffset === nextBodyOffset) return anchor;

  return bodyAnchorToDocumentAnchor(
    documentAnchorToBodyAnchor(anchor, previousBodyOffset),
    nextBodyOffset,
    nextDocumentText,
  );
}

export function bodyAnchorUpdateToDocumentAnchorUpdate(
  update: AnchorUpdate,
  bodyOffset: number,
): AnchorUpdate {
  const documentUpdate: AnchorUpdate = {
    ...update,
    from: bodyPositionToDocumentPosition(update.from, bodyOffset),
    to: bodyPositionToDocumentPosition(update.to, bodyOffset),
  };

  if (update.lastKnownOffset !== undefined) {
    documentUpdate.lastKnownOffset = bodyPositionToDocumentPosition(
      update.lastKnownOffset,
      bodyOffset,
    );
  }

  return documentUpdate;
}

function offsetAnchor(anchor: CommentAnchor, offset: number, documentText?: string): CommentAnchor {
  if (anchor.type === 'document') return anchor;

  const originalPosition = anchor.originalPosition;
  const originalPositionOffset =
    originalPosition === undefined ? undefined : Math.max(0, originalPosition.offset + offset);

  return {
    ...anchor,
    from: Math.max(0, anchor.from + offset),
    to: Math.max(0, anchor.to + offset),
    lastKnownOffset:
      anchor.lastKnownOffset === undefined
        ? undefined
        : Math.max(0, anchor.lastKnownOffset + offset),
    originalPosition:
      originalPosition === undefined || originalPositionOffset === undefined
        ? undefined
        : textOffsetToLineColumn(documentText, originalPositionOffset, originalPosition),
  };
}

function offsetPersistedAnchor(anchor: PersistedAnchor, offset: number): PersistedAnchor {
  if (anchor.type === 'document') return anchor;

  const originalPosition = anchor.originalPosition;
  const originalPositionOffset =
    originalPosition === undefined ? undefined : Math.max(0, originalPosition.offset + offset);

  return {
    ...anchor,
    lastKnownOffset:
      anchor.lastKnownOffset === undefined
        ? undefined
        : Math.max(0, anchor.lastKnownOffset + offset),
    originalPosition:
      originalPosition === undefined || originalPositionOffset === undefined
        ? undefined
        : { ...originalPosition, offset: originalPositionOffset },
  };
}

function indentYaml(raw: string): string {
  if (raw.trim() === '') return '  null';
  return raw
    .split('\n')
    .map((line) => (line.trim() === '' ? line : `  ${line}`))
    .join('\n');
}

function textOffsetToLineColumn(
  documentText: string | undefined,
  offset: number,
  fallback: NonNullable<CommentAnchor['originalPosition']>,
): NonNullable<CommentAnchor['originalPosition']> {
  if (documentText === undefined) {
    return { ...fallback, offset };
  }

  let line = 1;
  let column = 1;
  const clampedOffset = Math.max(0, Math.min(offset, documentText.length));

  for (let index = 0; index < clampedOffset; index++) {
    if (documentText[index] === '\n') {
      line++;
      column = 1;
    } else {
      column++;
    }
  }

  return { offset: clampedOffset, line, column };
}
