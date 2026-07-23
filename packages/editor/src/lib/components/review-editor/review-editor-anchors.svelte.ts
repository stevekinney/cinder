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
 * @module
 * @experimental
 */

import { contentEquals } from '@lostgradient/markdown/pipeline';
import type { MilkdownPlugin } from '@milkdown/kit/ctx';
import type { EditorView } from '@milkdown/kit/prose/view';
import { anchorPluginKey, createAnchorPlugin } from '../../anchor-decorations.ts';
import type {
  AnchorUpdate,
  PersistedThread,
  ReviewState,
  Thread,
  ThreadDeleteEvent,
} from '../../comments/index.ts';
import { ANCHOR_CONTEXT_LENGTH, reanchorQuote } from '../../comments/index.ts';
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
  /** Event callback for thread delete (when re-anchoring fails) */
  onthreaddelete?: (event: ThreadDeleteEvent) => void;
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
 */
function createSyncFingerprint(threads: Thread[]): string {
  return threads
    .map((thread) => {
      const anchor = thread.anchor;
      return `${thread.id}:${anchor.from}:${anchor.to}:${anchor.quote}:${anchor.prefix}:${anchor.suffix}:${anchor.lastKnownOffset ?? ''}`;
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
 *     onthreaddelete,
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
    onthreaddelete,
  } = options;

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
   * Threads whose anchor text cannot be found are removed (auto-delete behavior).
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

    // Re-anchor threads, filtering out those that can't be found
    const reanchoredThreads: Thread[] = [];

    for (const persistedThread of state.threads) {
      const result = reanchorQuote(documentText, persistedThread.anchor);

      // If anchor text not found, skip this thread (auto-delete)
      if (!result.found) {
        onthreaddelete?.({ threadId: persistedThread.id });
        continue;
      }

      const from = textOffsetToProseMirrorPosition(doc, result.from);
      const to = textOffsetToProseMirrorPosition(doc, result.to);

      if (from !== null && to !== null) {
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

/**
 * Convert threads to persisted format for serialization.
 *
 * @param threads - Live threads with position info
 * @returns Persisted threads suitable for storage
 */
export function toPersistedThreads(threads: Thread[]): PersistedThread[] {
  return threads.map((thread) => ({
    ...thread,
    anchor: {
      quote: thread.anchor.quote,
      prefix: thread.anchor.prefix,
      suffix: thread.anchor.suffix,
      status: thread.anchor.status,
      blockId: thread.anchor.blockId,
      originalPosition: thread.anchor.originalPosition,
      originalQuote: thread.anchor.originalQuote,
      lastKnownOffset: thread.anchor.lastKnownOffset,
    },
  }));
}
