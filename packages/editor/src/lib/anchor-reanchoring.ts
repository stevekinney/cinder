/**
 * Deferred quote re-anchoring for comment anchors.
 *
 * @module
 */

import type { Node as ProseMirrorNode } from '@milkdown/kit/prose/model';
import type { EditorView } from '@milkdown/kit/prose/view';
import { anchorMatchesDocument, anchorPluginKey } from './anchor-plugin-state.js';
import type { AnchorPluginOptions, AnchorPluginState, AnchorState } from './anchor-plugin-types.js';
import { reanchorQuote } from './comments/reanchor.js';
import type { AnchorUpdate } from './comments/types.js';
import { textOffsetToProseMirrorPosition } from './editor/bridge.js';

// Deferred Re-anchoring
// ============================================================================

/**
 * Perform deferred re-anchoring for anchors that drifted.
 *
 * An anchor whose quote is not in the document is marked `orphaned` and KEPT,
 * not deleted. Deletion and cut-and-paste look identical at the moment the text
 * disappears, and this pass runs 300ms after the last change — far quicker than
 * a person cutting a paragraph and pasting it back. Deleting on `found: false`
 * therefore destroyed a comment during an ordinary edit, with no undo
 * (cinder#1284).
 *
 * An orphaned anchor renders nothing and is retried on every later pass, so
 * restoring the text restores the anchor. Removing the thread is the consumer's
 * call.
 */
type ReanchorResult = { anchor: AnchorState; update?: AnchorUpdate };

function anchorUpdate(anchor: AnchorState): AnchorUpdate {
  return {
    threadId: anchor.threadId,
    from: anchor.from,
    to: anchor.to,
    quote: anchor.quote,
    prefix: anchor.prefix,
    suffix: anchor.suffix,
    status: anchor.status,
    ...(anchor.lastKnownOffset !== undefined ? { lastKnownOffset: anchor.lastKnownOffset } : {}),
  };
}

function reanchorOne(
  doc: ProseMirrorNode,
  documentText: string,
  anchor: AnchorState,
): ReanchorResult {
  if (anchorMatchesDocument(doc, anchor)) {
    if (anchor.status !== 'orphaned') return { anchor };
    const recovered = { ...anchor, status: 'anchored' as const };
    return { anchor: recovered, update: anchorUpdate(recovered) };
  }

  const result = reanchorQuote(documentText, {
    quote: anchor.quote,
    prefix: anchor.prefix,
    suffix: anchor.suffix,
    originalPosition: anchor.originalPosition,
    lastKnownOffset: anchor.lastKnownOffset,
  });
  if (!result.found) {
    const orphaned = { ...anchor, status: 'orphaned' as const };
    return {
      anchor: orphaned,
      ...(anchor.status === 'orphaned' ? {} : { update: anchorUpdate(orphaned) }),
    };
  }

  const newFrom = textOffsetToProseMirrorPosition(doc, result.from) ?? anchor.from;
  const newTo = textOffsetToProseMirrorPosition(doc, result.to) ?? anchor.to;
  const docSize = doc.content.size;
  const clampedFrom = Math.max(0, Math.min(newFrom, docSize));
  const clampedTo = Math.max(clampedFrom, Math.min(newTo, docSize));
  const newQuote =
    clampedFrom < clampedTo ? doc.textBetween(clampedFrom, clampedTo, '\n') : anchor.quote;

  let prefix = anchor.prefix;
  let suffix = anchor.suffix;
  if (clampedFrom < clampedTo) {
    prefix = doc.textBetween(Math.max(0, clampedFrom - 50), clampedFrom, '\n');
    suffix = doc.textBetween(clampedTo, Math.min(docSize, clampedTo + 50), '\n');
  }

  const reanchored = {
    ...anchor,
    from: clampedFrom,
    to: clampedTo,
    quote: newQuote,
    prefix,
    suffix,
    lastKnownOffset: result.from,
    status: 'anchored' as const,
  };
  return { anchor: reanchored, update: anchorUpdate(reanchored) };
}

/** Perform deferred re-anchoring for anchors that drifted. */
export function performDeferredReanchoring(
  view: EditorView,
  pluginState: AnchorPluginState,
  options: AnchorPluginOptions,
): void {
  const { doc } = view.state;
  const documentText = doc.textBetween(0, doc.content.size, '\n');
  const newAnchors = new Map<string, AnchorState>();
  const updates: AnchorUpdate[] = [];

  for (const [threadId, anchor] of pluginState.anchors) {
    const result = reanchorOne(doc, documentText, anchor);
    newAnchors.set(threadId, result.anchor);
    if (result.update) updates.push(result.update);
  }

  view.dispatch(
    view.state.tr.setMeta(anchorPluginKey, {
      type: 'sync',
      threads: Array.from(newAnchors.entries()).map(([threadId, anchor]) => ({
        id: threadId,
        anchor: { ...anchor },
        comments: [],
        createdAt: new Date().toISOString(),
      })),
      source: 'external' as const,
    }),
  );
  if (updates.length > 0) options.onAnchorsUpdate?.(updates);
}
