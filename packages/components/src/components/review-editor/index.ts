import ReviewEditor from './review-editor.svelte';

export default ReviewEditor;
export type {
  CommentAnchor,
  PersistedThread,
  ReviewState,
  Thread,
} from 'cinder/commentary/comments';
export { ReviewEditor };

// DEP-422: Shared types
export type {
  PopoverPosition,
  ReviewEditorDiffViewMode,
  ReviewEditorProps,
  ReviewEditorViewType,
  ReviewFormData,
  ReviewMode,
} from './review-editor-types';

// DEP-422: Extracted runes modules for state management (experimental)
export { createReviewEditorState } from './review-editor-state.svelte';
export type {
  DiffStats,
  ReviewEditorState,
  ReviewEditorStateOptions,
} from './review-editor-state.svelte';

export { createThreadManager } from './review-editor-threads.svelte';
export type { ThreadManager, ThreadManagerOptions } from './review-editor-threads.svelte';

export { createSelectionPopover } from './review-editor-selection.svelte';
export type { SelectionPopover, SelectionPopoverOptions } from './review-editor-selection.svelte';

export { createAnchorManager, toPersistedThreads } from './review-editor-anchors.svelte';
export type { AnchorManager, AnchorManagerOptions } from './review-editor-anchors.svelte';

// DEP-422: Pure export utilities
export {
  buildFormData,
  buildFormDataFromValues,
  exportCommentsMarkdown,
  exportMarkdownSummary,
  exportUnifiedDiff,
  getSummaryContentWithoutHeading,
} from './review-editor-exports';
export type { ReviewFormData as ExportedReviewFormData } from './review-editor-exports';

// DEP-48: Export actions for clipboard export
export { default as ExportActions } from './export-actions.svelte';

// Thread UI components (for standalone use)
export { default as ThreadPopover } from './thread-popover.svelte';

export { default as CommentList } from './comment-list.svelte';

export { default as CommentComposer } from './comment-composer.svelte';
