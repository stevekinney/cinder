/**
 * Anchor management for ReviewEditor (DEP-422).
 *
 * Handles:
 * - Anchor plugin creation and configuration
 * - Thread-to-plugin synchronization
 * - Re-anchoring for setState flow
 * - Fingerprinting to prevent sync thrashing
 *
 * @module
 */

import { contentEquals } from '@lostgradient/markdown';
import type { MilkdownPlugin } from '@milkdown/kit/ctx';
import type { Node as ProseMirrorNode } from '@milkdown/kit/prose/model';
import type { EditorView } from '@milkdown/kit/prose/view';
import { anchorPluginKey } from '../../anchor-plugin-state.ts';
import { createAnchorPlugin } from '../../anchor-plugin.ts';
import type { AnchorUpdate, PersistedThread, ReviewState, Thread } from '../../comments/index.ts';
import { ANCHOR_CONTEXT_LENGTH, isDocumentAnchor, reanchorQuote } from '../../comments/index.ts';
import { textOffsetToProseMirrorPosition } from '../../editor/index.ts';
import {
  bodyAnchorUpdateToDocumentAnchorUpdate,
  documentAnchorToBodyAnchor,
  documentPersistedAnchorToBodyAnchor,
  parseReviewEditorFrontMatter,
} from './review-editor-front-matter.ts';

/**
 * Options for creating the anchor manager.
 */
export interface AnchorManagerOptions {
  /** Get the current threads */
  getThreads: () => Thread[];
  /** Set the threads (for updating after re-anchoring) */
  setThreads: (threads: Thread[]) => void;
  /** Get the editor view */
  getEditorView: () => AnchorEditorView | undefined;
  /** Get current markdown from editor */
  getMarkdown: () => string;
  /** Get the current value (for content comparison) */
  getValue: () => string;
  /** Event callback for anchor click */
  onAnchorClick: (threadId: string, event: MouseEvent) => void;
  /** Announce threads whose quoted text is no longer present. */
  onOrphanedThreads?: (updates: AnchorUpdate[]) => void;
  // NOTE: there is deliberately no `onThreadDelete` here. It existed to report
  // the thread this manager deleted when re-anchoring failed; re-anchoring now
  // orphans instead of deleting (cinder#1284), so the callback would never fire.
  // Keeping it would be worse than removing it — a consumer wiring cleanup to an
  // event that never arrives has no way to notice.
}

export type AnchorEditorView = Pick<EditorView, 'state' | 'dispatch'>;

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

/** Restore one persisted thread while retaining it when its position is invalid. */
export function reanchorPersistedThread(
  persistedThread: PersistedThread,
  documentText: string,
  bodyOffset: number,
  doc: ProseMirrorNode,
  positionMapper: typeof textOffsetToProseMirrorPosition = textOffsetToProseMirrorPosition,
): Thread {
  if (isDocumentAnchor(persistedThread.anchor)) {
    return { ...persistedThread, anchor: { ...persistedThread.anchor, from: 0, to: 0 } };
  }

  const bodyAnchor = documentPersistedAnchorToBodyAnchor(persistedThread.anchor, bodyOffset);
  const result = reanchorQuote(documentText, bodyAnchor);
  if (!result.found) {
    return {
      ...persistedThread,
      anchor: { ...persistedThread.anchor, from: 0, to: 0, status: 'orphaned' },
    };
  }

  const from = positionMapper(doc, result.from);
  const to = positionMapper(doc, result.to);
  if (from === null || to === null) {
    return {
      ...persistedThread,
      anchor: { ...persistedThread.anchor, from: 0, to: 0, status: 'orphaned' },
    };
  }

  const matchedQuote = documentText.slice(result.from, result.to);
  const prefix = documentText.slice(Math.max(0, result.from - ANCHOR_CONTEXT_LENGTH), result.from);
  const suffix = documentText.slice(
    result.to,
    Math.min(documentText.length, result.to + ANCHOR_CONTEXT_LENGTH),
  );
  return {
    ...persistedThread,
    anchor: {
      ...persistedThread.anchor,
      from: from + bodyOffset,
      to: to + bodyOffset,
      quote: matchedQuote,
      prefix,
      suffix,
      status: 'anchored',
      lastKnownOffset: result.from + bodyOffset,
    },
  };
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
  const {
    getThreads,
    setThreads,
    getEditorView,
    getMarkdown,
    getValue,
    onAnchorClick,
    onOrphanedThreads,
  } = options;

  // Non-reactive bookkeeping (not state - doesn't need reactivity)
  let lastSyncedFingerprint: string | null = null;
  let lastSyncedView: AnchorEditorView | undefined;

  // Pending state for deferred re-anchoring
  let pendingState = $state<ReviewState | null>(null);

  /**
   * Handle anchor position updates from the plugin.
   */
  function handleAnchorsUpdate(updates: AnchorUpdate[]): void {
    const threads = getThreads();
    const bodyOffset = parseReviewEditorFrontMatter(getValue()).bodyOffset;
    const updatedThreads = threads.map((thread) => {
      const update = updates.find((u) => u.threadId === thread.id);
      if (update) {
        const documentUpdate = bodyAnchorUpdateToDocumentAnchorUpdate(update, bodyOffset);
        return {
          ...thread,
          anchor: {
            ...thread.anchor,
            from: documentUpdate.from,
            to: documentUpdate.to,
            // Without this the manager drops the one field that says the anchor
            // stopped being placed: the plugin orphans it and stops decorating,
            // but consumers keep seeing `anchored` and cannot show or persist
            // the orphan. Adding `status` to the sync fingerprint does nothing
            // on its own — the value never gets applied to compare against.
            status: update.status,
            quote: documentUpdate.quote,
            prefix: documentUpdate.prefix,
            suffix: documentUpdate.suffix,
            lastKnownOffset: documentUpdate.lastKnownOffset,
          },
        };
      }
      return thread;
    });

    setThreads(updatedThreads);
    onOrphanedThreads?.(updates);

    // Update fingerprint to skip re-sync
    lastSyncedFingerprint = `${bodyOffset}|${createSyncFingerprint(updatedThreads)}`;
    lastSyncedView = getEditorView();
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

    const bodyOffset = parseReviewEditorFrontMatter(getValue()).bodyOffset;
    const fingerprint = `${bodyOffset}|${createSyncFingerprint(threads)}`;

    // A remounted editor has a new plugin state, even when thread data is unchanged.
    if (view === lastSyncedView && fingerprint === lastSyncedFingerprint) return;
    lastSyncedFingerprint = fingerprint;
    lastSyncedView = view;

    view.dispatch(
      view.state.tr.setMeta(anchorPluginKey, {
        type: 'sync',
        threads: threads.map((thread) => ({
          ...thread,
          anchor: documentAnchorToBodyAnchor(thread.anchor, bodyOffset),
        })),
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
    const currentDocument = parseReviewEditorFrontMatter(getMarkdown());
    const pendingDocument = parseReviewEditorFrontMatter(pendingState.content);
    const currentMarkdown = currentDocument.body;
    const expectedMarkdown = pendingDocument.body;

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
    const reanchoredThreads = state.threads.map((persistedThread) =>
      reanchorPersistedThread(persistedThread, documentText, pendingDocument.bodyOffset, doc),
    );

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
