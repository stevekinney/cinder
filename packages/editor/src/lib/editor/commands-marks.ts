import type { Ctx } from '@milkdown/kit/ctx';
import { findWordRange } from './commands-state.ts';
import { getCommandRuntime, getEditorViewAndSchema, runCommand } from './commands.ts';

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
