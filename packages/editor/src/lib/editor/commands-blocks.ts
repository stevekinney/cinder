import type { Ctx } from '@milkdown/kit/ctx';
import type { Schema } from '@milkdown/kit/prose/model';
import { getActiveBlockType } from './commands-state.ts';
import { getCommandRuntime, getEditorViewAndSchema, runCommand } from './commands.ts';

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
function toggleList(ctx: Ctx, listType: 'bullet' | 'ordered'): boolean {
  const runtime = getCommandRuntime();
  if (!runtime) return false;

  const command =
    listType === 'bullet'
      ? runtime.wrapInBulletListCommand.key
      : runtime.wrapInOrderedListCommand.key;
  if (runCommand(ctx, command)) return true;

  return toggleListFallback(ctx, listType);
}

export function toggleBulletList(ctx: Ctx): boolean {
  return toggleList(ctx, 'bullet');
}

/**
 * Toggle ordered list on the current block.
 */
export function toggleOrderedList(ctx: Ctx): boolean {
  return toggleList(ctx, 'ordered');
}

function shouldLiftListItem(
  activeBlock: ReturnType<typeof getActiveBlockType>,
  listType: 'bullet' | 'ordered',
): boolean {
  return activeBlock.type === 'listItem' && activeBlock.listType === listType;
}

function liftListItemIfNeeded(
  runtime: ReturnType<typeof getCommandRuntime>,
  view: NonNullable<ReturnType<typeof getEditorViewAndSchema>['view']>,
  listItemType: Parameters<NonNullable<ReturnType<typeof getCommandRuntime>>['liftListItem']>[0],
  activeBlock: ReturnType<typeof getActiveBlockType>,
  listType: 'bullet' | 'ordered',
): boolean {
  if (!runtime || !shouldLiftListItem(activeBlock, listType)) return false;
  const lifted = runtime.liftListItem(listItemType)(view.state, view.dispatch);
  if (!lifted) return false;
  view.focus();
  return true;
}

function listTypes(schema: Schema, listType: 'bullet' | 'ordered') {
  const listItemType = schema.nodes['list_item'];
  const listNodeType =
    listType === 'bullet' ? schema.nodes['bullet_list'] : schema.nodes['ordered_list'];
  return listItemType && listNodeType ? { listItemType, listNodeType } : null;
}

function isOtherList(
  activeBlock: ReturnType<typeof getActiveBlockType>,
  listType: 'bullet' | 'ordered',
): boolean {
  return (
    activeBlock.type === 'listItem' &&
    Boolean(activeBlock.listType) &&
    !shouldLiftListItem(activeBlock, listType)
  );
}

function toggleListFallback(ctx: Ctx, listType: 'bullet' | 'ordered'): boolean {
  const runtime = getCommandRuntime();
  if (!runtime) return false;

  try {
    const { view, schema } = getEditorViewAndSchema(ctx);

    if (!view || !schema) return false;

    const types = listTypes(schema, listType);
    if (!types) return false;

    const activeBlock = getActiveBlockType(ctx);
    const isSameList = shouldLiftListItem(activeBlock, listType);
    if (
      isSameList &&
      liftListItemIfNeeded(runtime, view, types.listItemType, activeBlock, listType)
    ) {
      return true;
    }
    if (isOtherList(activeBlock, listType)) {
      runtime.liftListItem(types.listItemType)(view.state, view.dispatch);
    }

    const wrapped = runtime.wrapInList(types.listNodeType)(view.state, view.dispatch);
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
