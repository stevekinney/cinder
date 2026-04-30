/**
 * Browser-safe editor surface for Svelte components.
 *
 * This subpath intentionally excludes template rendering helpers that load the
 * markdown rendering pipeline at module-evaluation time.
 */

export { createEditorAttachment } from './attach.js';
export {
  applyLinkToSelection,
  getActiveBlockType,
  getActiveMarks,
  getLinkAtCursor,
  getLinkRangeAtCursor,
  getLinkTextAtCursor,
  insertLinkAtCursor,
  isSelectionCollapsed,
  redo,
  removeLink,
  setHeading,
  setParagraph,
  toggleBlockquote,
  toggleBold,
  toggleBulletList,
  toggleCode,
  toggleItalic,
  toggleOrderedList,
  toggleStrikethrough,
  undo,
  updateLinkAtCursor,
  type ActiveBlockType,
  type ActiveMarks,
} from './commands.js';
export { setEditorReadonly } from './editor.js';
export { getShortcutDisplay } from './keymap-plugin.js';
export { DEFAULT_DEBOUNCE_MS } from './types.js';
export type {
  EditorHandle,
  EditorSelection,
  EditorState,
  PlaceholderCompletionConfiguration,
  PlaceholderDecorationConfiguration,
} from './types.js';
