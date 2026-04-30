/**
 * ProseMirror plugin for comment anchor tracking.
 *
 * This plugin:
 * - Tracks anchor positions through document edits via tr.mapping.map()
 * - Detects when anchors need re-anchoring (quote drift)
 * - Provides decorations for visual anchor highlights
 * - Auto-deletes threads when their anchor text is removed
 *
 * @module
 */

import type { EditorState, Transaction } from '@milkdown/kit/prose/state';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';
import { $prose } from '@milkdown/kit/utils';

import { proseMirrorPositionToTextOffset, textOffsetToProseMirrorPosition } from '@cinder/editor';
import type { Node as ProseMirrorNode } from '@milkdown/kit/prose/model';
import { reanchorQuote } from './comments/reanchor.js';
import type { AnchorUpdate, Thread } from './comments/types.js';

// ============================================================================
// Plugin State Types
// ============================================================================

/**
 * State for a single anchor tracked by the plugin.
 */
export interface AnchorState {
  /** Thread ID this anchor belongs to */
  threadId: string;
  /** ProseMirror start position */
  from: number;
  /** ProseMirror end position */
  to: number;
  /** Current quote text at this position */
  quote: string;
  /** Original quote text (never updated) */
  originalQuote: string;
  /** Context before the quote */
  prefix: string;
  /** Context after the quote */
  suffix: string;
  /** Original position from creation */
  originalPosition?: { offset: number; line: number; column: number } | undefined;
  /** Last known text offset (updated on each edit) */
  lastKnownOffset?: number | undefined;
}

/**
 * Plugin state containing all tracked anchors.
 */
export interface AnchorPluginState {
  /** Map of thread ID to anchor state */
  anchors: Map<string, AnchorState>;
  /** Flag indicating deferred re-anchoring is needed */
  needsReanchor: boolean;
  /** Thread ID currently focused in the UI */
  activeThreadId: string | null;
  /** Thread ID currently hovered in the UI */
  hoveredThreadId: string | null;
}

/**
 * Options for creating the anchor plugin.
 */
export interface AnchorPluginOptions {
  /** Called when anchor positions change */
  onAnchorsUpdate?: (updates: AnchorUpdate[]) => void;
  /** Called when an anchor's text is deleted and the thread should be removed */
  onAnchorDeleted?: (threadId: string) => void;
  /** Called when user clicks on an anchor decoration */
  onAnchorClick?: (threadId: string, event: MouseEvent) => void;
}

/**
 * Meta-transaction types for plugin communication.
 *
 * Note: confirm/reject are handled by ReviewEditor mutating threads + sync,
 * so we only need sync, add, and remove here.
 */
type AnchorPluginMeta =
  | { type: 'sync'; threads: Thread[]; source: 'external' }
  | { type: 'add'; thread: Thread }
  | { type: 'remove'; threadId: string }
  | { type: 'set-active'; threadId: string | null }
  | { type: 'set-hover'; threadId: string | null };

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAnchorPluginMeta(value: unknown): value is AnchorPluginMeta {
  if (!isObjectRecord(value)) return false;

  switch (value['type']) {
    case 'sync':
      return Array.isArray(value['threads']) && value['source'] === 'external';
    case 'add':
      return isObjectRecord(value['thread']);
    case 'remove':
      return typeof value['threadId'] === 'string';
    case 'set-active':
    case 'set-hover':
      return typeof value['threadId'] === 'string' || value['threadId'] === null;
    default:
      return false;
  }
}

// ============================================================================
// Plugin Key
// ============================================================================

export const anchorPluginKey = new PluginKey<AnchorPluginState>('anchor');

// ============================================================================
// Transaction Handling
// ============================================================================

/**
 * Check if a transaction affected an anchor's range (inclusive of boundaries).
 */
function didTransactionAffectAnchorRange(tr: Transaction, from: number, to: number): boolean {
  for (const step of tr.steps) {
    const stepMap = step.getMap();
    let affected = false;

    stepMap.forEach((oldStart, oldEnd) => {
      // Include boundaries: use <= and >= for inclusive check
      const overlaps = oldStart <= to && oldEnd >= from;
      if (overlaps) affected = true;
    });

    if (affected) return true;
  }
  return false;
}

/**
 * Handle meta-transactions (add/remove/sync anchors).
 */
function handleMetaTransaction(
  meta: AnchorPluginMeta,
  prevState: AnchorPluginState,
): AnchorPluginState {
  switch (meta.type) {
    case 'sync': {
      // Sync external thread state into plugin
      const newAnchors = new Map<string, AnchorState>();
      for (const thread of meta.threads) {
        const anchor = thread.anchor;
        newAnchors.set(thread.id, {
          threadId: thread.id,
          from: anchor.from,
          to: anchor.to,
          quote: anchor.quote,
          originalQuote: anchor.originalQuote ?? anchor.quote,
          prefix: anchor.prefix,
          suffix: anchor.suffix,
          originalPosition: anchor.originalPosition,
          lastKnownOffset: anchor.lastKnownOffset,
        });
      }
      return {
        anchors: newAnchors,
        needsReanchor: false,
        activeThreadId: prevState.activeThreadId,
        hoveredThreadId: prevState.hoveredThreadId,
      };
    }

    case 'add': {
      const newAnchors = new Map(prevState.anchors);
      const anchor = meta.thread.anchor;
      newAnchors.set(meta.thread.id, {
        threadId: meta.thread.id,
        from: anchor.from,
        to: anchor.to,
        quote: anchor.quote,
        originalQuote: anchor.originalQuote ?? anchor.quote,
        prefix: anchor.prefix,
        suffix: anchor.suffix,
        originalPosition: anchor.originalPosition,
        lastKnownOffset: anchor.lastKnownOffset,
      });
      return { ...prevState, anchors: newAnchors };
    }

    case 'remove': {
      const newAnchors = new Map(prevState.anchors);
      newAnchors.delete(meta.threadId);
      return { ...prevState, anchors: newAnchors };
    }

    case 'set-active': {
      return { ...prevState, activeThreadId: meta.threadId };
    }

    case 'set-hover': {
      return { ...prevState, hoveredThreadId: meta.threadId };
    }
  }
}

/**
 * Map anchor positions through a transaction.
 */
function mapAnchorsThroughTransaction(
  tr: Transaction,
  prevState: AnchorPluginState,
  newState: EditorState,
): AnchorPluginState {
  const newAnchors = new Map<string, AnchorState>();
  let needsReanchor = false;

  for (const [threadId, anchor] of prevState.anchors) {
    // Map positions through the transaction
    const mappedFrom = tr.mapping.map(anchor.from, -1);
    const mappedTo = tr.mapping.map(anchor.to, 1);

    // Check if range collapsed (anchor deleted or cut)
    // Instead of immediately orphaning, defer to re-anchoring.
    // This supports cut/paste and move operations where the text
    // may reappear elsewhere in the document.
    if (mappedFrom >= mappedTo) {
      needsReanchor = true;
      // Update lastKnownOffset so re-anchoring doesn't bias toward stale position
      const collapsedOffset = proseMirrorPositionToTextOffset(newState.doc, mappedFrom);
      newAnchors.set(threadId, {
        ...anchor,
        from: mappedFrom,
        to: mappedFrom,
        lastKnownOffset: collapsedOffset,
        // Keep current status until re-anchor determines fate
      });
      continue;
    }

    // Get current quote at mapped position
    const currentQuote = newState.doc.textBetween(mappedFrom, mappedTo, '\n');

    // Check if quote drifted (text at position doesn't match stored quote)
    // This can happen from cut/paste, undo/redo, or collaborative edits
    const quoteDrifted = currentQuote !== anchor.quote;

    // Check if edit affected this anchor's range
    if (didTransactionAffectAnchorRange(tr, anchor.from, anchor.to)) {
      // Update quote/prefix/suffix to follow the edit
      const newPrefix = newState.doc.textBetween(Math.max(0, mappedFrom - 50), mappedFrom, '\n');
      const newSuffix = newState.doc.textBetween(
        mappedTo,
        Math.min(newState.doc.content.size, mappedTo + 50),
        '\n',
      );

      // Update lastKnownOffset for disambiguation
      const newLastKnownOffset = proseMirrorPositionToTextOffset(newState.doc, mappedFrom);

      newAnchors.set(threadId, {
        ...anchor,
        from: mappedFrom,
        to: mappedTo,
        quote: currentQuote,
        prefix: newPrefix,
        suffix: newSuffix,
        lastKnownOffset: newLastKnownOffset,
        // originalQuote stays unchanged
      });
    } else if (quoteDrifted) {
      // Edit was outside but quote drifted (cut/paste scenario)
      // Mark for deferred re-anchoring
      needsReanchor = true;
      const newLastKnownOffset = proseMirrorPositionToTextOffset(newState.doc, mappedFrom);
      newAnchors.set(threadId, {
        ...anchor,
        from: mappedFrom,
        to: mappedTo,
        lastKnownOffset: newLastKnownOffset,
        // Keep old quote/prefix/suffix - re-anchoring will find the new location
      });
    } else {
      // Edit was outside, quote still matches - just map positions
      const newLastKnownOffset = proseMirrorPositionToTextOffset(newState.doc, mappedFrom);
      newAnchors.set(threadId, {
        ...anchor,
        from: mappedFrom,
        to: mappedTo,
        lastKnownOffset: newLastKnownOffset,
      });
    }
  }

  return {
    anchors: newAnchors,
    needsReanchor,
    activeThreadId: prevState.activeThreadId,
    hoveredThreadId: prevState.hoveredThreadId,
  };
}

// ============================================================================
// Deferred Re-anchoring
// ============================================================================

/**
 * Perform deferred re-anchoring for anchors that drifted.
 *
 * When an anchor's text is deleted (found: false), the anchor is removed
 * and onAnchorDeleted is called so the parent can delete the thread.
 */
function performDeferredReanchoring(
  view: EditorView,
  pluginState: AnchorPluginState,
  options: AnchorPluginOptions,
): void {
  const { doc } = view.state;
  const documentText = doc.textBetween(0, doc.content.size, '\n');
  const updates: AnchorUpdate[] = [];
  const deletedThreadIds: string[] = [];

  const newAnchors = new Map<string, AnchorState>();

  for (const [threadId, anchor] of pluginState.anchors) {
    // Re-anchor if the quote at current position doesn't match
    const currentQuote = doc.textBetween(anchor.from, anchor.to, '\n');
    if (currentQuote === anchor.quote) {
      // Quote still matches, no re-anchoring needed
      newAnchors.set(threadId, anchor);
      continue;
    }

    // Perform re-anchoring
    const result = reanchorQuote(documentText, {
      quote: anchor.quote,
      prefix: anchor.prefix,
      suffix: anchor.suffix,
      originalPosition: anchor.originalPosition,
      lastKnownOffset: anchor.lastKnownOffset,
    });

    // If the text was deleted, mark for removal
    if (!result.found) {
      deletedThreadIds.push(threadId);
      continue;
    }

    // Convert text offsets back to PM positions
    // reanchorQuote returns text offsets, which we must convert
    const newFrom = textOffsetToProseMirrorPosition(doc, result.from) ?? anchor.from;
    const newTo = textOffsetToProseMirrorPosition(doc, result.to) ?? anchor.to;

    // Bounds check: clamp to valid doc range
    const docSize = doc.content.size;
    const clampedFrom = Math.max(0, Math.min(newFrom, docSize));
    const clampedTo = Math.max(clampedFrom, Math.min(newTo, docSize));

    const newQuote =
      clampedFrom < clampedTo ? doc.textBetween(clampedFrom, clampedTo, '\n') : anchor.quote;

    // Compute new prefix/suffix context from the document at the new position
    // This ensures subsequent re-anchors have fresh context data
    let newPrefix = anchor.prefix;
    let newSuffix = anchor.suffix;
    if (clampedFrom < clampedTo) {
      const prefixStart = Math.max(0, clampedFrom - 50);
      const suffixEnd = Math.min(docSize, clampedTo + 50);
      newPrefix = doc.textBetween(prefixStart, clampedFrom, '\n');
      newSuffix = doc.textBetween(clampedTo, suffixEnd, '\n');
    }

    const newAnchor: AnchorState = {
      ...anchor,
      from: clampedFrom,
      to: clampedTo,
      quote: newQuote,
      prefix: newPrefix,
      suffix: newSuffix,
      lastKnownOffset: result.from,
    };

    newAnchors.set(threadId, newAnchor);

    // Collect update
    updates.push({
      threadId,
      from: clampedFrom,
      to: clampedTo,
      quote: newQuote,
      prefix: newPrefix,
      suffix: newSuffix,
      status: 'anchored',
      lastKnownOffset: result.from,
    });
  }

  // Dispatch state update
  view.dispatch(
    view.state.tr.setMeta(anchorPluginKey, {
      type: 'sync',
      threads: Array.from(newAnchors.values()).map((a) => ({
        id: a.threadId,
        anchor: { ...a, status: 'anchored' as const },
        comments: [],
        createdAt: new Date().toISOString(),
      })),
      source: 'external' as const,
    }),
  );

  // Fire updates callback
  if (updates.length > 0) {
    options.onAnchorsUpdate?.(updates);
  }

  // Fire deleted callbacks - parent should delete these threads
  for (const threadId of deletedThreadIds) {
    options.onAnchorDeleted?.(threadId);
  }
}

// ============================================================================
// Decorations
// ============================================================================

/**
 * Compute decorations for all anchors.
 *
 * All anchors get a simple inline highlight. Active and hovered states
 * are indicated via additional CSS classes.
 */
function computeDecorations(state: EditorState): DecorationSet {
  const pluginState = anchorPluginKey.getState(state);
  if (!pluginState) return DecorationSet.empty;

  const decorations: Decoration[] = [];
  const docSize = state.doc.content.size;
  const activeThreadId = pluginState.activeThreadId;
  const hoveredThreadId = pluginState.hoveredThreadId;

  for (const [threadId, anchor] of pluginState.anchors) {
    // Bounds checking: clamp positions to valid doc range
    const from = Math.max(0, Math.min(anchor.from, docSize));
    const to = Math.max(from, Math.min(anchor.to, docSize));

    // Skip invalid ranges
    if (from >= to) continue;

    const isActive = activeThreadId === threadId;
    const activeClass = isActive ? ' comment-anchor--active' : '';
    const isHovered = hoveredThreadId === threadId;
    const hoveredClass = isHovered ? ' comment-anchor--hovered' : '';

    // Standard highlight for all anchors
    decorations.push(
      Decoration.inline(
        from,
        to,
        {
          class: `comment-anchor${activeClass}${hoveredClass}`,
          'data-thread-id': threadId,
        },
        { key: `anchor-${threadId}` },
      ),
    );
  }

  return DecorationSet.create(state.doc, decorations);
}

// ============================================================================
// Plugin Factory
// ============================================================================

/**
 * Create the anchor tracking plugin.
 *
 * IMPORTANT: This should be called once per ReviewEditor instance,
 * in the instance script (not module script) before the editor mounts.
 *
 * @param options - Plugin options with callbacks
 * @returns Milkdown plugin wrapper
 */
export function createAnchorPlugin(options: AnchorPluginOptions = {}) {
  let reanchorTimeout: ReturnType<typeof setTimeout> | null = null;

  function updateHoverState(view: EditorView, threadId: string | null): void {
    const pluginState = anchorPluginKey.getState(view.state);
    if (pluginState?.hoveredThreadId === threadId) return;

    view.dispatch(
      view.state.tr.setMeta(anchorPluginKey, {
        type: 'set-hover',
        threadId,
      }),
    );
  }

  return $prose(() => {
    return new Plugin({
      key: anchorPluginKey,

      state: {
        init: (): AnchorPluginState => ({
          anchors: new Map(),
          needsReanchor: false,
          activeThreadId: null,
          hoveredThreadId: null,
        }),

        apply: (tr, prevState, _, newState): AnchorPluginState => {
          // Handle meta-transactions first
          const meta = tr.getMeta(anchorPluginKey) as unknown;
          if (isAnchorPluginMeta(meta)) {
            return handleMetaTransaction(meta, prevState);
          }

          // No doc change = no position updates needed
          if (!tr.docChanged) return prevState;

          // Map positions and detect inside-range edits
          return mapAnchorsThroughTransaction(tr, prevState, newState);
        },
      },

      view: () => {
        // Track doc identity to detect stale re-anchor results
        // Using doc identity (doc.eq()) instead of size, because
        // same-length edits could apply an out-of-date re-anchor
        let scheduledDoc: ProseMirrorNode | null = null;

        return {
          update: (view) => {
            const pluginState = anchorPluginKey.getState(view.state);
            if (!pluginState?.needsReanchor) return;

            // Capture the doc at schedule time for identity check
            scheduledDoc = view.state.doc;

            // Debounce re-anchoring (300ms)
            if (reanchorTimeout) clearTimeout(reanchorTimeout);

            reanchorTimeout = setTimeout(() => {
              // Verify doc hasn't changed during debounce using identity check
              if (!scheduledDoc || !view.state.doc.eq(scheduledDoc)) {
                // Doc changed, skip this run - next update will reschedule
                return;
              }

              const currentPluginState = anchorPluginKey.getState(view.state);
              if (currentPluginState) {
                performDeferredReanchoring(view, currentPluginState, options);
              }
            }, 300);
          },

          destroy: () => {
            if (reanchorTimeout) clearTimeout(reanchorTimeout);
          },
        };
      },

      props: {
        decorations: computeDecorations,

        handleDOMEvents: {
          mouseover: (view, event) => {
            const target = event.target;
            if (!(target instanceof Element)) return false;

            const anchorElement = target.closest('[data-thread-id]');
            if (!anchorElement) {
              updateHoverState(view, null);
              return false;
            }

            const threadId = anchorElement.getAttribute('data-thread-id');
            if (threadId) {
              updateHoverState(view, threadId);
            }

            return false;
          },

          mouseout: (view, event) => {
            const target = event.target;
            if (!(target instanceof Element)) return false;

            const anchorElement = target.closest('[data-thread-id]');
            if (!anchorElement) return false;

            const threadId = anchorElement.getAttribute('data-thread-id');
            if (!threadId) return false;

            const relatedTarget = event.relatedTarget;
            if (relatedTarget instanceof Element) {
              const nextAnchor = relatedTarget.closest(`[data-thread-id="${threadId}"]`);
              if (nextAnchor) {
                return false;
              }
            }

            updateHoverState(view, null);
            return false;
          },

          mouseleave: (view) => {
            updateHoverState(view, null);
            return false;
          },

          // Handle clicks on anchor decorations to surface them to the parent component.
          // Always returns false to let ProseMirror handle selection and other default behavior.
          click: (_view, event) => {
            if (!options.onAnchorClick) return false;

            // Check if click target is within an anchor decoration.
            // Guard against non-Element targets (e.g., text nodes) which don't have .closest()
            const target = event.target;
            if (!(target instanceof Element)) return false;

            const anchorElement = target.closest('[data-thread-id]');

            if (anchorElement) {
              const threadId = anchorElement.getAttribute('data-thread-id');
              if (threadId) {
                options.onAnchorClick(threadId, event);
              }
            }

            // Always return false - we never want to prevent ProseMirror from handling the event
            return false;
          },
        },
      },
    });
  });
}
