/**
 * Keyboard shortcuts plugin for the Milkdown editor.
 *
 * IMPORTANT: Uses $shortcut + callCommand (NOT raw ProseMirror keymap).
 * This ensures bindings are registered after editor init and respect Milkdown contexts.
 */

import type { MilkdownPlugin } from '@milkdown/ctx';
import type { EditorState } from '@milkdown/kit/prose/state';

type ShortcutRuntime = {
  $shortcut: typeof import('@milkdown/kit/utils').$shortcut;
  callCommand: typeof import('@milkdown/kit/utils').callCommand;
  toggleStrongCommand: typeof import('@milkdown/kit/preset/commonmark').toggleStrongCommand;
  toggleEmphasisCommand: typeof import('@milkdown/kit/preset/commonmark').toggleEmphasisCommand;
  toggleInlineCodeCommand: typeof import('@milkdown/kit/preset/commonmark').toggleInlineCodeCommand;
  wrapInHeadingCommand: typeof import('@milkdown/kit/preset/commonmark').wrapInHeadingCommand;
  wrapInBulletListCommand: typeof import('@milkdown/kit/preset/commonmark').wrapInBulletListCommand;
  wrapInOrderedListCommand: typeof import('@milkdown/kit/preset/commonmark').wrapInOrderedListCommand;
  wrapInBlockquoteCommand: typeof import('@milkdown/kit/preset/commonmark').wrapInBlockquoteCommand;
  insertHrCommand: typeof import('@milkdown/kit/preset/commonmark').insertHrCommand;
  sinkListItemCommand: typeof import('@milkdown/kit/preset/commonmark').sinkListItemCommand;
  liftListItemCommand: typeof import('@milkdown/kit/preset/commonmark').liftListItemCommand;
  toggleStrikethroughCommand: typeof import('@milkdown/kit/preset/gfm').toggleStrikethroughCommand;
  undoCommand: typeof import('@milkdown/kit/plugin/history').undoCommand;
  redoCommand: typeof import('@milkdown/kit/plugin/history').redoCommand;
};

let shortcutRuntime: ShortcutRuntime | null = null;
let shortcutRuntimePromise: Promise<ShortcutRuntime> | null = null;

async function resolveShortcutRuntime(): Promise<ShortcutRuntime> {
  if (shortcutRuntime) return shortcutRuntime;

  shortcutRuntimePromise ??= (async () => {
    const [utilities, commonmark, gfm, history] = await Promise.all([
      import('@milkdown/kit/utils'),
      import('@milkdown/kit/preset/commonmark'),
      import('@milkdown/kit/preset/gfm'),
      import('@milkdown/kit/plugin/history'),
    ]);

    return {
      $shortcut: utilities.$shortcut,
      callCommand: utilities.callCommand,
      toggleStrongCommand: commonmark.toggleStrongCommand,
      toggleEmphasisCommand: commonmark.toggleEmphasisCommand,
      toggleInlineCodeCommand: commonmark.toggleInlineCodeCommand,
      wrapInHeadingCommand: commonmark.wrapInHeadingCommand,
      wrapInBulletListCommand: commonmark.wrapInBulletListCommand,
      wrapInOrderedListCommand: commonmark.wrapInOrderedListCommand,
      wrapInBlockquoteCommand: commonmark.wrapInBlockquoteCommand,
      insertHrCommand: commonmark.insertHrCommand,
      sinkListItemCommand: commonmark.sinkListItemCommand,
      liftListItemCommand: commonmark.liftListItemCommand,
      toggleStrikethroughCommand: gfm.toggleStrikethroughCommand,
      undoCommand: history.undoCommand,
      redoCommand: history.redoCommand,
    };
  })();

  shortcutRuntime = await shortcutRuntimePromise;
  return shortcutRuntime;
}

/**
 * Options for customizing keyboard shortcuts.
 */
export interface EditorKeymapOptions {
  /** Called when Mod-k (link shortcut) is pressed */
  onlinkshortcut?: () => void;
  /** Called when Ctrl-Alt-c (comment shortcut) is pressed (DEP-47) */
  oncommentshortcut?: () => void;
}

/**
 * One-shot latch that lets the next Tab leave the editor (WCAG 2.1.2).
 *
 * Tab/Shift-Tab are bound to sink/lift-list-item, and inside a list item those
 * commands SUCCEED — a successful ProseMirror command returns true, which is
 * also what tells the keymap plugin to `preventDefault` the key. So while the
 * caret sits in a bullet, no Tab ever reaches the browser's sequential
 * navigation: focus cannot leave the editable surface, and every attempt
 * silently re-indents the bullet instead. In prose the same commands return
 * false, the keymap declines the key, and Tab moves focus normally — which is
 * why the trap reads as intermittent: it is a property of the caret's BLOCK,
 * not of the surface, and the user cannot see which one they are in.
 *
 * WCAG 2.1.2 requires a keyboard escape, so Escape arms this latch and the next
 * Tab/Shift-Tab is declined by the keymap and handed to the browser instead of
 * to the list commands.
 *
 * The latch is spent by that one Tab, and is invalidated by any edit or caret
 * move in between, so Tab-to-indent — a real and expected editor affordance —
 * keeps working: an Escape pressed to dismiss a menu, followed by more typing,
 * must not turn a later Tab into a focus move.
 */
interface TabEscapeLatch {
  /** Remember the state Escape was pressed in. */
  arm(state: EditorState): void;
  /**
   * Spend the latch. Returns true when this Tab should fall through to the
   * browser rather than run the list command.
   */
  release(state: EditorState): boolean;
}

function createTabEscapeLatch(): TabEscapeLatch {
  let armedState: EditorState | null = null;

  return {
    arm(state) {
      armedState = state;
    },
    release(state) {
      const armed = armedState;
      // One-shot: a Tab spends the latch whether or not it was still valid.
      armedState = null;
      if (!armed) return false;
      // Identity comparison is sound because EditorState is immutable — a new
      // doc/selection object exists only if a transaction was applied since
      // Escape, i.e. the user edited or moved the caret and is still working.
      return armed.doc === state.doc && armed.selection.eq(state.selection);
    },
  };
}

type CommandCaller = (
  key: Parameters<ShortcutRuntime['callCommand']>[0],
  payload?: unknown,
) => boolean;

/**
 * Build the keymap table.
 *
 * Extracted from the plugin body (and exported) so the Tab behaviour above is
 * reachable from tests without booting a Milkdown editor: `call` stands in for
 * the command dispatcher, whose only interesting property here is whether the
 * list command it runs succeeded.
 *
 * @internal — not part of the package's public surface (see `index.ts`).
 */
export function createKeymapBindings(
  runtime: ShortcutRuntime,
  call: CommandCaller,
  options: EditorKeymapOptions = {},
): Record<string, (state: EditorState) => boolean> {
  const tabEscape = createTabEscapeLatch();

  const bindings: Record<string, (state: EditorState) => boolean> = {
    'Mod-b': () => call(runtime.toggleStrongCommand.key),
    'Mod-i': () => call(runtime.toggleEmphasisCommand.key),
    'Mod-e': () => call(runtime.toggleInlineCodeCommand.key),
    'Mod-Shift-s': () => call(runtime.toggleStrikethroughCommand.key),
    'Mod-Alt-1': () => call(runtime.wrapInHeadingCommand.key, 1),
    'Mod-Alt-2': () => call(runtime.wrapInHeadingCommand.key, 2),
    'Mod-Alt-3': () => call(runtime.wrapInHeadingCommand.key, 3),
    'Mod-Shift-8': () => call(runtime.wrapInBulletListCommand.key),
    'Mod-Shift-7': () => call(runtime.wrapInOrderedListCommand.key),
    // Returning false leaves the event unhandled: the keymap does not
    // preventDefault, so the browser moves focus out of the editor.
    Tab: (state) => (tabEscape.release(state) ? false : call(runtime.sinkListItemCommand.key)),
    'Shift-Tab': (state) =>
      tabEscape.release(state) ? false : call(runtime.liftListItemCommand.key),
    // Arm, then decline the key: Escape has other listeners (menus, popovers,
    // the comment composer), and swallowing it here would break them.
    Escape: (state) => {
      tabEscape.arm(state);
      return false;
    },
    'Mod-Shift-9': () => call(runtime.wrapInBlockquoteCommand.key),
    'Mod-Shift--': () => call(runtime.insertHrCommand.key),
    'Mod-z': () => call(runtime.undoCommand.key),
    'Mod-Shift-z': () => call(runtime.redoCommand.key),
    'Mod-y': () => call(runtime.redoCommand.key),
  };

  if (options.onlinkshortcut) {
    bindings['Mod-k'] = () => {
      options.onlinkshortcut?.();
      return true;
    };
  }

  if (options.oncommentshortcut) {
    bindings['Ctrl-Alt-c'] = () => {
      options.oncommentshortcut?.();
      return true;
    };
  }

  return bindings;
}

/**
 * Create keyboard shortcuts plugin for the Milkdown editor.
 *
 * @param options - Optional callbacks for shortcuts that need external handling
 * @returns Milkdown plugin with keyboard bindings
 *
 * Note: Mod = Cmd on Mac, Ctrl on Windows/Linux
 */
export function createEditorKeymap(options: EditorKeymapOptions = {}): MilkdownPlugin {
  const keymapPlugin: MilkdownPlugin = (ctx) => async () => {
    const runtime = await resolveShortcutRuntime();
    const shortcutPlugin = runtime.$shortcut((shortcutContext) =>
      // Built per editor instance so the Tab-escape latch is not shared between
      // two editors on the same page.
      createKeymapBindings(
        runtime,
        (key, payload) => runtime.callCommand(key, payload)(shortcutContext),
        options,
      ),
    );

    await shortcutPlugin(ctx)();
  };

  return keymapPlugin;
}

/**
 * Default keyboard shortcuts (no external callbacks).
 * @deprecated Use createEditorKeymap() for new code.
 */
export const editorKeymap = createEditorKeymap();

/**
 * Keyboard shortcut definitions for display in the UI.
 * Uses platform-specific modifiers.
 */
export interface ShortcutDefinition {
  action: string;
  keys: string[];
  /** macOS-specific display */
  macKeys?: string[];
}

/**
 * Convert a Mod-style shortcut to platform-specific display string.
 *
 * @param shortcut - Shortcut in Mod notation (e.g., "Mod-b", "Mod-Shift-k")
 * @param isMac - Whether to use macOS symbols (defaults to detecting from navigator)
 * @returns Display string (e.g., "⌘B" on Mac, "Ctrl+B" on Windows)
 *
 * @example
 * getShortcutDisplay('Mod-b')         // "⌘B" on Mac, "Ctrl+B" on Windows
 * getShortcutDisplay('Mod-Shift-s')   // "⌘⇧S" on Mac, "Ctrl+Shift+S" on Windows
 */
export function getShortcutDisplay(shortcut: string, isMac?: boolean): string {
  // Detect platform if not specified (SSR-safe default to false)
  const isMacPlatform =
    isMac ?? (typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform));

  const parts = shortcut.split('-');

  // Convert each part to display format
  const displayParts = parts.map((part) => {
    switch (part) {
      case 'Mod':
        return isMacPlatform ? '⌘' : 'Ctrl';
      case 'Shift':
        return isMacPlatform ? '⇧' : 'Shift';
      case 'Alt':
        return isMacPlatform ? '⌥' : 'Alt';
      case 'Ctrl':
        return isMacPlatform ? '⌃' : 'Ctrl';
      default:
        // Uppercase single letters, keep others as-is
        return part.length === 1 ? part.toUpperCase() : part;
    }
  });

  // Join with + for Windows, no separator for Mac (just symbols)
  return isMacPlatform ? displayParts.join('') : displayParts.join('+');
}

/**
 * Get keyboard shortcuts for the current platform.
 */
export function getShortcutDefinitions(isMac: boolean = false): ShortcutDefinition[] {
  const mod = isMac ? '⌘' : 'Ctrl';
  const alt = isMac ? '⌥' : 'Alt';
  const shift = isMac ? '⇧' : 'Shift';

  return [
    { action: 'Bold', keys: [mod, 'B'] },
    { action: 'Italic', keys: [mod, 'I'] },
    { action: 'Inline Code', keys: [mod, 'E'] },
    { action: 'Strikethrough', keys: [mod, shift, 'S'] },
    { action: 'Link', keys: [mod, 'K'] },
    { action: 'Heading 1', keys: [mod, alt, '1'] },
    { action: 'Heading 2', keys: [mod, alt, '2'] },
    { action: 'Heading 3', keys: [mod, alt, '3'] },
    { action: 'Bullet List', keys: [mod, shift, '8'] },
    { action: 'Ordered List', keys: [mod, shift, '7'] },
    { action: 'Blockquote', keys: [mod, shift, '9'] },
    { action: 'Indent', keys: ['Tab'] },
    { action: 'Outdent', keys: [shift, 'Tab'] },
    // WCAG 2.1.2 requires that a component whose keys are not all unmodified —
    // Tab indents inside a list rather than moving focus — document how to get
    // out. This row IS that documentation, so it has to stay in the list users
    // can see.
    { action: 'Move focus out of the editor (then Tab)', keys: ['Esc'] },
    { action: 'Undo', keys: [mod, 'Z'] },
    { action: 'Redo', keys: isMac ? [mod, shift, 'Z'] : [mod, 'Y'] },
    // Suggestion shortcuts (DEP-43) - suggest-mode-specific
    { action: 'Accept Suggestion (Suggest mode only)', keys: [mod, shift, 'Y'] },
    { action: 'Reject Suggestion (Suggest mode only)', keys: [mod, shift, 'N'] },
    // Comment shortcut (DEP-47) - review-mode-specific
    { action: 'Add Comment (Comment mode only)', keys: ['Ctrl', alt, 'C'] },
  ];
}
