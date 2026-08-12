/**
 * Anchor management for ReviewEditor (DEP-422).
 *
 * Handles:
 * - Anchor plugin creation and configuration
 * - Thread-to-plugin synchronization
 * - Re-anchoring for setState flow
 * - Fingerprinting to prevent sync thrashing
 *
 * **Note:** This module is experimental and provides an alternative implementation
 * to the inline anchor management in `review-editor.svelte`. It is exported for
 * testing and potential future refactoring, but the component does not currently
 * delegate to this factory.
 *
 * **Known divergence — front matter.** Unlike the inline implementation, this
 * manager does not parse YAML front matter: it compares `getMarkdown()` against
 * the raw `pendingState.content` and writes body-relative positions, where the
 * inline version threads `parseReviewEditorFrontMatter`'s `bodyOffset` through
 * both the comparison and the computed `from`/`to`/`lastKnownOffset`. Anchors
 * restored through this manager are therefore off by the front matter's length
 * on any document that has some. Pre-existing, and the reason to finish or
 * delete this factory rather than adopt it as-is.
 *
 * @module
 * @experimental
 */

import { contentEquals } from '@lostgradient/markdown/pipeline';
import type { MilkdownPlugin } from '@milkdown/kit/ctx';
import type { EditorView } from '@milkdown/kit/prose/view';
import { anchorPluginKey, createAnchorPlugin } from '../../anchor-decorations.ts';
import type { AnchorUpdate, PersistedThread, ReviewState, Thread } from '../../comments/index.ts';
import { ANCHOR_CONTEXT_LENGTH, isDocumentAnchor, reanchorQuote } from '../../comments/index.ts';
import { textOffsetToProseMirrorPosition } from '../../editor/index.ts';

/**
 * Options for creating the anchor manager.
 */
export interface AnchorManagerOptions {
  /** Get the current threads */
  getThreads: () => Thread[];
  /** Set the threads (for updating after re-anchoring) */
  setThreads: (threads: Thread[]) => void;
  /** Get the editor view */
  getEditorView: () => EditorView | undefined;
  /** Get current markdown from editor */
  getMarkdown: () => string;
  /** Get the current value (for content comparison) */
  getValue: () => string;
  /** Event callback for anchor click */
  onAnchorClick: (threadId: string, event: MouseEvent) => void;
  // NOTE: there is deliberately no `onthreaddelete` here. It existed to report
  // the thread this manager deleted when re-anchoring failed; re-anchoring now
  // orphans instead of deleting (cinder#1284), so the callback would never fire.
  // Keeping it would be worse than removing it — a consumer wiring cleanup to an
  // event that never arrives has no way to notice.
}

/**
 * Anchor manager interface.
 */
export interface AnchorManager {
  /** The anchor plugin for Milkdown */
  readonly plugin: MilkdownPlugin;

  /** Pending state for deferred re-anchoring */
  readonly pendingState: ReviewState | null;

  /** Set pending state for re-anchoring */
  setPendingState(state: ReviewState | null): void;

  /** Attempt re-anchoring for pending state */
  attemptReanchoring(): void;

  /** Sync threads to the anchor plugin */
  syncThreadsToPlugin(threads: Thread[]): void;

  /** Create sync fingerprint for comparison */
  createSyncFingerprint(threads: Thread[]): string;

  /** Handle anchor position updates from the plugin */
  handleAnchorsUpdate(updates: AnchorUpdate[]): void;
}

/**
 * Create fingerprint including all mutable anchor fields.
 * This prevents sync thrashing when quote/prefix/suffix change.
 *
 * `status` is part of it: an update that flips a thread between anchored and
 * orphaned without moving it leaves every other field identical, so omitting
 * status makes the sync a no-op and the plugin keeps rendering the stale state.
 */
function createSyncFingerprint(threads: Thread[]): string {
  return threads
    .map((thread) => {
      const anchor = thread.anchor;
      return `${thread.id}:${anchor.from}:${anchor.to}:${anchor.status}:${anchor.quote}:${anchor.prefix}:${anchor.suffix}:${anchor.lastKnownOffset ?? ''}`;
    })
    .join('|');
}

/**
 * Create an anchor manager.
 *
 * @example
 * ```svelte
 * <script>
 *   import { createAnchorManager } from './review-editor-anchors.svelte';
 *
 *   const anchorManager = createAnchorManager({
 *     getThreads: () => threads,
 *     setThreads: (t) => (threads = t),
 *     getEditorView: () => editorRef?.getView(),
 *     getMarkdown: () => editorRef?.getMarkdown() ?? value,
 *     getValue: () => value,
 *     onAnchorClick: threadManager.handleAnchorClick,
 *   });
 *
 *   // Use plugin in MarkdownEditor
 *   // <MarkdownEditor plugins={[anchorManager.plugin]} />
 *
 *   // Sync threads when they change
 *   $effect(() => {
 *     if (editorRef?.getView() && !anchorManager.pendingState) {
 *       anchorManager.syncThreadsToPlugin(threads);
 *     }
 *   });
 * </script>
 * ```
 */
export function createAnchorManager(options: AnchorManagerOptions): AnchorManager {
  const { getThreads, setThreads, getEditorView, getMarkdown, getValue, onAnchorClick } = options;

  // Non-reactive bookkeeping (not state - doesn't need reactivity)
  let lastSyncedFingerprint: string | null = null;

  // Pending state for deferred re-anchoring
  let pendingState = $state<ReviewState | null>(null);

  /**
   * Handle anchor position updates from the plugin.
   */
  function handleAnchorsUpdate(updates: AnchorUpdate[]): void {
    const threads = getThreads();
    const updatedThreads = threads.map((thread) => {
      const update = updates.find((u) => u.threadId === thread.id);
      if (update) {
        return {
          ...thread,
          anchor: {
            ...thread.anchor,
            from: update.from,
            to: update.to,
            quote: update.quote,
            prefix: update.prefix,
            suffix: update.suffix,
            lastKnownOffset: update.lastKnownOffset,
          },
        };
      }
      return thread;
    });

    setThreads(updatedThreads);

    // Update fingerprint to skip re-sync
    lastSyncedFingerprint = createSyncFingerprint(updatedThreads);
  }

  // Create anchor plugin in instance scope
  const plugin = createAnchorPlugin({
    onAnchorsUpdate: handleAnchorsUpdate,
    onAnchorClick,
  });

  /**
   * Sync threads to the anchor plugin via meta-transaction.
   */
  function syncThreadsToPlugin(threads: Thread[]): void {
    const view = getEditorView();
    if (!view) return;

    const fingerprint = createSyncFingerprint(threads);

    // Skip if already synced
    if (fingerprint === lastSyncedFingerprint) return;
    lastSyncedFingerprint = fingerprint;

    view.dispatch(
      view.state.tr.setMeta(anchorPluginKey, {
        type: 'sync',
        threads,
        source: 'external',
      }),
    );
  }

  /**
   * Attempt re-anchoring for pending state.
   *
   * Threads whose anchor text cannot be found are KEPT and marked `orphaned`,
   * matching {@link CommentAnchor.status} and the inline ReviewEditor path.
   * Deletion and cut-and-paste are indistinguishable at the moment text goes
   * missing, so removing a thread here destroyed comments during ordinary edits
   * with no undo (cinder#1284). Removal is now the consumer's decision.
   */
  function attemptReanchoring(): void {
    if (!pendingState) return;

    const view = getEditorView();
    if (!view) return;

    // Compare markdown using contentEquals (handles normalization)
    const currentMarkdown = getMarkdown();
    const expectedMarkdown = pendingState.content;

    if (!contentEquals(currentMarkdown, expectedMarkdown)) {
      // Content not synced yet - will retry when editor updates
      return;
    }

    const state = pendingState;
    pendingState = null;

    const { doc } = view.state;
    const documentText = doc.textBetween(0, doc.content.size, '\n');

    // Re-anchor threads. Every thread survives the pass: one that cannot be
    // placed comes out `orphaned` rather than dropped.
    const reanchoredThreads: Thread[] = [];

    /** Keep a thread that has nowhere to point, so its text can bring it back. */
    function orphan(thread: PersistedThread): void {
      reanchoredThreads.push({
        ...thread,
        // Collapsed: an orphaned anchor has nowhere to point until its quote
        // returns, and `from >= to` is what the decoration pass skips on, so it
        // renders nothing even before the status is consulted.
        anchor: { ...thread.anchor, from: 0, to: 0, status: 'orphaned' },
      });
    }

    for (const persistedThread of state.threads) {
      // Document-level anchors have no quote to search for, so `reanchorQuote`
      // would always report "not found" and orphan a thread that is not
      // actually lost. They have no position to restore either — they stay at
      // 0/0, anchored. Matches `review-editor-impl.svelte`.
      if (isDocumentAnchor(persistedThread.anchor)) {
        reanchoredThreads.push({
          ...persistedThread,
          anchor: { ...persistedThread.anchor, from: 0, to: 0 },
        });
        continue;
      }

      const result = reanchorQuote(documentText, persistedThread.anchor);

      // Quote not in this document. KEEP the thread, orphaned (cinder#1284):
      // restoring a saved review against a document whose text has since
      // changed must not silently destroy comments. It renders no decoration,
      // shows in the sidebar as missing its text, and re-anchors if the text
      // returns. Removal is the consumer's decision, so `onthreaddelete` does
      // not fire here.
      if (!result.found) {
        orphan(persistedThread);
        continue;
      }

      const from = textOffsetToProseMirrorPosition(doc, result.from);
      const to = textOffsetToProseMirrorPosition(doc, result.to);

      if (from === null || to === null) {
        // The quote was located in the text but its offsets do not map back to
        // positions. Previously the thread fell out of the loop unpushed and
        // vanished with no event at all — quieter than the delete branch, and
        // just as lossy.
        orphan(persistedThread);
      } else {
        // Extract the matched quote and context from the current document
        const matchedQuote = documentText.slice(result.from, result.to);
        const newPrefix = documentText.slice(
          Math.max(0, result.from - ANCHOR_CONTEXT_LENGTH),
          result.from,
        );
        const newSuffix = documentText.slice(
          result.to,
          Math.min(documentText.length, result.to + ANCHOR_CONTEXT_LENGTH),
        );

        reanchoredThreads.push({
          ...persistedThread,
          anchor: {
            ...persistedThread.anchor,
            from,
            to,
            quote: matchedQuote,
            prefix: newPrefix,
            suffix: newSuffix,
            status: 'anchored',
            lastKnownOffset: result.from,
          },
        });
      }
    }

    setThreads(reanchoredThreads);

    // Sync threads to plugin
    syncThreadsToPlugin(reanchoredThreads);
  }

  // Retry re-anchoring when editor content changes (handles async content sync)
  $effect(() => {
    void getValue(); // Create dependency on value
    if (pendingState && getEditorView()) {
      attemptReanchoring();
    }
  });

  return {
    get plugin() {
      return plugin;
    },

    get pendingState() {
      return pendingState;
    },

    setPendingState(state: ReviewState | null) {
      pendingState = state;
    },

    attemptReanchoring,
    syncThreadsToPlugin,
    createSyncFingerprint,
    handleAnchorsUpdate,
  };
}

// The persistence converters live in `comments/types.ts` alongside the anchor
// constructors so both directions of the round trip sit in one pure module.
// Re-exported here to keep the published `@lostgradient/editor/review-editor`
// surface unchanged.
export { toPersistedThreads, toRuntimeThreads } from '../../comments/index.ts';
