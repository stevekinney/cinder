/**
 * Display-only keyboard shortcut helpers.
 *
 * These are pure string functions the toolbar renders synchronously, so they
 * live apart from `keymap-plugin.ts`, which loads Milkdown at module
 * evaluation. The toolbar can then show shortcut labels without evaluating
 * Milkdown or ProseMirror (COR-1322).
 */

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
    // cinder#1302: this row previously listed plain Tab/Shift-Tab as the
    // indent/outdent shortcut. That was accurate before this fix (Tab
    // unconditionally indented) and is misleading after it: Tab still
    // indents contextually (inside a list/table, unless the Escape-then-Tab
    // latch just released it — see the row below), but it is no longer the
    // shortcut a user should be told to rely on, since it can decline to
    // indent depending on focus-escape state. Mod-]/Mod-[ indent/outdent
    // unconditionally, with no such caveat, so they're what this row
    // documents now.
    { action: 'Indent / Next Table Cell', keys: [mod, ']'] },
    { action: 'Outdent / Previous Table Cell', keys: [mod, '['] },
    // WCAG 2.1.2 requires that a component whose keys are not all unmodified —
    // Tab indents inside a list, or moves to the next table cell, rather than
    // moving focus — document how to get out. This row IS that documentation,
    // so it has to stay in the list users can see.
    { action: 'Move focus out of the editor (then Tab)', keys: ['Esc'] },
    { action: 'Undo', keys: [mod, 'Z'] },
    { action: 'Redo', keys: isMac ? [mod, shift, 'Z'] : [mod, 'Y'] },
    // Suggestion shortcuts (DEP-43) - suggest-mode-specific
    { action: 'Accept Suggestion (Suggest mode only)', keys: [mod, shift, 'Y'] },
    { action: 'Reject Suggestion (Suggest mode only)', keys: [mod, shift, 'N'] },
    // Comment shortcut (DEP-47) - review-mode-specific
    { action: 'Add Comment (Comment mode only)', keys: ['Ctrl', alt, 'C'] },
    // cinder#1304: keyboard route to an anchored comment. `.comment-anchor`
    // decorations carry no tabindex (deliberately — see
    // anchor-decorations.ts), so this is how a keyboard/AT user reaches one
    // without a mouse. Wired in ReviewEditor's container keydown handler
    // (review-editor-impl.svelte), not in this package's own keymap, because
    // it needs `threads` state only ReviewEditor has.
    //
    // `mod` (⌘ on mac, Ctrl elsewhere), not the literal `Ctrl` the other
    // review shortcuts above use: Control+Option is macOS VoiceOver's own
    // modifier prefix, so a literal Ctrl-Alt-Arrow chord is consumed by
    // VoiceOver before it ever reaches this component on a Mac — the one
    // platform where an AT-only keyboard route matters most. Cmd+Option
    // does not collide with VO's modifier.
    { action: 'Next Comment (ReviewEditor only)', keys: [mod, alt, '↓'] },
    { action: 'Previous Comment (ReviewEditor only)', keys: [mod, alt, '↑'] },
  ];
}
