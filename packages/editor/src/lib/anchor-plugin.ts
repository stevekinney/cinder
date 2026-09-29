/**
 * ProseMirror plugin factory for comment anchor tracking.
 *
 * @module
 *
 * SSR safety: the `@milkdown/kit/prose/*` value imports resolve to SSR-safe
 * ProseMirror modules. The consuming Svelte editor remains the browser mount
 * boundary.
 */

import type { Node as ProseMirrorNode } from '@milkdown/kit/prose/model';
import { Plugin } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { $prose } from '@milkdown/kit/utils';
import { computeDecorations } from './anchor-decorations.js';
import {
  anchorPluginKey,
  handleMetaTransaction,
  mapAnchorsThroughTransaction,
} from './anchor-plugin-state.js';
import type { AnchorPluginOptions, AnchorPluginState } from './anchor-plugin-types.js';
import { isAnchorPluginMeta } from './anchor-plugin-types.js';
import { performDeferredReanchoring } from './anchor-reanchoring.js';

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
  return $prose(() => createAnchorProsePlugin(options));
}

/** Build the concrete ProseMirror plugin used by the Milkdown wrapper. */
export function createAnchorProsePlugin(options: AnchorPluginOptions = {}) {
  let reanchorTimeout: ReturnType<typeof setTimeout> | null = null;

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
          return handleMetaTransaction(meta, prevState, newState.doc);
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
}
