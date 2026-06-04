/**
 * Thread management for ReviewEditor (DEP-422).
 *
 * Handles:
 * - Thread/comment CRUD operations
 * - Thread popover state (open/close/position)
 * - Active thread tracking
 * - Sidebar thread selection
 *
 * Uses the factory pattern with lazy getters for dependency injection.
 *
 * **Note:** This module is experimental and provides an alternative implementation
 * to the inline thread management in `review-editor.svelte`. It is exported for
 * testing and potential future refactoring, but the component does not currently
 * delegate to this factory. Behavior fixes should be made in both locations until
 * the component is refactored to use this module.
 *
 * @module
 * @experimental
 */

import { buildAnchorFromSelection } from '@lostgradient/cinder/commentary/anchoring';
import type {
  CommentCreateEvent,
  CommentDeleteEvent,
  CommentUpdateEvent,
  Thread,
  ThreadCreateEvent,
  ThreadDeleteEvent,
} from '@lostgradient/cinder/commentary/comments';
import {
  createDocumentAnchor,
  extractMentions,
  generateId,
} from '@lostgradient/cinder/commentary/comments';
import type { EditorView } from '@milkdown/kit/prose/view';
import { devWarn } from '../../utilities/dev-warn.ts';
import type { PopoverPosition, ReviewMode } from './review-editor-types';

/** Type alias for thread ID to improve readability */
type ThreadId = string;

// Re-export PopoverPosition for backwards compatibility
export type { PopoverPosition } from './review-editor-types';

/**
 * Options for creating the thread manager.
 */
export interface ThreadManagerOptions {
  /** Get the current threads */
  getThreads: () => Thread[];
  /** Get the editor view (may be undefined during initialization) */
  getEditorView: () => EditorView | undefined;
  /** Get the current mode */
  getMode: () => ReviewMode;
  /** Get the current user ID */
  getCurrentUserId: () => string | undefined;
  /** Get the preferred scroll behavior */
  getScrollBehavior: () => ScrollBehavior;
  /** Announce message to screen readers */
  announce: (message: string, priority?: 'polite' | 'assertive') => void;

  // Event callbacks
  onthreadcreate?: (event: ThreadCreateEvent) => void;
  onthreaddelete?: (event: ThreadDeleteEvent) => void;
  oncommentcreate?: (event: CommentCreateEvent) => void;
  oncommentupdate?: (event: CommentUpdateEvent) => void;
  oncommentdelete?: (event: CommentDeleteEvent) => void;

  /**
   * Callback to clear conflicting popovers before opening thread popover.
   * Called when anchor click or sidebar selection opens a thread popover.
   * Use this to dismiss selection popover state to prevent stale popovers.
   */
  onBeforePopoverOpen?: () => void;
}

/**
 * Thread manager interface.
 */
export interface ThreadManager {
  // Popover state
  /** Currently open thread ID in popover */
  readonly popoverThreadId: ThreadId | null;
  /** Position of the thread popover */
  readonly popoverPosition: PopoverPosition | null;
  /** The thread being shown in the popover */
  readonly popoverThread: Thread | null;
  /** Currently active thread ID (for sidebar highlighting) */
  readonly activeThreadId: ThreadId | null;

  // Popover actions
  /** Open popover for a thread at a position */
  openPopover(threadId: ThreadId, position: PopoverPosition): void;
  /** Close the popover */
  closePopover(): void;
  /** Handle anchor click to open popover */
  handleAnchorClick(threadId: ThreadId, event: MouseEvent): void;
  /** Handle thread selection from sidebar */
  handleSidebarThreadSelect(threadId: ThreadId): void;

  // Thread CRUD
  /** Create a thread at the current selection */
  createThread(
    body: string,
    authorId: string,
    selection: { from: number; to: number } | null,
  ): string | null;
  /** Create a document-level thread */
  createDocumentThread(body: string, authorId: string): string | null;
  /** Create a block-level thread at cursor position */
  createBlockThread(body: string, authorId: string): string | null;
  /** Delete a thread */
  deleteThread(threadId: ThreadId): void;
  /** Clear all threads */
  clearAllThreads(): void;

  // Comment CRUD
  /** Create a comment in a thread */
  createComment(threadId: ThreadId, body: string, authorId: string): string | null;
  /** Update a comment */
  updateComment(threadId: ThreadId, commentId: string, body: string): void;
  /** Delete a comment */
  deleteComment(threadId: ThreadId, commentId: string, soft?: boolean): void;

  // Popover handlers (for ThreadPopover component)
  /** Handle popover close */
  handlePopoverClose(): void;
  /** Handle thread delete from popover */
  handlePopoverDelete(threadId: ThreadId): void;
  /** Handle comment create from popover */
  handlePopoverCommentCreate(threadId: ThreadId, body: string): void;
  /** Handle comment update from popover */
  handlePopoverCommentUpdate(threadId: ThreadId, commentId: string, body: string): void;
  /** Handle comment delete from popover */
  handlePopoverCommentDelete(threadId: ThreadId, commentId: string): void;

  // Utilities
  /** Scroll an anchor into view */
  scrollAnchorIntoView(threadId: ThreadId): void;
  /** Scroll to a thread in the editor */
  scrollToThread(threadId: ThreadId): void;
  /** Calculate viewport position for a document position */
  calculateViewportPosition(from: number): PopoverPosition | null;

  // Cleanup
  /** Destroy the manager and clean up resources */
  destroy(): void;
}

/** Delay for scroll-then-position pattern (matches smooth scroll duration) */
const POSITION_DELAY_MS = 350;

/**
 * Create a thread manager.
 *
 * @example
 * ```svelte
 * <script>
 *   import { createThreadManager } from './review-editor-threads.svelte';
 *
 *   const threadManager = createThreadManager({
 *     getThreads: () => threads,
 *     getEditorView: () => editorRef?.getView(),
 *     getMode: () => mode,
 *     getCurrentUserId: () => currentUserId,
 *     getScrollBehavior,
 *     announce,
 *     onthreadcreate,
 *     onthreaddelete,
 *     oncommentcreate,
 *     oncommentupdate,
 *     oncommentdelete,
 *   });
 * </script>
 * ```
 */
export function createThreadManager(options: ThreadManagerOptions): ThreadManager {
  const {
    getThreads,
    getEditorView,
    getMode,
    getCurrentUserId,
    getScrollBehavior,
    announce,
    onthreadcreate,
    onthreaddelete,
    oncommentcreate,
    oncommentupdate,
    oncommentdelete,
    onBeforePopoverOpen,
  } = options;

  // Internal state
  let popoverThreadId = $state<ThreadId | null>(null);
  let popoverPosition = $state<PopoverPosition | null>(null);
  let activeThreadId = $state<ThreadId | null>(null);

  // Timer handle for panel selection scroll-then-position delay
  let selectTimeoutId: ReturnType<typeof setTimeout> | null = null;

  // Get the popover thread
  const popoverThread = $derived.by(() => {
    if (!popoverThreadId) return null;
    return getThreads().find((t) => t.id === popoverThreadId) ?? null;
  });

  // Clear popover if thread is deleted
  $effect(() => {
    if (popoverThreadId && !popoverThread) {
      popoverThreadId = null;
      popoverPosition = null;
    }
  });

  // Clear internal active thread if it no longer exists
  $effect(() => {
    if (activeThreadId && !getThreads().some((t) => t.id === activeThreadId)) {
      activeThreadId = null;
    }
  });

  // Deep linking: open popover when activeThreadId is set externally
  $effect(() => {
    let positionTimeoutId: ReturnType<typeof setTimeout> | null = null;

    if (activeThreadId && popoverThreadId !== activeThreadId) {
      const threads = getThreads();
      const thread = threads.find((t) => t.id === activeThreadId);
      if (thread) {
        const threadIdToOpen = activeThreadId;

        // First, scroll the anchor into view
        scrollAnchorIntoView(threadIdToOpen);

        // After scrolling, calculate position and open the popover
        positionTimeoutId = setTimeout(() => {
          const currentThread = getThreads().find((t) => t.id === threadIdToOpen);
          if (!currentThread) return;

          const pos = calculateViewportPosition(currentThread.anchor.from);
          if (pos) {
            popoverPosition = { x: pos.x + 16, y: pos.y };
            popoverThreadId = threadIdToOpen;
          }
        }, POSITION_DELAY_MS);
      }
    }

    return () => {
      if (positionTimeoutId !== null) {
        clearTimeout(positionTimeoutId);
      }
    };
  });

  /**
   * Calculate position for fixed-position popovers near an anchor.
   */
  function calculateViewportPosition(from: number): PopoverPosition | null {
    const view = getEditorView();
    if (!view) return null;

    try {
      const coords = view.coordsAtPos(from);
      if (coords) {
        return {
          x: Math.max(16, coords.left),
          y: coords.top + 24,
        };
      }
    } catch {
      // Position may be invalid
    }
    return null;
  }

  /**
   * Scroll the editor to bring an anchor position into view.
   */
  function scrollAnchorIntoView(threadId: ThreadId): void {
    const editorDom = getEditorView()?.dom;
    const anchorElement = editorDom?.querySelector(`[data-thread-id="${threadId}"]`);
    if (anchorElement) {
      anchorElement.scrollIntoView({ behavior: getScrollBehavior(), block: 'center' });
    }
  }

  /**
   * Scroll to a specific thread's anchor position.
   */
  function scrollToThread(threadId: ThreadId): void {
    const thread = getThreads().find((t) => t.id === threadId);
    if (!thread) return;

    const view = getEditorView();
    if (view && thread.anchor.from !== undefined) {
      const coords = view.coordsAtPos(thread.anchor.from);
      if (coords) {
        view.dom.scrollTo({
          top: coords.top - 100,
          behavior: getScrollBehavior(),
        });
      }
    }
  }

  /**
   * Open the popover for a thread.
   */
  function openPopover(threadId: ThreadId, position: PopoverPosition): void {
    popoverThreadId = threadId;
    popoverPosition = position;
    activeThreadId = threadId;
  }

  /**
   * Close the popover.
   */
  function closePopover(): void {
    if (selectTimeoutId !== null) {
      clearTimeout(selectTimeoutId);
      selectTimeoutId = null;
    }
    popoverThreadId = null;
    popoverPosition = null;
    activeThreadId = null;
  }

  /**
   * Handle click on an anchor decoration.
   */
  function handleAnchorClick(threadId: ThreadId, event: MouseEvent): void {
    if (selectTimeoutId !== null) {
      clearTimeout(selectTimeoutId);
      selectTimeoutId = null;
    }

    // Clear selection popover before opening thread popover
    // (prevents stale selection popover from reappearing after thread popover closes)
    onBeforePopoverOpen?.();

    activeThreadId = threadId;

    const thread = getThreads().find((t) => t.id === threadId);
    if (thread) {
      popoverPosition = { x: event.clientX + 16, y: event.clientY };
      popoverThreadId = threadId;
    }
  }

  /**
   * Handle thread selection from the comment sidebar.
   */
  function handleSidebarThreadSelect(threadId: ThreadId): void {
    const thread = getThreads().find((t) => t.id === threadId);
    if (!thread) return;

    // Clear selection popover before opening thread popover
    onBeforePopoverOpen?.();

    activeThreadId = threadId;
    scrollToThread(threadId);

    selectTimeoutId = setTimeout(() => {
      selectTimeoutId = null;
      const view = getEditorView();
      if (view && thread.anchor.from !== undefined) {
        const coords = view.coordsAtPos(thread.anchor.from);
        if (coords) {
          popoverPosition = { x: coords.left + 16, y: coords.top };
          popoverThreadId = threadId;
        }
      }
    }, POSITION_DELAY_MS);
  }

  // Thread CRUD

  function createThread(
    body: string,
    authorId: string,
    selection: { from: number; to: number } | null,
  ): string | null {
    if (!selection || selection.from === selection.to) {
      devWarn('Cannot create thread: no text selected');
      return null;
    }

    if (getMode() === 'readonly') {
      devWarn('Cannot create thread: editor is readonly');
      return null;
    }

    const view = getEditorView();
    if (!view) {
      devWarn('Cannot create thread: editor view not available');
      return null;
    }

    const { from, to } = selection;
    const anchor = buildAnchorFromSelection(view, from, to);
    const mentions = extractMentions(body);
    const requestId = generateId();

    const event: ThreadCreateEvent = {
      requestId,
      anchor,
      body,
      authorId,
      mentions: mentions.length > 0 ? mentions : undefined,
    };
    onthreadcreate?.(event);

    announce('Comment added');
    return requestId;
  }

  function createDocumentThread(body: string, authorId: string): string | null {
    if (getMode() === 'readonly') {
      devWarn('Cannot create thread: editor is readonly');
      return null;
    }

    const anchor = createDocumentAnchor();
    const mentions = extractMentions(body);
    const requestId = generateId();

    const event: ThreadCreateEvent = {
      requestId,
      anchor,
      body,
      authorId,
      mentions: mentions.length > 0 ? mentions : undefined,
    };
    onthreadcreate?.(event);

    announce('Document comment added');
    return requestId;
  }

  function createBlockThread(body: string, authorId: string): string | null {
    if (getMode() === 'readonly') {
      devWarn('Cannot create block thread: editor is readonly');
      return null;
    }

    const view = getEditorView();
    if (!view) {
      devWarn('Cannot create block thread: editor view not available');
      return null;
    }

    const { from } = view.state.selection;
    const resolvedPos = view.state.doc.resolve(from);

    for (let depth = resolvedPos.depth; depth > 0; depth--) {
      const node = resolvedPos.node(depth);
      if (!node.isBlock) continue;

      const blockFrom = resolvedPos.start(depth);
      const blockTo = resolvedPos.end(depth);
      const anchor = buildAnchorFromSelection(view, blockFrom, blockTo);
      const mentions = extractMentions(body);
      const requestId = generateId();

      onthreadcreate?.({
        requestId,
        anchor,
        body,
        authorId,
        mentions: mentions.length > 0 ? mentions : undefined,
      });

      return requestId;
    }

    devWarn('Cannot create block thread: cursor not inside a block');
    return null;
  }

  function deleteThread(threadId: ThreadId): void {
    if (getMode() === 'readonly') return;

    const thread = getThreads().find((t) => t.id === threadId);
    if (!thread) return;

    onthreaddelete?.({ threadId });
  }

  function clearAllThreads(): void {
    if (getMode() === 'readonly') return;

    const threads = getThreads();
    if (threads.length === 0) return;

    for (const thread of threads) {
      onthreaddelete?.({ threadId: thread.id });
    }

    popoverThreadId = null;
    popoverPosition = null;
    activeThreadId = null;

    announce('All comments cleared');
  }

  // Comment CRUD

  function createComment(threadId: ThreadId, body: string, authorId: string): string | null {
    if (getMode() === 'readonly') return null;

    const thread = getThreads().find((t) => t.id === threadId);
    if (!thread) return null;

    const mentions = extractMentions(body);
    const requestId = generateId();

    oncommentcreate?.({
      requestId,
      threadId,
      body,
      authorId,
      mentions: mentions.length > 0 ? mentions : undefined,
    });

    announce('Comment added');
    return requestId;
  }

  function updateComment(threadId: ThreadId, commentId: string, body: string): void {
    if (getMode() === 'readonly') return;

    const thread = getThreads().find((t) => t.id === threadId);
    const comment = thread?.comments.find((c) => c.id === commentId);
    if (!comment || comment.deletedAt) return;

    const mentions = extractMentions(body);

    oncommentupdate?.({
      threadId,
      commentId,
      body,
      mentions: mentions.length > 0 ? mentions : undefined,
    });
  }

  function deleteComment(threadId: ThreadId, commentId: string, soft: boolean = true): void {
    if (getMode() === 'readonly') return;

    const thread = getThreads().find((t) => t.id === threadId);
    const comment = thread?.comments.find((c) => c.id === commentId);
    if (!comment || (soft && comment.deletedAt)) return;

    oncommentdelete?.({ threadId, commentId, soft });
    announce('Comment deleted');
  }

  // Popover handlers

  function handlePopoverClose(): void {
    closePopover();
  }

  function handlePopoverDelete(threadId: ThreadId): void {
    const currentUserId = getCurrentUserId();
    if (currentUserId) {
      deleteThread(threadId);
      closePopover();
    }
  }

  function handlePopoverCommentCreate(threadId: ThreadId, body: string): void {
    const currentUserId = getCurrentUserId();
    if (currentUserId) {
      createComment(threadId, body, currentUserId);
    }
  }

  function handlePopoverCommentUpdate(threadId: ThreadId, commentId: string, body: string): void {
    updateComment(threadId, commentId, body);
  }

  function handlePopoverCommentDelete(threadId: ThreadId, commentId: string): void {
    deleteComment(threadId, commentId);
  }

  function destroy(): void {
    if (selectTimeoutId !== null) {
      clearTimeout(selectTimeoutId);
      selectTimeoutId = null;
    }
  }

  return {
    // Popover state
    get popoverThreadId() {
      return popoverThreadId;
    },
    get popoverPosition() {
      return popoverPosition;
    },
    get popoverThread() {
      return popoverThread;
    },
    get activeThreadId() {
      return activeThreadId;
    },

    // Popover actions
    openPopover,
    closePopover,
    handleAnchorClick,
    handleSidebarThreadSelect,

    // Thread CRUD
    createThread,
    createDocumentThread,
    createBlockThread,
    deleteThread,
    clearAllThreads,

    // Comment CRUD
    createComment,
    updateComment,
    deleteComment,

    // Popover handlers
    handlePopoverClose,
    handlePopoverDelete,
    handlePopoverCommentCreate,
    handlePopoverCommentUpdate,
    handlePopoverCommentDelete,

    // Utilities
    scrollAnchorIntoView,
    scrollToThread,
    calculateViewportPosition,

    // Cleanup
    destroy,
  };
}
