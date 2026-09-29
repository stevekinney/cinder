// Types
export type {
  EditorAttachmentOptions,
  EditorConfig,
  EditorHandle,
  EditorSelection,
  EditorState,
} from './types.ts';

export { createEditorAttachment } from './attach.ts';
export {
  indentListItem,
  insertHorizontalRule,
  outdentListItem,
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
  getSelectedText,
  isMarkActive,
  isSelectionCollapsed,
  type ActiveBlockType,
  type ActiveMarks,
} from './commands-state.ts';
export { setEditorReadonly } from './editor.ts';
export { getShortcutDisplay } from './keymap-plugin.ts';
export { DEFAULT_DEBOUNCE_MS } from './types.ts';

export { createEditor, destroyEditor } from './editor.ts';

// Position mapping (DEP-39)
export {
  buildTextToProseMirrorPositionMap,
  enrichSelectionWithSource,
  mapPosToSource,
  mapSourceToPos,
  proseMirrorPositionToTextOffset,
  textOffsetToLineColumn,
  textOffsetToProseMirrorPosition,
} from './bridge.ts';

// Keymap plugin configuration
export {
  createEditorKeymap,
  editorKeymap,
  getShortcutDefinitions,
  type EditorKeymapOptions,
  type ShortcutDefinition,
} from './keymap-plugin.ts';

// Template placeholder plugins (DEP-583, COR-526)
export {
  createTemplateCompletionPlugin,
  type TemplateCompletionPluginOptions,
} from './template-completion-plugin.ts';
export { templateCompletionPluginKey } from './template-completion-state.ts';
export {
  createPlaceholderConfigurationTransaction,
  createTemplatePlaceholderConfigurationPlugin,
  templatePlaceholderConfigurationPluginKey,
} from './template-placeholder-configuration-plugin.ts';
export {
  classifyPlaceholderValues,
  resolvePlaceholderConfiguration,
  type PlaceholderEditorConfiguration,
  type PlaceholderValuesStatus,
  type ResolvedPlaceholderConfiguration,
} from './template-placeholder-configuration.ts';

export {
  createTemplateInvalidDecorationPlugin,
  templateInvalidDecorationPluginKey,
} from './template-invalid-decoration-plugin.ts';
