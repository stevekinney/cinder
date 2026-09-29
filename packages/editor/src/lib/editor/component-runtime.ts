/**
 * Browser-safe editor surface for Svelte components.
 *
 * This subpath intentionally excludes template rendering helpers that load the
 * markdown rendering pipeline at module-evaluation time.
 *
 * This module is the **single canonical re-export source** for the symbols
 * listed below. Bun's bundler on Linux emits a `Duplicate export of '<name>'`
 * SyntaxError at module evaluation when two package entry points re-export the
 * same name from the same module independently — routing through one module
 * collapses those paths into one and eliminates the duplicate.
 *
 * Upstream drew the command names from a single `./commands.ts`; corvidae split
 * that module into `commands-blocks`, `commands-links`, `commands-marks` and
 * `commands-state`, so each name is re-exported from its new home. The
 * placeholder configuration types come from `@lostgradient/markdown`'s single source
 * export rather than upstream's `@lostgradient/markdown/templates/types`
 * subpath, which corvidae's one-key `exports` map does not carry.
 */

export type {
  PlaceholderCompletionConfiguration,
  PlaceholderDecorationConfiguration,
} from '@lostgradient/markdown';
export { createEditorAttachment } from './attach.ts';
export {
  redo,
  setHeading,
  setParagraph,
  toggleBlockquote,
  toggleBulletList,
  toggleOrderedList,
  undo,
} from './commands-blocks.ts';
export {
  applyLinkToSelection,
  getLinkAtCursor,
  getLinkRangeAtCursor,
  getLinkTextAtCursor,
  insertLinkAtCursor,
  removeLink,
  updateLinkAtCursor,
} from './commands-links.ts';
export { toggleBold, toggleCode, toggleItalic, toggleStrikethrough } from './commands-marks.ts';
export {
  getActiveBlockType,
  getActiveMarks,
  isSelectionCollapsed,
  type ActiveBlockType,
  type ActiveMarks,
} from './commands-state.ts';
export { setEditorReadonly } from './editor.ts';
export { getShortcutDisplay } from './keymap-plugin.ts';
export { DEFAULT_DEBOUNCE_MS } from './types.ts';
export type { EditorHandle, EditorSelection, EditorState } from './types.ts';
