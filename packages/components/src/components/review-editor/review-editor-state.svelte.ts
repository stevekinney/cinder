/**
 * Core state management for ReviewEditor (DEP-422).
 *
 * Provides reactive state for:
 * - Diff statistics (added/removed/modified line counts)
 * - Comment count
 * - Summary content
 * - View type management
 *
 * Uses the factory pattern with lazy getters for dependency injection,
 * matching the established pattern in change-tracker.svelte.ts.
 *
 * @module
 */

import type { Thread } from '@lostgradient/cinder/commentary/comments';
import { generateMarkdownSummary } from '@lostgradient/cinder/commentary/export';
import { computeLineDiff, getDiffStats } from '@lostgradient/cinder/markdown/diff/line-diff';
import { normalize } from '@lostgradient/cinder/markdown/pipeline';
import type {
  ReviewEditorDiffViewMode as DiffViewMode,
  ReviewEditorViewType as ViewType,
} from './review-editor.types.ts';

/**
 * Diff statistics for tracking content changes.
 */
export interface DiffStats {
  added: number;
  removed: number;
  modified: number;
}

/**
 * Options for creating the review editor state manager.
 */
export interface ReviewEditorStateOptions {
  /** Get the original/baseline content */
  getOriginal: () => string;
  /** Get the current content */
  getValue: () => string;
  /** Get the comment threads */
  getThreads: () => Thread[];
}

/**
 * Review editor state manager interface.
 */
export interface ReviewEditorState {
  /** Active view: editor, diff, or summary */
  readonly activeView: ViewType;
  /** Set the active view */
  setActiveView(view: ViewType): void;

  /** Diff view mode: unified, final, or original */
  readonly diffViewMode: DiffViewMode;
  /** Set the diff view mode */
  setDiffViewMode(mode: DiffViewMode): void;

  /** Statistics about content changes (added/removed/modified lines) */
  readonly diffStats: DiffStats;
  /** Whether there are any content changes */
  readonly hasContentChanges: boolean;
  /** Total comment count (excluding soft-deleted) */
  readonly commentCount: number;
  /** Summary content without heading (for UI preview) */
  readonly summaryContent: string;
}

/**
 * Create a review editor state manager.
 *
 * @example
 * ```svelte
 * <script>
 *   import { createReviewEditorState } from './review-editor-state.svelte';
 *
 *   const state = createReviewEditorState({
 *     getOriginal: () => original,
 *     getValue: () => value,
 *     getThreads: () => threads,
 *   });
 *
 *   // Access reactive values
 *   const diffStats = $derived(state.diffStats);
 *   const hasChanges = $derived(state.hasContentChanges);
 * </script>
 * ```
 */
export function createReviewEditorState(options: ReviewEditorStateOptions): ReviewEditorState {
  const { getOriginal, getValue, getThreads } = options;

  // Internal state
  let activeView = $state<ViewType>('editor');
  let diffViewMode = $state<DiffViewMode>('unified');

  // Computed diff statistics
  const diffStats = $derived.by((): DiffStats => {
    const original = getOriginal();
    if (!original) {
      return { added: 0, removed: 0, modified: 0 };
    }
    // Normalize both inputs to avoid false positives from formatting differences
    const normalizedOriginal = normalize(original);
    const normalizedCurrent = normalize(getValue());
    const lineDiffs = computeLineDiff(normalizedOriginal, normalizedCurrent);
    return getDiffStats(lineDiffs);
  });

  // Whether there are any content changes
  const hasContentChanges = $derived(
    diffStats.added > 0 || diffStats.removed > 0 || diffStats.modified > 0,
  );

  // Total comment count (excluding soft-deleted comments)
  const commentCount = $derived.by(() => {
    const threads = getThreads();
    return threads.reduce((count, thread) => {
      return count + thread.comments.filter((c) => !c.deletedAt).length;
    }, 0);
  });

  // Summary content for the Summary view (without heading)
  const summaryContent = $derived.by(() => {
    const threads = getThreads();
    const state = {
      schemaVersion: 4 as const,
      content: getValue(),
      original: getOriginal() || undefined,
      threads: threads.map((t) => ({
        ...t,
        anchor: {
          quote: t.anchor.quote,
          prefix: t.anchor.prefix,
          suffix: t.anchor.suffix,
          status: t.anchor.status,
          blockId: t.anchor.blockId,
          originalPosition: t.anchor.originalPosition,
          originalQuote: t.anchor.originalQuote,
          lastKnownOffset: t.anchor.lastKnownOffset,
        },
      })),
      // Static timestamp for state construction - not meant to be reactive
      updatedAt: '',
    };
    const result = generateMarkdownSummary(state);
    // Strip the "# Review Summary\n" heading from the beginning
    return result.markdown.replace(/^# Review Summary\n+/, '');
  });

  return {
    get activeView() {
      return activeView;
    },
    setActiveView(view: ViewType) {
      activeView = view;
    },

    get diffViewMode() {
      return diffViewMode;
    },
    setDiffViewMode(mode: DiffViewMode) {
      diffViewMode = mode;
    },

    get diffStats() {
      return diffStats;
    },
    get hasContentChanges() {
      return hasContentChanges;
    },
    get commentCount() {
      return commentCount;
    },
    get summaryContent() {
      return summaryContent;
    },
  };
}
