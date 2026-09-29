import type { Ctx } from '@milkdown/kit/ctx';
import type { MarkType } from '@milkdown/kit/prose/model';
import type { EditorView } from '@milkdown/kit/prose/view';
import { getEditorSchema, getEditorView } from './commands.ts';

/**
 * Active marks at the current selection.
 */
export interface ActiveMarks {
  bold: boolean;
  italic: boolean;
  code: boolean;
  strikethrough: boolean;
  link: boolean;
}

/**
 * Current block type at the selection.
 *
 * Uses a discriminated union to ensure type safety - you can't have
 * a paragraph with a headingLevel or a blockquote with a listType.
 */
export type ActiveBlockType =
  | { type: 'paragraph' }
  | { type: 'heading'; headingLevel: 1 | 2 | 3 | 4 | 5 | 6 }
  | { type: 'blockquote' }
  | { type: 'codeBlock' }
  | { type: 'listItem'; listType?: 'bullet' | 'ordered' | 'task' }
  | { type: 'unknown' };
const WORD_CHAR_REGEX = /[A-Za-z0-9_]/;

function isWordCharacter(value: string): boolean {
  return WORD_CHAR_REGEX.test(value);
}

function findWordStart(text: string, offset: number, leftChar: string): number {
  if (!isWordCharacter(leftChar)) return offset;
  let start = offset - 1;
  while (start > 0 && isWordCharacter(text[start - 1] ?? '')) start--;
  return start;
}

function findWordEnd(text: string, offset: number, rightChar: string): number {
  if (!isWordCharacter(rightChar)) return offset;
  let end = offset + 1;
  while (end < text.length && isWordCharacter(text[end] ?? '')) end++;
  return end;
}

function wordRangeOffsets(
  text: string,
  offset: number,
): { startOffset: number; endOffset: number } | null {
  const leftChar = offset > 0 ? (text[offset - 1] ?? '') : '';
  const rightChar = offset < text.length ? (text[offset] ?? '') : '';
  if (!isWordCharacter(leftChar) && !isWordCharacter(rightChar)) return null;
  return {
    startOffset: findWordStart(text, offset, leftChar),
    endOffset: findWordEnd(text, offset, rightChar),
  };
}

function isHeadingLevel(value: unknown): value is 1 | 2 | 3 | 4 | 5 | 6 {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5 || value === 6;
}

function listItemBlock(
  resolved: import('@milkdown/kit/prose/model').ResolvedPos,
  depth: number,
  schema: import('@milkdown/kit/prose/model').Schema,
): ActiveBlockType {
  const parent = depth > 0 ? resolved.node(depth - 1) : null;
  if (parent?.type === schema.nodes['bullet_list']) return { type: 'listItem', listType: 'bullet' };
  if (parent?.type === schema.nodes['ordered_list']) {
    return { type: 'listItem', listType: 'ordered' };
  }
  return { type: 'listItem' };
}

function activeBlockAtDepth(
  resolved: import('@milkdown/kit/prose/model').ResolvedPos,
  depth: number,
  schema: import('@milkdown/kit/prose/model').Schema,
): ActiveBlockType | undefined {
  const node = resolved.node(depth);
  if (node.type === schema.nodes['heading']) {
    const headingLevel = node.attrs['level'];
    return isHeadingLevel(headingLevel) ? { type: 'heading', headingLevel } : { type: 'unknown' };
  }
  if (node.type === schema.nodes['blockquote']) return { type: 'blockquote' };
  if (node.type === schema.nodes['code_block']) return { type: 'codeBlock' };
  if (node.type === schema.nodes['list_item']) return listItemBlock(resolved, depth, schema);
  return node.type === schema.nodes['paragraph'] ? { type: 'paragraph' } : undefined;
}

export function findWordRange(view: EditorView): { from: number; to: number } | null {
  const { selection } = view.state;
  if (!selection.empty) return null;

  const { $from } = selection;
  if (!$from.parent.isTextblock) return null;

  const text = $from.parent.textBetween(0, $from.parent.content.size, '\0', '\ufffc');
  if (!text) return null;

  const offset = $from.parentOffset;
  const offsets = wordRangeOffsets(text, offset);
  if (!offsets) return null;

  const base = $from.start();
  const from = base + offsets.startOffset;
  const to = base + offsets.endOffset;

  if (from === to) return null;

  return { from, to };
}
// ─────────────────────────────────────────────────────────────────────────────
// State Queries
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if a mark type is active at the current selection.
 */
export function isMarkActive(view: EditorView, markType: MarkType): boolean {
  const { from, $from, to, empty } = view.state.selection;

  if (empty) {
    return !!markType.isInSet(view.state.storedMarks || $from.marks());
  }

  return view.state.doc.rangeHasMark(from, to, markType);
}

/**
 * Get all active marks at the current selection.
 */
export function getActiveMarks(ctx: Ctx): ActiveMarks {
  const result: ActiveMarks = {
    bold: false,
    italic: false,
    code: false,
    strikethrough: false,
    link: false,
  };

  try {
    const view = getEditorView(ctx);
    const schema = getEditorSchema(ctx);

    if (!view || !schema) return result;

    const strongMark = schema.marks['strong'];
    const emphasisMark = schema.marks['emphasis'];
    const codeMark = schema.marks['code'];
    const strikethroughMark = schema.marks['strikethrough'];
    const linkMark = schema.marks['link'];

    if (strongMark) {
      result.bold = isMarkActive(view, strongMark);
    }
    if (emphasisMark) {
      result.italic = isMarkActive(view, emphasisMark);
    }
    if (codeMark) {
      result.code = isMarkActive(view, codeMark);
    }
    if (strikethroughMark) {
      result.strikethrough = isMarkActive(view, strikethroughMark);
    }
    if (linkMark) {
      result.link = isMarkActive(view, linkMark);
    }
  } catch {
    // Return default values on error
  }

  return result;
}

/**
 * Get the active block type at the current selection.
 */
export function getActiveBlockType(ctx: Ctx): ActiveBlockType {
  const result: ActiveBlockType = { type: 'paragraph' };

  try {
    const view = getEditorView(ctx);
    const schema = getEditorSchema(ctx);

    if (!view || !schema) return result;

    const { $from } = view.state.selection;

    for (let depth = $from.depth; depth >= 0; depth--) {
      const block = activeBlockAtDepth($from, depth, schema);
      if (block) return block;
    }
  } catch {
    // Return default values on error
  }

  return result;
}

/**
 * Check if the current selection is collapsed (cursor only, no selection).
 */
export function isSelectionCollapsed(ctx: Ctx): boolean {
  try {
    const view = getEditorView(ctx);
    if (!view) return true;
    return view.state.selection.empty;
  } catch {
    return true;
  }
}

/**
 * Get the selected text, if any.
 */
export function getSelectedText(ctx: Ctx): string {
  try {
    const view = getEditorView(ctx);
    if (!view) return '';

    const { from, to } = view.state.selection;
    if (from === to) return '';

    return view.state.doc.textBetween(from, to);
  } catch {
    return '';
  }
}
