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
import type { Schema } from '@milkdown/kit/prose/model';
import type { EditorView } from '@milkdown/kit/prose/view';
import { DEV } from 'esm-env';

export type CommandRuntime = {
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
    const [core, commonmark, gfm, history, schemaList, utilities] = await Promise.all([
      import('@milkdown/kit/core'),
      import('@milkdown/kit/preset/commonmark'),
      import('@milkdown/kit/preset/gfm'),
      import('@milkdown/kit/plugin/history'),
      import('@milkdown/kit/prose/schema-list'),
      import('@milkdown/kit/utils'),
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

export function getCommandRuntime(): CommandRuntime | null {
  if (commandRuntime) return commandRuntime;

  commandRuntimePromise ??= resolveCommandRuntime();
  return null;
}

export function shouldLogDevelopmentWarnings(): boolean {
  return DEV;
}

export function getEditorView(ctx: Ctx): EditorView | null {
  const runtime = getCommandRuntime();
  if (!runtime) return null;
  return ctx.get(runtime.editorViewCtx);
}

export function getEditorSchema(ctx: Ctx): Schema | null {
  const runtime = getCommandRuntime();
  if (!runtime) return null;
  return ctx.get(runtime.schemaCtx);
}

export function getEditorViewAndSchema(ctx: Ctx): {
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
