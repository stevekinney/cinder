/**
 * Command registry for the Milkdown editor.
 *
 * This module provides functions to execute editor commands and query editor state.
 * Used by the toolbar and keyboard shortcuts.
 *
 * IMPORTANT: Uses Milkdown's command system (callCommand) to ensure
 * commands respect Milkdown contexts and work correctly.
 */

import type { CmdKey } from '@milkdown/kit/core';
import type { Ctx } from '@milkdown/kit/ctx';
import type { Mark, MarkType, Schema } from '@milkdown/kit/prose/model';
import type { EditorView } from '@milkdown/kit/prose/view';

type CommandRuntime = {
  editorViewCtx: typeof import('@milkdown/kit/core').editorViewCtx;
  schemaCtx: typeof import('@milkdown/kit/core').schemaCtx;
  callCommand: typeof import('@milkdown/kit/utils').callCommand;
  toggleStrongCommand: typeof import('@milkdown/kit/preset/commonmark').toggleStrongCommand;
  toggleEmphasisCommand: typeof import('@milkdown/kit/preset/commonmark').toggleEmphasisCommand;
  toggleInlineCodeCommand: typeof import('@milkdown/kit/preset/commonmark').toggleInlineCodeCommand;
  wrapInHeadingCommand: typeof import('@milkdown/kit/preset/commonmark').wrapInHeadingCommand;
  wrapInBulletListCommand: typeof import('@milkdown/kit/preset/commonmark').wrapInBulletListCommand;
  wrapInOrderedListCommand: typeof import('@milkdown/kit/preset/commonmark').wrapInOrderedListCommand;
  wrapInBlockquoteCommand: typeof import('@milkdown/kit/preset/commonmark').wrapInBlockquoteCommand;
  insertHrCommand: typeof import('@milkdown/kit/preset/commonmark').insertHrCommand;
  turnIntoTextCommand: typeof import('@milkdown/kit/preset/commonmark').turnIntoTextCommand;
  liftListItemCommand: typeof import('@milkdown/kit/preset/commonmark').liftListItemCommand;
  sinkListItemCommand: typeof import('@milkdown/kit/preset/commonmark').sinkListItemCommand;
  toggleStrikethroughCommand: typeof import('@milkdown/kit/preset/gfm').toggleStrikethroughCommand;
  undoCommand: typeof import('@milkdown/kit/plugin/history').undoCommand;
  redoCommand: typeof import('@milkdown/kit/plugin/history').redoCommand;
  liftListItem: typeof import('@milkdown/kit/prose/schema-list').liftListItem;
  wrapInList: typeof import('@milkdown/kit/prose/schema-list').wrapInList;
};

let commandRuntime: CommandRuntime | null = null;
let commandRuntimePromise: Promise<CommandRuntime> | null = null;

function formatCommandKey(commandKey: unknown): string {
  return typeof commandKey === 'string' ? commandKey : 'Milkdown command';
}

async function resolveCommandRuntime(): Promise<CommandRuntime> {
  if (commandRuntime) return commandRuntime;

  commandRuntimePromise ??= (async () => {
    const [core, utilities, commonmark, gfm, history, schemaList] = await Promise.all([
      import('@milkdown/kit/core'),
      import('@milkdown/kit/utils'),
      import('@milkdown/kit/preset/commonmark'),
      import('@milkdown/kit/preset/gfm'),
      import('@milkdown/kit/plugin/history'),
      import('@milkdown/kit/prose/schema-list'),
    ]);

    return {
      editorViewCtx: core.editorViewCtx,
      schemaCtx: core.schemaCtx,
      callCommand: utilities.callCommand,
      toggleStrongCommand: commonmark.toggleStrongCommand,
      toggleEmphasisCommand: commonmark.toggleEmphasisCommand,
      toggleInlineCodeCommand: commonmark.toggleInlineCodeCommand,
      wrapInHeadingCommand: commonmark.wrapInHeadingCommand,
      wrapInBulletListCommand: commonmark.wrapInBulletListCommand,
      wrapInOrderedListCommand: commonmark.wrapInOrderedListCommand,
      wrapInBlockquoteCommand: commonmark.wrapInBlockquoteCommand,
      insertHrCommand: commonmark.insertHrCommand,
      turnIntoTextCommand: commonmark.turnIntoTextCommand,
      liftListItemCommand: commonmark.liftListItemCommand,
      sinkListItemCommand: commonmark.sinkListItemCommand,
      toggleStrikethroughCommand: gfm.toggleStrikethroughCommand,
      undoCommand: history.undoCommand,
      redoCommand: history.redoCommand,
      liftListItem: schemaList.liftListItem,
      wrapInList: schemaList.wrapInList,
    };
  })();

  commandRuntime = await commandRuntimePromise;
  return commandRuntime;
}

/** Load Milkdown command modules before synchronous command handlers run. */
export async function preloadCommandRuntime(): Promise<void> {
  await resolveCommandRuntime();
}

function getCommandRuntime(): CommandRuntime | null {
  if (commandRuntime) return commandRuntime;

  commandRuntimePromise ??= resolveCommandRuntime();
  return null;
}

function shouldLogDevelopmentWarnings(): boolean {
  return typeof process === 'undefined' || process.env.NODE_ENV !== 'production';
}

function getEditorView(ctx: Ctx): EditorView | null {
  const runtime = getCommandRuntime();
  if (!runtime) return null;
  return ctx.get(runtime.editorViewCtx);
}

function getEditorSchema(ctx: Ctx): Schema | null {
  const runtime = getCommandRuntime();
  if (!runtime) return null;
  return ctx.get(runtime.schemaCtx);
}

function getEditorViewAndSchema(ctx: Ctx): {
  view: EditorView | null;
  schema: Schema | null;
} {
  const runtime = getCommandRuntime();
  if (!runtime) return { view: null, schema: null };
  return {
    view: ctx.get(runtime.editorViewCtx),
    schema: ctx.get(runtime.schemaCtx),
  };
}

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

function isHeadingLevel(value: unknown): value is 1 | 2 | 3 | 4 | 5 | 6 {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5 || value === 6;
}

function findWordRange(view: EditorView): { from: number; to: number } | null {
  const { selection } = view.state;
  if (!selection.empty) return null;

  const { $from } = selection;
  if (!$from.parent.isTextblock) return null;

  const text = $from.parent.textBetween(0, $from.parent.content.size, '\0', '\ufffc');
  if (!text) return null;

  const offset = $from.parentOffset;
  const leftChar = offset > 0 ? (text[offset - 1] ?? '') : '';
  const rightChar = offset < text.length ? (text[offset] ?? '') : '';

  if (!WORD_CHAR_REGEX.test(leftChar) && !WORD_CHAR_REGEX.test(rightChar)) {
    return null;
  }

  let startOffset = offset;
  let endOffset = offset;

  if (WORD_CHAR_REGEX.test(leftChar)) {
    startOffset = offset - 1;
    while (startOffset > 0 && WORD_CHAR_REGEX.test(text[startOffset - 1] ?? '')) {
      startOffset--;
    }
  }

  if (WORD_CHAR_REGEX.test(rightChar)) {
    endOffset = offset + 1;
    while (endOffset < text.length && WORD_CHAR_REGEX.test(text[endOffset] ?? '')) {
      endOffset++;
    }
  }

  const base = $from.start();
  const from = base + startOffset;
  const to = base + endOffset;

  if (from === to) return null;

  return { from, to };
}

/**
 * Run a Milkdown command and refocus the editor.
 */
export function runCommand<T>(ctx: Ctx, commandKey: CmdKey<T> | string, payload?: T): boolean {
  const runtime = getCommandRuntime();
  if (!runtime) return false;

  try {
    // callCommand returns a function that takes ctx and returns boolean
    const result = runtime.callCommand(commandKey, payload)(ctx);
    // Refocus editor after command
    const view = getEditorView(ctx);
    view?.focus();
    return result;
  } catch (error) {
    if (shouldLogDevelopmentWarnings()) {
      console.warn(`[Editor] Command failed: ${formatCommandKey(commandKey)}`, error);
    }
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Mark Commands
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Toggle bold (strong) mark on the current selection.
 */
export function toggleBold(ctx: Ctx): boolean {
  const runtime = getCommandRuntime();
  if (!runtime) return false;

  const { view, schema } = getEditorViewAndSchema(ctx);
  if (!schema) return false;
  const strongMark = schema.marks['strong'];

  if (!view || !strongMark) {
    return runCommand(ctx, runtime.toggleStrongCommand.key);
  }

  const wordRange = findWordRange(view);
  if (!wordRange) {
    return runCommand(ctx, runtime.toggleStrongCommand.key);
  }

  const { from, to } = wordRange;
  const tr = view.state.tr;

  if (view.state.doc.rangeHasMark(from, to, strongMark)) {
    tr.removeMark(from, to, strongMark);
  } else {
    tr.addMark(from, to, strongMark.create());
  }

  view.dispatch(tr.scrollIntoView());
  view.focus();
  return true;
}

/**
 * Toggle italic (emphasis) mark on the current selection.
 */
export function toggleItalic(ctx: Ctx): boolean {
  const runtime = getCommandRuntime();
  return runtime ? runCommand(ctx, runtime.toggleEmphasisCommand.key) : false;
}

/**
 * Toggle inline code mark on the current selection.
 */
export function toggleCode(ctx: Ctx): boolean {
  const runtime = getCommandRuntime();
  return runtime ? runCommand(ctx, runtime.toggleInlineCodeCommand.key) : false;
}

/**
 * Toggle strikethrough mark on the current selection.
 */
export function toggleStrikethrough(ctx: Ctx): boolean {
  const runtime = getCommandRuntime();
  return runtime ? runCommand(ctx, runtime.toggleStrikethroughCommand.key) : false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Block Commands
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Set the current block to a heading at the specified level.
 */
export function setHeading(ctx: Ctx, level: 1 | 2 | 3 | 4 | 5 | 6): boolean {
  const runtime = getCommandRuntime();
  return runtime ? runCommand(ctx, runtime.wrapInHeadingCommand.key, level) : false;
}

/**
 * Convert the current block to a paragraph (remove heading/list/etc).
 */
export function setParagraph(ctx: Ctx): boolean {
  const runtime = getCommandRuntime();
  return runtime ? runCommand(ctx, runtime.turnIntoTextCommand.key) : false;
}

/**
 * Toggle bullet list on the current block.
 */
export function toggleBulletList(ctx: Ctx): boolean {
  const runtime = getCommandRuntime();
  if (!runtime) return false;

  if (runCommand(ctx, runtime.wrapInBulletListCommand.key)) return true;

  return toggleListFallback(ctx, 'bullet');
}

/**
 * Toggle ordered list on the current block.
 */
export function toggleOrderedList(ctx: Ctx): boolean {
  const runtime = getCommandRuntime();
  if (!runtime) return false;

  if (runCommand(ctx, runtime.wrapInOrderedListCommand.key)) return true;

  return toggleListFallback(ctx, 'ordered');
}

function toggleListFallback(ctx: Ctx, listType: 'bullet' | 'ordered'): boolean {
  const runtime = getCommandRuntime();
  if (!runtime) return false;

  try {
    const { view, schema } = getEditorViewAndSchema(ctx);

    if (!view || !schema) return false;

    const listItemType = schema.nodes['list_item'];
    const listNodeType =
      listType === 'bullet' ? schema.nodes['bullet_list'] : schema.nodes['ordered_list'];

    if (!listItemType || !listNodeType) return false;

    const activeBlock = getActiveBlockType(ctx);
    const isSameList = activeBlock.type === 'listItem' && activeBlock.listType === listType;
    const isOtherList =
      activeBlock.type === 'listItem' && activeBlock.listType && activeBlock.listType !== listType;

    if (isSameList || isOtherList) {
      const lifted = runtime.liftListItem(listItemType)(view.state, view.dispatch);
      if (lifted && isSameList) {
        view.focus();
        return true;
      }
    }

    const wrapped = runtime.wrapInList(listNodeType)(view.state, view.dispatch);
    if (wrapped) {
      view.focus();
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

/**
 * Toggle blockquote on the current block.
 */
export function toggleBlockquote(ctx: Ctx): boolean {
  const runtime = getCommandRuntime();
  return runtime ? runCommand(ctx, runtime.wrapInBlockquoteCommand.key) : false;
}

/**
 * Indent a list item (sink).
 */
export function indentListItem(ctx: Ctx): boolean {
  const runtime = getCommandRuntime();
  return runtime ? runCommand(ctx, runtime.sinkListItemCommand.key) : false;
}

/**
 * Outdent a list item (lift).
 */
export function outdentListItem(ctx: Ctx): boolean {
  const runtime = getCommandRuntime();
  return runtime ? runCommand(ctx, runtime.liftListItemCommand.key) : false;
}

/**
 * Insert a horizontal rule.
 */
export function insertHorizontalRule(ctx: Ctx): boolean {
  const runtime = getCommandRuntime();
  return runtime ? runCommand(ctx, runtime.insertHrCommand.key) : false;
}

// ─────────────────────────────────────────────────────────────────────────────
// History Commands
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Undo the last action.
 */
export function undo(ctx: Ctx): boolean {
  const runtime = getCommandRuntime();
  return runtime ? runCommand(ctx, runtime.undoCommand.key) : false;
}

/**
 * Redo the last undone action.
 */
export function redo(ctx: Ctx): boolean {
  const runtime = getCommandRuntime();
  return runtime ? runCommand(ctx, runtime.redoCommand.key) : false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Link Commands
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Insert a link at the current cursor position (when no selection).
 * This inserts text and applies the link mark in a single transaction.
 */
export function insertLinkAtCursor(ctx: Ctx, text: string, url: string): boolean {
  try {
    const view = getEditorView(ctx);
    const schema = getEditorSchema(ctx);

    if (!schema) return false;
    const linkMarkType = schema.marks['link'];
    if (!view || !linkMarkType) return false;

    const { from } = view.state.selection;
    const linkMark = linkMarkType.create({ href: url });

    const tr = view.state.tr.insertText(text, from).addMark(from, from + text.length, linkMark);

    view.dispatch(tr);
    view.focus();
    return true;
  } catch (error) {
    if (shouldLogDevelopmentWarnings()) {
      console.warn('[Editor] insertLinkAtCursor failed:', error);
    }
    return false;
  }
}

/**
 * Apply a link mark to the current selection.
 */
export function applyLinkToSelection(ctx: Ctx, url: string): boolean {
  try {
    const view = getEditorView(ctx);
    const schema = getEditorSchema(ctx);

    if (!schema) return false;
    const linkMarkType = schema.marks['link'];
    if (!view || !linkMarkType) return false;

    const { from, to } = view.state.selection;
    if (from === to) return false; // No selection

    const linkMark = linkMarkType.create({ href: url });
    const tr = view.state.tr.addMark(from, to, linkMark);

    view.dispatch(tr);
    view.focus();
    return true;
  } catch (error) {
    if (shouldLogDevelopmentWarnings()) {
      console.warn('[Editor] applyLinkToSelection failed:', error);
    }
    return false;
  }
}

/**
 * Update an existing link at the cursor position.
 * Replaces the text and URL of the link the cursor is inside.
 * Used when editing a link (cursor inside link, no selection).
 */
export function updateLinkAtCursor(ctx: Ctx, text: string, url: string): boolean {
  try {
    const view = getEditorView(ctx);
    const schema = getEditorSchema(ctx);

    if (!schema) return false;
    const linkMarkType = schema.marks['link'];
    if (!view || !linkMarkType) return false;

    const { from } = view.state.selection;
    const range = findMarkRange(view, linkMarkType, from);

    if (!range) return false;

    const [start, end] = range;
    const linkMark = linkMarkType.create({ href: url });

    // Replace the existing link text with new text and apply link mark
    const tr = view.state.tr
      .delete(start, end)
      .insertText(text, start)
      .addMark(start, start + text.length, linkMark);

    view.dispatch(tr);
    view.focus();
    return true;
  } catch (error) {
    if (shouldLogDevelopmentWarnings()) {
      console.warn('[Editor] updateLinkAtCursor failed:', error);
    }
    return false;
  }
}

/**
 * Find the range of a specific mark instance at a given position.
 * Returns [start, end] if mark exists at position, null otherwise.
 *
 * IMPORTANT: This compares mark instances (same type AND same attributes),
 * not just mark types. This ensures adjacent links with different URLs
 * are treated as separate ranges.
 */
function findMarkRange(view: EditorView, markType: MarkType, pos: number): [number, number] | null {
  const $pos = view.state.doc.resolve(pos);
  const parent = $pos.parent;

  // Get the specific mark instance at the cursor position.
  // $pos.marks() returns marks AFTER the position, so if cursor is at end of
  // marked text, we need to also check nodeBefore and nodeAfter.
  let targetMark = markType.isInSet($pos.marks());

  // If not found, check the node before (handles cursor at end of marked text)
  if (!targetMark && $pos.nodeBefore) {
    targetMark = markType.isInSet($pos.nodeBefore.marks);
  }

  // If still not found, check the node after (handles cursor at start of marked text)
  if (!targetMark && $pos.nodeAfter) {
    targetMark = markType.isInSet($pos.nodeAfter.marks);
  }

  if (!targetMark) {
    return null;
  }

  // Helper to check if a node has the same mark instance (type + attributes)
  const hasSameMark = (marks: readonly Mark[]): boolean => {
    const mark = markType.isInSet(marks);
    return mark !== undefined && mark.eq(targetMark);
  };

  // When cursor is at end of parent content, index equals childCount (out of bounds).
  // Clamp to valid range for iteration.
  const startIndex = Math.min($pos.index(), parent.childCount - 1);

  // Find start by walking backward from current index
  let start = $pos.start();
  for (let i = startIndex; i >= 0; i--) {
    const child = parent.child(i);
    if (!hasSameMark(child.marks)) {
      // Mark starts after this node - sum up sizes of nodes before current
      for (let j = 0; j <= i; j++) {
        start += parent.child(j).nodeSize;
      }
      break;
    }
    if (i === 0) {
      // Mark starts at beginning of parent
      start = $pos.start();
    }
  }

  // Find end by walking forward from current index
  let end = $pos.start();
  for (let i = 0; i < parent.childCount; i++) {
    const child = parent.child(i);
    end += child.nodeSize;
    if (i >= startIndex && !hasSameMark(child.marks)) {
      // Mark ends before this node
      end -= child.nodeSize;
      break;
    }
  }

  return [start, end];
}

/**
 * Remove link mark from the current selection or a specified range.
 *
 * @param ctx - Milkdown editor context
 * @param range - Optional pre-computed range [from, to] to remove link from.
 *                If not provided, uses current selection (or finds link at cursor).
 *                Pass this when the editor may have lost focus (e.g., popover interactions).
 */
export function removeLink(ctx: Ctx, range?: [number, number]): boolean {
  try {
    const view = getEditorView(ctx);
    const schema = getEditorSchema(ctx);

    if (!schema) return false;
    const linkMarkType = schema.marks['link'];
    if (!view || !linkMarkType) return false;

    let from: number;
    let to: number;

    if (range) {
      // Use pre-computed range (preferred when called from popovers/dialogs)
      [from, to] = range;
    } else {
      // Fall back to current selection
      ({ from, to } = view.state.selection);

      // If selection is collapsed, find the link mark range
      if (from === to) {
        const foundRange = findMarkRange(view, linkMarkType, from);
        if (!foundRange) return false;
        [from, to] = foundRange;
      }
    }

    const tr = view.state.tr.removeMark(from, to, linkMarkType);
    view.dispatch(tr);
    view.focus();
    return true;
  } catch (error) {
    if (shouldLogDevelopmentWarnings()) {
      console.warn('[Editor] removeLink failed:', error);
    }
    return false;
  }
}

/**
 * Get the link URL at the current cursor position, if any.
 */
export function getLinkAtCursor(ctx: Ctx): string | null {
  try {
    const view = getEditorView(ctx);
    const schema = getEditorSchema(ctx);

    if (!schema) return null;
    const linkMarkType = schema.marks['link'];
    if (!view || !linkMarkType) return null;

    const { $from } = view.state.selection;
    const linkMark = linkMarkType.isInSet($from.marks());

    if (linkMark) {
      const href = linkMark.attrs['href'];
      return typeof href === 'string' ? href : null;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Get the link text at the current cursor position, if cursor is inside a link.
 * Returns the full link text even when selection is collapsed.
 */
export function getLinkTextAtCursor(ctx: Ctx): string | null {
  try {
    const view = getEditorView(ctx);
    const schema = getEditorSchema(ctx);

    if (!schema) return null;
    const linkMarkType = schema.marks['link'];
    if (!view || !linkMarkType) return null;

    const { from } = view.state.selection;
    const range = findMarkRange(view, linkMarkType, from);

    if (!range) return null;

    const [start, end] = range;
    return view.state.doc.textBetween(start, end);
  } catch {
    return null;
  }
}

/**
 * Get the link range at the current cursor position.
 * Returns [from, to] if cursor is inside a link, null otherwise.
 *
 * Use this to capture the link range before focus leaves the editor
 * (e.g., when opening a popover), then pass the range to removeLink.
 */
export function getLinkRangeAtCursor(ctx: Ctx): [number, number] | null {
  try {
    const view = getEditorView(ctx);
    const schema = getEditorSchema(ctx);

    if (!schema) return null;
    const linkMarkType = schema.marks['link'];
    if (!view || !linkMarkType) return null;

    const { from } = view.state.selection;
    return findMarkRange(view, linkMarkType, from);
  } catch {
    return null;
  }
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

    // Walk up the document tree to find the block type
    for (let depth = $from.depth; depth >= 0; depth--) {
      const node = $from.node(depth);

      if (node.type === schema.nodes['heading']) {
        const headingLevel = node.attrs['level'];
        if (!isHeadingLevel(headingLevel)) return { type: 'unknown' };

        return {
          type: 'heading',
          headingLevel,
        };
      }

      if (node.type === schema.nodes['blockquote']) {
        return { type: 'blockquote' };
      }

      if (node.type === schema.nodes['code_block']) {
        return { type: 'codeBlock' };
      }

      if (node.type === schema.nodes['list_item']) {
        const parent = depth > 0 ? $from.node(depth - 1) : null;
        if (parent?.type === schema.nodes['bullet_list']) {
          return { type: 'listItem', listType: 'bullet' };
        }
        if (parent?.type === schema.nodes['ordered_list']) {
          return { type: 'listItem', listType: 'ordered' };
        }
        return { type: 'listItem' };
      }

      if (node.type === schema.nodes['paragraph']) {
        return { type: 'paragraph' };
      }
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
