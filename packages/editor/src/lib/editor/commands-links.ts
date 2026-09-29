import type { Ctx } from '@milkdown/kit/ctx';
import type { Mark, MarkType, ResolvedPos } from '@milkdown/kit/prose/model';
import type { EditorView } from '@milkdown/kit/prose/view';
import { getEditorSchema, getEditorView, shouldLogDevelopmentWarnings } from './commands.ts';

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
function findTargetMark(position: ResolvedPos, markType: MarkType) {
  return (
    markType.isInSet(position.marks()) ??
    (position.nodeBefore ? markType.isInSet(position.nodeBefore.marks) : undefined) ??
    (position.nodeAfter ? markType.isInSet(position.nodeAfter.marks) : undefined)
  );
}

function findRangeStart(
  parent: ResolvedPos['parent'],
  position: ResolvedPos,
  startIndex: number,
  hasSameMark: (marks: readonly Mark[]) => boolean,
): number {
  let start = position.start();
  for (let i = startIndex; i >= 0; i--) {
    const child = parent.child(i);
    if (!hasSameMark(child.marks)) {
      for (let j = 0; j <= i; j++) start += parent.child(j).nodeSize;
      break;
    }
    if (i === 0) start = position.start();
  }
  return start;
}

function findRangeEnd(
  parent: ResolvedPos['parent'],
  position: ResolvedPos,
  startIndex: number,
  hasSameMark: (marks: readonly Mark[]) => boolean,
): number {
  let end = position.start();
  for (let i = 0; i < parent.childCount; i++) {
    const child = parent.child(i);
    end += child.nodeSize;
    if (i >= startIndex && !hasSameMark(child.marks)) {
      end -= child.nodeSize;
      break;
    }
  }
  return end;
}

function findMarkRange(view: EditorView, markType: MarkType, pos: number): [number, number] | null {
  const $pos = view.state.doc.resolve(pos);
  const parent = $pos.parent;
  const targetMark = findTargetMark($pos, markType);
  if (!targetMark) return null;

  // Helper to check if a node has the same mark instance (type + attributes)
  const hasSameMark = (marks: readonly Mark[]): boolean => {
    const mark = markType.isInSet(marks);
    return mark !== undefined && mark.eq(targetMark);
  };

  // When cursor is at end of parent content, index equals childCount (out of bounds).
  // Clamp to valid range for iteration.
  const startIndex = Math.min($pos.index(), parent.childCount - 1);

  const start = findRangeStart(parent, $pos, startIndex, hasSameMark);
  const end = findRangeEnd(parent, $pos, startIndex, hasSameMark);

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
