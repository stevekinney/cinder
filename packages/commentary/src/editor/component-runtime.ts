/**
 * Browser-safe editor surface for Svelte components.
 *
 * This subpath intentionally excludes template rendering helpers that load the
 * markdown rendering pipeline at module-evaluation time.
 *
 * This module is the **single canonical re-export source** for the symbols
 * listed below. `./index.ts` (the package root) re-exports these names from
 * here rather than from `./commands.js` directly, so every consumer of the
 * package sees one re-export path per name. Bun's bundler on Linux emits a
 * `Duplicate export of '<name>'` SyntaxError at module evaluation when both
 * package entry points re-export the same name from `./commands.js`
 * independently — routing index through component-runtime collapses those
 * two paths into one and eliminates the duplicate.
 */

export type {
  PlaceholderCompletionConfiguration,
  PlaceholderDecorationConfiguration,
} from '@lostgradient/markdown/templates/types';
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
export type { EditorHandle, EditorSelection, EditorState } from './types.js';
