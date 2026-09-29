/**
 * Shared types for ReviewEditor modules (DEP-422).
 *
 * @module
 */

import type {
  CommentCreateEvent,
  CommentDeleteEvent,
  CommentUpdateEvent,
  Thread,
  ThreadCreateEvent,
  ThreadDeleteEvent,
} from '../../comments/index.ts';
import type { DiffReviewState } from '../../diff-review-state/index.ts';

/** Review editor mode: edit allows full editing, readonly is view-only. */
export type ReviewMode = 'edit' | 'readonly';

/** Available review document views. */
export type ReviewEditorViewType = 'editor' | 'diff' | 'summary';

/** Available diff rendering modes in the review editor. */
export type ReviewEditorDiffViewMode = 'unified' | 'final' | 'original';

/** FormData structure returned by getFormData(). */
export type ReviewFormData = {
  /** Original/baseline content. */
  original: string;
  /** Current edited content. */
  current: string;
  /** Serialized comment threads as JSON. */
  comments: string;
  /** Unified diff between original and current. */
  diff: string;
  /** LLM-optimized summary markdown. */
  summary: string;
};

export type ReviewEditorProps = {
  /** Unique identifier for accessibility (required). */
  id: string;
  /** Original/baseline content for diff comparison. */
  original?: string;
  /** Current markdown content (two-way bindable). */
  value?: string;
  /**
   * Comment threads (two-way bindable).
   *
   * Anchor positions use two different coordinate spaces, and neither is a raw
   * Markdown string index: `anchor.from` and `anchor.to` are ProseMirror
   * document positions, while `anchor.lastKnownOffset` and
   * `anchor.originalPosition.offset` are `doc.textBetween()` text offsets. All
   * four are expressed against the full document — when the content carries
   * YAML front matter, the component subtracts the front matter's character
   * length before handing anchors to the editor.
   *
   * Positions are verified against the document. A newly seeded anchor whose
   * range does not match its `quote` is reported in dev and re-anchored by
   * quote. The intentional `0`/`0` sentinel created by
   * `toRuntimeThreads(state.threads)` is exempt from the warning and re-anchors
   * normally. Restore persisted state with that helper (or call `setState`)
   * rather than hand-computing positions. See `shared/anchor-types.ts` for the
   * field-by-field contract.
   */
  threads?: Thread[];
  /** Editor mode. */
  mode?: ReviewMode;
  /** Current user ID for permissions. */
  currentUserId?: string | undefined;
  /** Placeholder text when empty. */
  placeholder?: string;
  /** Form field name prefix for hidden inputs (enables form participation). */
  name?: string;
  /** Additional CSS classes. */
  class?: string;
  /** Called when content changes. */
  onValueChange?: (value: string) => void;
  /** Called when user initiates thread creation. */
  onThreadCreate?: (event: ThreadCreateEvent) => void;
  /** Called when a thread is deleted. */
  onThreadDelete?: (event: ThreadDeleteEvent) => void;
  /** Called when a comment is created in an existing thread. */
  onCommentCreate?: (event: CommentCreateEvent) => void;
  /** Called when a comment is updated. */
  onCommentUpdate?: (event: CommentUpdateEvent) => void;
  /** Called when a comment is deleted. */
  onCommentDelete?: (event: CommentDeleteEvent) => void;

  /**
   * Snapshot mode for visual regression testing.
   *
   * When `true`:
   * - Applies `caret-color: transparent` and `user-select: none` to the editor
   *   root via a `data-snapshot-mode` attribute, producing a stable visual
   *   state (no blinking cursor, no selection highlights).
   * - Blurs any focused element inside the component on mount so the initial
   *   screenshot does not capture a focused ring or active caret.
   * - The inner MarkdownEditor instance also receives `snapshotMode={true}`.
   *
   * This is a purely visual / CSS concern. It does NOT affect editability,
   * ProseMirror state, or any prop controlled by `readonly` / `mode`.
   */
  snapshotMode?: boolean;

  /**
   * Opt-in, host-controlled diff-review session for this document's embedded diff tab
   * (COR-512 / DR-7). Absent by default: every existing consumer's behavior, DOM, and export
   * scope are exactly unchanged. Never mutated directly — every change flows back out through
   * `onDiffReviewStateChange`. Independent of `threads`/`ProseMirror` anchoring: enabling or
   * removing this prop never touches document comment threads, and a bound `original`/`value`
   * change latches diff comments outdated without affecting prose threads.
   *
   * `ReviewEditor` reconciles this against its own bound `original`/`value` as a single
   * `markdown` target keyed by its `id` prop (see `buildReviewEditorDiffReviewTarget`), through
   * `restoreDiffReviewState` — the same atomic validate-and-reconcile path a remount uses. An
   * input that fails that validation shows an integration error and keeps the last valid state;
   * ordinary document editing is never affected. Removing this prop stops diff controls/export
   * integration without erasing or overwriting the host's own state; supplying it again
   * re-validates from the current input.
   */
  diffReviewState?: DiffReviewState | undefined;
  /**
   * Called whenever the reconciled diff-review state changes: after a comment/draft/review-note
   * action the diff tab's controls dispatch, and whenever a bound `original`/`value` change
   * latches affected diff comments outdated. Never called for a supplied state that fails
   * validation. Named `onDiffReviewStateChange` (not the cross-package contract's lowercase
   * `ondiffreviewstatechange`): this repository's `check-prop-conventions` gate structurally
   * bans a non-native-passthrough lowercase `on*` prop, exactly like `DiffReview`'s
   * `onStateChange` and `SourceDiffViewer`'s `onFilesChange` before it. The field and payload
   * are otherwise exactly the ratified contract's.
   */
  onDiffReviewStateChange?: (next: DiffReviewState) => void;
};

/** Position for fixed-position popovers (viewport-relative coordinates) */
export interface PopoverPosition {
  x: number;
  y: number;
}
