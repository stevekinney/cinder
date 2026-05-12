/**
 * Browser-safe editor surface for Svelte components.
 *
 * This subpath intentionally excludes template rendering helpers that load the
 * markdown rendering pipeline at module-evaluation time.
 *
 * Symbols are imported and re-exported (not `export ... from`) so that, when a
 * bundle's transitive graph reaches both `@cinder/editor` and
 * `@cinder/editor/component-runtime`, Bun's re-export inlining doesn't emit
 * parallel `export { foo } from './commands.js'` statements that collapse to
 * a duplicate-export SyntaxError at module load. The two entry surfaces still
 * resolve to the same `./commands.js` module instance under ESM semantics.
 */

import { createEditorAttachment } from './attach.js';
import {
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
} from './commands.js';
import { setEditorReadonly } from './editor.js';
import { getShortcutDisplay } from './keymap-plugin.js';
import { DEFAULT_DEBOUNCE_MS } from './types.js';

export {
  applyLinkToSelection,
  createEditorAttachment,
  DEFAULT_DEBOUNCE_MS,
  getActiveBlockType,
  getActiveMarks,
  getLinkAtCursor,
  getLinkRangeAtCursor,
  getLinkTextAtCursor,
  getShortcutDisplay,
  insertLinkAtCursor,
  isSelectionCollapsed,
  redo,
  removeLink,
  setEditorReadonly,
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
};

export type { ActiveBlockType, ActiveMarks } from './commands.js';

export type {
  EditorHandle,
  EditorSelection,
  EditorState,
  PlaceholderCompletionConfiguration,
  PlaceholderDecorationConfiguration,
} from './types.js';
