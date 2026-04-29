/**
 * Milkdown editor integration for SvelteKit.
 *
 * This module provides the core editor functionality for the
 * Markdown Review Editor, integrating Milkdown (ProseMirror-based)
 * with Svelte 5 patterns.
 *
 * @example
 * ```svelte
 * <script>
 *   import { createEditorAttachment, type EditorHandle } from '$lib/editor';
 *
 *   let markdown = $state('# Hello');
 *   let handle: EditorHandle | null = null;
 * </script>
 * ```
 *
 * @packageDocumentation
 */

// Types
export type {
  EditorAttachmentOptions,
  EditorConfig,
  EditorHandle,
  EditorSelection,
  EditorState,
} from './types.js';

export { DEFAULT_DEBOUNCE_MS } from './types.js';

// Core editor
export { createEditor, destroyEditor, setEditorReadonly } from './editor.js';

// Svelte integration
export { createEditorAttachment } from './attach.js';

// Position mapping (DEP-39)
export {
  buildTextToProseMirrorPositionMap,
  enrichSelectionWithSource,
  mapPosToSource,
  mapSourceToPos,
  proseMirrorPositionToTextOffset,
  textOffsetToLineColumn,
  textOffsetToProseMirrorPosition,
} from './bridge.js';

// Commands (DEP-37)
export {
  applyLinkToSelection,
  getActiveBlockType,
  getActiveMarks,
  getLinkAtCursor,
  getLinkRangeAtCursor,
  getLinkTextAtCursor,
  getSelectedText,
  indentListItem,
  insertHorizontalRule,
  // Link commands
  insertLinkAtCursor,
  // State queries
  isMarkActive,
  isSelectionCollapsed,
  outdentListItem,
  redo,
  removeLink,
  // Block commands
  setHeading,
  setParagraph,
  toggleBlockquote,
  // Mark commands
  toggleBold,
  toggleBulletList,
  toggleCode,
  toggleItalic,
  toggleOrderedList,
  toggleStrikethrough,
  // History commands
  undo,
  updateLinkAtCursor,
  type ActiveBlockType,
  // Types
  type ActiveMarks,
} from './commands.js';

// Keymap plugin (DEP-37)
export {
  createEditorKeymap,
  editorKeymap,
  getShortcutDefinitions,
  getShortcutDisplay,
  type EditorKeymapOptions,
  type ShortcutDefinition,
} from './keymap-plugin.js';

// Template placeholders (DEP-582, DEP-625)
export {
  buildPlaceholderCandidatesFromJsonSchema,
  isBlockedSegment,
  parsePlaceholderTokens,
  resolveTemplatePlaceholders,
  validatePlaceholderTokens,
} from './template-placeholders.js';

// Template rendering (DEP-625)
// Not re-exported here to avoid loading heavy @cinder/markdown pipeline for lightweight placeholder operations
// Import from '@cinder/editor/template-render' instead

// Placeholder security (DEP-625)
export { RESERVED_SEGMENTS } from './placeholder-security.js';

// Template placeholder plugins (DEP-583)
export {
  createTemplateCompletionPlugin,
  templateCompletionPluginKey,
} from './template-completion-plugin.js';

export {
  createTemplateInvalidDecorationPlugin,
  templateInvalidDecorationPluginKey,
} from './template-invalid-decoration-plugin.js';

export type {
  PlaceholderCandidate,
  PlaceholderCompletionConfiguration,
  PlaceholderDecorationConfiguration,
  PlaceholderResolutionResult,
  PlaceholderToken,
  PlaceholderValidationIssue,
  PlaceholderValidationResult,
  PlaceholderValueKind,
} from './types.js';
