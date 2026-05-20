/**
 * Shared types for ReviewEditor modules (DEP-422).
 *
 * @module
 */

import type { Snippet } from 'svelte';
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

  // ─── Headless seams (DEP plan C8) — opt-in snippet overrides ───────────────

  /**
   * Custom thread-list rendering. Receives a {@link ThreadListContext} with
   * the current threads, active thread, and selection helpers. Defaults to
   * the built-in list when omitted.
   */
  threadList?: Snippet<[ThreadListContext]> | undefined;

  /**
   * Custom sidebar rendering. Receives a {@link SidebarContext}. Defaults to
   * the built-in sidebar when omitted.
   */
  sidebar?: Snippet<[SidebarContext]> | undefined;

  /**
   * Custom front-matter panel rendering. Receives a {@link FrontMatterContext}.
   * Defaults to the built-in panel when omitted.
   */
  frontMatterPanel?: Snippet<[FrontMatterContext]> | undefined;

  /**
   * Custom export-actions rendering. Receives an {@link ExportContext}.
   * Defaults to the built-in export menu when omitted.
   */
  exportActions?: Snippet<[ExportContext]> | undefined;
};

/** Position for fixed-position popovers (viewport-relative coordinates) */
export interface PopoverPosition {
  x: number;
  y: number;
}

// ─── Headless-seam contexts (DEP plan C8) ────────────────────────────────────
//
// These context shapes are passed to optional snippet props on ReviewEditor.
// Each is intentionally minimal — only the fields a custom implementation
// actually needs. They form part of the component's public surface; future
// changes are breaking changes.

/** Context passed to the optional `threadList` snippet. */
export type ThreadListContext = {
  /** Current set of threads (immutable view). */
  readonly threads: readonly Thread[];
  /** Currently active thread, if any. */
  readonly activeThreadId: string | null;
  /** Make `id` the active thread. */
  readonly selectThread: (id: string) => void;
  /** Mark `id` resolved. */
  readonly resolveThread: (id: string) => void;
};

/** Context passed to the optional `sidebar` snippet. */
export type SidebarContext = {
  /** Whether the sidebar is currently open. */
  readonly isOpen: boolean;
  /** Toggle the sidebar open/closed. */
  readonly toggle: () => void;
  /** Thread state shared with `threadList`. */
  readonly threads: ThreadListContext;
};

/** Front-matter field exposed via `frontMatterPanel`. */
export type FrontMatterField = {
  readonly key: string;
  readonly value: unknown;
};

/** Front-matter error exposed via `frontMatterPanel`. */
export type FrontMatterError = {
  readonly key: string;
  readonly message: string;
};

/** Context passed to the optional `frontMatterPanel` snippet. */
export type FrontMatterContext = {
  readonly fields: readonly FrontMatterField[];
  readonly updateField: (key: string, value: unknown) => void;
  readonly errors: readonly FrontMatterError[];
};

/** Export format identifier (e.g., 'markdown', 'json', 'diff'). */
export type ExportFormat = string;

/** Context passed to the optional `exportActions` snippet. */
export type ExportContext = {
  readonly formats: readonly ExportFormat[];
  readonly export: (format: ExportFormat) => Promise<void>;
  readonly isExporting: boolean;
};

/** Optional snippet props for ReviewEditor (headless seams). */
export type ReviewEditorSnippetProps = {
  /** Custom thread list rendering. Defaults to the built-in list. */
  threadList?: Snippet<[ThreadListContext]> | undefined;
  /** Custom sidebar rendering. Defaults to the built-in sidebar. */
  sidebar?: Snippet<[SidebarContext]> | undefined;
  /** Custom front-matter panel rendering. Defaults to the built-in panel. */
  frontMatterPanel?: Snippet<[FrontMatterContext]> | undefined;
  /** Custom export actions rendering. Defaults to the built-in export menu. */
  exportActions?: Snippet<[ExportContext]> | undefined;
};
