/**
 * Anchor plugin state, transaction mapping, and metadata application.
 *
 * @module
 */

import type { Node as ProseMirrorNode } from '@milkdown/kit/prose/model';
import type { EditorState, Transaction } from '@milkdown/kit/prose/state';
import { PluginKey } from '@milkdown/kit/prose/state';
import type { AnchorPluginMeta, AnchorPluginState, AnchorState } from './anchor-plugin-types.js';
import { proseMirrorPositionToTextOffset } from './editor/bridge.js';
import { devWarn } from './utilities/dev-warn.js';

export const anchorPluginKey = new PluginKey<AnchorPluginState>('anchor');

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
 * Does the document actually contain this anchor's quote at its stored range?
 *
 * Supplied `from`/`to` are only trustworthy when they came from this plugin.
 * A consumer seeding `threads` has no documented way to know that they are
 * ProseMirror positions (not `textBetween` offsets, and not raw-Markdown
 * indices), and a persisted anchor can be restored against a document that has
 * since moved on. Rather than trust the numbers and render a highlight over
 * whatever happens to sit there, verify them and let re-anchoring — which
 * searches by quote — correct any that do not check out.
 */
export function anchorMatchesDocument(doc: ProseMirrorNode, anchor: AnchorState): boolean {
  if (!anchor.quote) return true; // Document-level anchors have no quote to verify.
  const docSize = doc.content.size;
  if (anchor.from < 0 || anchor.to > docSize || anchor.from >= anchor.to) return false;
  return doc.textBetween(anchor.from, anchor.to, '\n') === anchor.quote;
}

/**
 * Warn, in dev only, the first time the plugin sees a thread whose stored range
 * does not describe its own quote.
 *
 * Scoped to threads this plugin has NOT tracked before, which is what keeps it
 * off ordinary editing drift: the plugin maps its own copy on every edit
 * without writing back, so a consumer's `threads` legitimately carries stale
 * positions — but those threads are already in `prevState.anchors` and never
 * reach here. The first sync of a seeded thread happens against the fully
 * loaded document, which is exactly when a wrong coordinate space is knowable
 * and still worth reporting.
 */
function warnOnMisSeededAnchor(
  doc: ProseMirrorNode,
  anchor: AnchorState,
  alreadyTracked: boolean,
): void {
  if (alreadyTracked || !anchor.quote || doc.content.size === 0) return;
  // `toRuntimeThreads` deliberately restores text anchors at 0/0 so the
  // deferred pass can place them by quote against the live document. That is a
  // valid persistence sentinel, not a consumer-supplied coordinate mistake.
  if (anchor.from === 0 && anchor.to === 0) return;
  if (anchorMatchesDocument(doc, anchor)) return;

  const inBounds = anchor.from >= 0 && anchor.to <= doc.content.size && anchor.from < anchor.to;
  // Say WHY the quote could not be confirmed. `reads null` would be ambiguous —
  // it looks like the document contains the string "null" — and an out-of-range
  // anchor is a distinct, common case: a persisted copy pointing past the end of
  // a document that has since shrunk.
  const reading = inBounds
    ? `the document reads ${JSON.stringify(doc.textBetween(anchor.from, anchor.to, '\n'))} there`
    : `that range lies outside the document (valid positions are 0–${doc.content.size})`;

  devWarn(
    `[cinder/ReviewEditor] thread "${anchor.threadId}" anchors ${JSON.stringify(anchor.quote)} at ` +
      `${anchor.from}–${anchor.to}, but ${reading}. ` +
      `anchor.from/to are ProseMirror positions, in which markup occupies nothing — so ` +
      `"Release Plan" in "# Release Plan" is 1–13, not 2–14 (raw-Markdown indices) and not 0–12 ` +
      `(textBetween offsets, which is what anchor.lastKnownOffset uses). Re-anchoring by quote; ` +
      `the stored range is ignored. If these coordinates came from a saved session, restore ` +
      `through setState rather than reusing raw from/to — the editor does not write mapped ` +
      `positions back to \`threads\` during editing, so a persisted copy drifts.`,
  );
}

/**
 * Handle meta-transactions (add/remove/sync anchors).
 */
function toAnchorState(thread: import('./comments/types.js').Thread): AnchorState {
  const anchor = thread.anchor;
  return {
    threadId: thread.id,
    from: anchor.from,
    to: anchor.to,
    quote: anchor.quote,
    originalQuote: anchor.originalQuote ?? anchor.quote,
    prefix: anchor.prefix,
    suffix: anchor.suffix,
    originalPosition: anchor.originalPosition,
    lastKnownOffset: anchor.lastKnownOffset,
    status: anchor.status ?? 'anchored',
  };
}

function syncAnchors(
  threads: import('./comments/types.js').Thread[],
  prevState: AnchorPluginState,
  doc: ProseMirrorNode,
): AnchorPluginState {
  const anchors = new Map<string, AnchorState>();
  let needsReanchor = false;
  for (const thread of threads) {
    const anchor = toAnchorState(thread);
    if (anchor.status !== 'orphaned' && !anchorMatchesDocument(doc, anchor)) needsReanchor = true;
    warnOnMisSeededAnchor(doc, anchor, prevState.anchors.has(thread.id));
    anchors.set(thread.id, anchor);
  }
  return {
    anchors,
    needsReanchor,
    activeThreadId: prevState.activeThreadId,
    hoveredThreadId: prevState.hoveredThreadId,
  };
}

function addAnchor(
  thread: import('./comments/types.js').Thread,
  prevState: AnchorPluginState,
  doc: ProseMirrorNode,
): AnchorPluginState {
  const anchors = new Map(prevState.anchors);
  const anchor = toAnchorState(thread);
  warnOnMisSeededAnchor(doc, anchor, anchors.has(thread.id));
  anchors.set(thread.id, anchor);
  return {
    ...prevState,
    anchors,
    needsReanchor: prevState.needsReanchor || !anchorMatchesDocument(doc, anchor),
  };
}

function removeAnchor(threadId: string, prevState: AnchorPluginState): AnchorPluginState {
  const anchors = new Map(prevState.anchors);
  anchors.delete(threadId);
  return { ...prevState, anchors };
}

/** Handle meta-transactions (add/remove/sync anchors). */
export function handleMetaTransaction(
  meta: AnchorPluginMeta,
  prevState: AnchorPluginState,
  doc: ProseMirrorNode,
): AnchorPluginState {
  switch (meta.type) {
    case 'sync':
      return syncAnchors(meta.threads, prevState, doc);
    case 'add':
      return addAnchor(meta.thread, prevState, doc);
    case 'remove':
      return removeAnchor(meta.threadId, prevState);
    case 'set-active':
      return { ...prevState, activeThreadId: meta.threadId };
    case 'set-hover':
      return { ...prevState, hoveredThreadId: meta.threadId };
    default:
      return prevState;
  }
}

/**
 * Detect a transaction that replaces the document wholesale.
 *
 * Milkdown sets the initial document with a single step spanning the entire
 * old doc. Position mapping is meaningless across such a step: `map(from, -1)`
 * collapses to the start and `map(to, 1)` expands to the end, so every anchor
 * would come out spanning the whole document. Anchors must be located by quote
 * instead, which is what deferred re-anchoring does.
 *
 * The same reasoning applies to any later full replacement (`setMarkdown`,
 * loading a new revision), so this is keyed on the shape of the step rather
 * than on "is this the first transaction".
 */
function isFullDocumentReplacement(tr: Transaction, oldDocSize: number): boolean {
  for (const step of tr.steps) {
    let replacesEverything = false;
    step.getMap().forEach((oldStart, oldEnd) => {
      if (oldStart <= 0 && oldEnd >= oldDocSize) replacesEverything = true;
    });
    if (replacesEverything) return true;
  }
  return false;
}

/**
 * Map anchor positions through a transaction.
 */
type MappedAnchor = { anchor: AnchorState; needsReanchor: boolean };

function mapOneAnchorThroughTransaction(
  tr: Transaction,
  anchor: AnchorState,
  doc: ProseMirrorNode,
  newDoc: ProseMirrorNode,
): MappedAnchor {
  const isUnplacedOrphan = anchor.status === 'orphaned' && anchor.from === 0 && anchor.to === 0;
  const mappedTo = tr.mapping.map(anchor.to, 1);
  let mappedFrom = tr.mapping.map(anchor.from, -1);
  // A block split exactly at `anchor.from` inserts a close and an open token
  // there. Mapping backward leaves the start before them, so the range would
  // begin with a block separator and read as drifted. When the forward
  // mapping recovers the tracked quote and the backward one does not, prefer it.
  // Only structural insertions qualify: typed text at `anchor.from` must stay
  // inside the range, matching the inclusive-boundary behavior at the end.
  if (mappedFrom < mappedTo && newDoc.textBetween(mappedFrom, mappedTo, '\n') !== anchor.quote) {
    const forwardFrom = tr.mapping.map(anchor.from, 1);
    if (
      forwardFrom > mappedFrom &&
      forwardFrom < mappedTo &&
      newDoc.textBetween(mappedFrom, forwardFrom, '\n').replaceAll('\n', '') === '' &&
      newDoc.textBetween(forwardFrom, mappedTo, '\n') === anchor.quote
    ) {
      mappedFrom = forwardFrom;
    }
  }

  if (mappedFrom >= mappedTo) {
    const lastKnownOffset = isUnplacedOrphan
      ? anchor.lastKnownOffset
      : proseMirrorPositionToTextOffset(newDoc, mappedFrom);
    return {
      anchor: { ...anchor, from: mappedFrom, to: mappedFrom, lastKnownOffset },
      needsReanchor: true,
    };
  }

  const currentQuote = newDoc.textBetween(mappedFrom, mappedTo, '\n');
  const quoteDrifted = currentQuote !== anchor.quote;
  const followsEdit =
    didTransactionAffectAnchorRange(tr, anchor.from, anchor.to) &&
    anchorMatchesDocument(doc, anchor);

  if (followsEdit) {
    const prefix = newDoc.textBetween(Math.max(0, mappedFrom - 50), mappedFrom, '\n');
    const suffix = newDoc.textBetween(mappedTo, Math.min(newDoc.content.size, mappedTo + 50), '\n');
    return {
      anchor: {
        ...anchor,
        from: mappedFrom,
        to: mappedTo,
        quote: currentQuote,
        prefix,
        suffix,
        lastKnownOffset: proseMirrorPositionToTextOffset(newDoc, mappedFrom),
      },
      needsReanchor: false,
    };
  }

  if (quoteDrifted) {
    const lastKnownOffset = isUnplacedOrphan
      ? anchor.lastKnownOffset
      : proseMirrorPositionToTextOffset(newDoc, mappedFrom);
    return {
      anchor: { ...anchor, from: mappedFrom, to: mappedTo, lastKnownOffset },
      needsReanchor: true,
    };
  }

  return {
    anchor: {
      ...anchor,
      from: mappedFrom,
      to: mappedTo,
      lastKnownOffset: proseMirrorPositionToTextOffset(newDoc, mappedFrom),
    },
    needsReanchor: false,
  };
}

function preserveAnchorsForReplacement(
  prevState: AnchorPluginState,
  needsReanchor: boolean,
): AnchorPluginState {
  return {
    anchors: new Map(prevState.anchors),
    needsReanchor,
    activeThreadId: prevState.activeThreadId,
    hoveredThreadId: prevState.hoveredThreadId,
  };
}

/** Map anchor positions through a transaction. */
export function mapAnchorsThroughTransaction(
  tr: Transaction,
  prevState: AnchorPluginState,
  newState: EditorState,
): AnchorPluginState {
  if (isFullDocumentReplacement(tr, tr.before.content.size)) {
    return preserveAnchorsForReplacement(prevState, prevState.anchors.size > 0);
  }

  const anchors = new Map<string, AnchorState>();
  let needsReanchor = false;
  for (const [threadId, anchor] of prevState.anchors) {
    const mapped = mapOneAnchorThroughTransaction(tr, anchor, tr.before, newState.doc);
    anchors.set(threadId, mapped.anchor);
    needsReanchor ||= mapped.needsReanchor || anchor.status === 'orphaned';
  }
  return {
    anchors,
    needsReanchor,
    activeThreadId: prevState.activeThreadId,
    hoveredThreadId: prevState.hoveredThreadId,
  };
}
