/**
 * Keyboard shortcuts plugin for the Milkdown editor.
 *
 * IMPORTANT: Uses $shortcut + callCommand (NOT raw ProseMirror keymap).
 * This ensures bindings are registered after editor init and respect Milkdown contexts.
 */

import type { MilkdownPlugin } from '@milkdown/ctx';

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
    const shortcutPlugin = runtime.$shortcut((shortcutContext) => {
      const call = <T>(key: Parameters<typeof runtime.callCommand>[0], payload?: T) =>
        runtime.callCommand(key, payload)(shortcutContext);

      const bindings: Record<string, () => boolean> = {
        'Mod-b': () => call(runtime.toggleStrongCommand.key),
        'Mod-i': () => call(runtime.toggleEmphasisCommand.key),
        'Mod-e': () => call(runtime.toggleInlineCodeCommand.key),
        'Mod-Shift-s': () => call(runtime.toggleStrikethroughCommand.key),
        'Mod-Alt-1': () => call(runtime.wrapInHeadingCommand.key, 1),
        'Mod-Alt-2': () => call(runtime.wrapInHeadingCommand.key, 2),
        'Mod-Alt-3': () => call(runtime.wrapInHeadingCommand.key, 3),
        'Mod-Shift-8': () => call(runtime.wrapInBulletListCommand.key),
        'Mod-Shift-7': () => call(runtime.wrapInOrderedListCommand.key),
        Tab: () => call(runtime.sinkListItemCommand.key),
        'Shift-Tab': () => call(runtime.liftListItemCommand.key),
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
    });

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
    { action: 'Undo', keys: [mod, 'Z'] },
    { action: 'Redo', keys: isMac ? [mod, shift, 'Z'] : [mod, 'Y'] },
    // Suggestion shortcuts (DEP-43) - suggest-mode-specific
    { action: 'Accept Suggestion (Suggest mode only)', keys: [mod, shift, 'Y'] },
    { action: 'Reject Suggestion (Suggest mode only)', keys: [mod, shift, 'N'] },
    // Comment shortcut (DEP-47) - review-mode-specific
    { action: 'Add Comment (Comment mode only)', keys: ['Ctrl', alt, 'C'] },
  ];
}
