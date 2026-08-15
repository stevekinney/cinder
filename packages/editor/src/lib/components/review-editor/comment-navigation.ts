/**
 * cinder#1304 — pure ordering/index logic for ReviewEditor's keyboard
 * "next/previous comment" navigation, split out from review-editor-impl.svelte
 * so it is testable without mounting the full component (which pulls in
 * ReviewEditorControls' formatting toolbar — heavier UI unrelated to this
 * logic). The DOM-touching half (moving the ProseMirror selection, opening
 * the popover) stays in the component; this module only decides WHICH
 * thread is next.
 */

import { getVisibleComments, isDocumentAnchor } from '../../comments/index.ts';
import type { Thread } from '../../comments/types.ts';

/**
 * Text-anchored, non-orphaned threads in document order — the set that
 * actually has a `.comment-anchor` decoration to navigate between.
 * Document-level threads have no position (reachable from the sidebar's own
 * "Document comment" entry instead), and an orphaned thread's quote is not
 * in the document, so there is nothing there to land the caret on. Also
 * drops any thread whose comments are all soft-deleted, via the same
 * `getVisibleComments(thread).length > 0` check CommentSidebar's own
 * `textThreads` derivation uses (comment-sidebar.svelte) — without it, a
 * thread that never appears in the sidebar could still be reached by
 * keyboard, opening a popover with an inflated "Comment N of M" count and no
 * visible content. Mirrors CommentSidebar's ordering exactly so keyboard
 * order matches the order comments already appear in visually.
 */
export function orderedTextThreads(threads: Thread[]): Thread[] {
  return threads
    .filter(
      (thread) =>
        !isDocumentAnchor(thread.anchor) &&
        thread.anchor.status !== 'orphaned' &&
        getVisibleComments(thread).length > 0,
    )
    .sort((a, b) => (a.anchor.from ?? 0) - (b.anchor.from ?? 0));
}

/**
 * The thread `direction` (1 = next, -1 = previous) lands on, given the
 * currently active thread id. Wraps at either end rather than stopping, so a
 * user does not have to know how many comments exist or which end they
 * started from. Returns `null` when there is nothing to navigate to.
 */
export function nextCommentThread(
  threads: Thread[],
  activeThreadId: string | null,
  direction: 1 | -1,
): Thread | null {
  const ordered = orderedTextThreads(threads);
  if (ordered.length === 0) return null;

  const currentIndex = activeThreadId ? ordered.findIndex((t) => t.id === activeThreadId) : -1;
  const nextIndex =
    currentIndex === -1
      ? direction === 1
        ? 0
        : ordered.length - 1
      : (currentIndex + direction + ordered.length) % ordered.length;

  return ordered[nextIndex] ?? null;
}
