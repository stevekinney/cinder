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
} from '@cinder/commentary/comments';

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
  /** Comment threads (two-way bindable). */
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
  onchange?: (value: string) => void;
  /** Called when user initiates thread creation. */
  onthreadcreate?: (event: ThreadCreateEvent) => void;
  /** Called when a thread is deleted. */
  onthreaddelete?: (event: ThreadDeleteEvent) => void;
  /** Called when a comment is created in an existing thread. */
  oncommentcreate?: (event: CommentCreateEvent) => void;
  /** Called when a comment is updated. */
  oncommentupdate?: (event: CommentUpdateEvent) => void;
  /** Called when a comment is deleted. */
  oncommentdelete?: (event: CommentDeleteEvent) => void;
};

/** Position for fixed-position popovers (viewport-relative coordinates) */
export interface PopoverPosition {
  x: number;
  y: number;
}
