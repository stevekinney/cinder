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

// Browser-safe surface — single canonical re-export path.
// Symbols overlapping with `./component-runtime.js` flow through that module
// so Bun's bundler sees one re-export path per name (see comment in
// `./component-runtime.ts` for the duplicate-export-on-Linux background).
export {
  DEFAULT_DEBOUNCE_MS,
  applyLinkToSelection,
  createEditorAttachment,
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
  type ActiveBlockType,
  type ActiveMarks,
} from './component-runtime.js';

// Server-or-advanced surface — names not in component-runtime.
export { createEditor, destroyEditor } from './editor.js';

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

// Commands not in component-runtime
export {
  getSelectedText,
  indentListItem,
  insertHorizontalRule,
  isMarkActive,
  outdentListItem,
} from './commands.js';

// Keymap plugin extras (DEP-37) — getShortcutDisplay comes from component-runtime
export {
  createEditorKeymap,
  editorKeymap,
  getShortcutDefinitions,
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
