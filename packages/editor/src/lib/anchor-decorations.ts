/**
 * ProseMirror plugin for comment anchor tracking.
 *
 * This plugin:
 * - Tracks anchor positions through document edits via tr.mapping.map()
 * - Detects when anchors need re-anchoring (quote drift)
 * - Provides decorations for visual anchor highlights
 * - Marks anchors orphaned when their quote leaves the document, and
 *   re-anchors them if it comes back
 *
 * @module
 *
 * SSR safety: the `@milkdown/kit/prose/*` value imports below resolve to
 * prosemirror-state and prosemirror-view. They are imported STATICALLY — and
 * deliberately so — because prosemirror is SSR-safe at module-evaluation time:
 * `prosemirror-view` reads `document`/`navigator` only behind
 * `typeof X !== 'undefined'` guards, so on the server (where those globals are
 * absent) it falls back to null/"" rather than throwing. There is therefore
 * nothing to defer behind a runtime browser guard at this layer; the SSR
 * boundary lives in the consuming Svelte component (MarkdownEditor mounts the
 * live editor inside `{#if browser}`). This invariant is enforced by
 * `src/ssr-import.test.ts`.
 */

import type { EditorState, Transaction } from '@milkdown/kit/prose/state';
import { Plugin, PluginKey, TextSelection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';
import { $prose } from '@milkdown/kit/utils';

import type { Node as ProseMirrorNode } from '@milkdown/kit/prose/model';
import { reanchorQuote } from './comments/reanchor.js';
import type { AnchorUpdate, Thread } from './comments/types.js';
import {
  proseMirrorPositionToTextOffset,
  textOffsetToProseMirrorPosition,
} from './editor/bridge.js';
import type { AnchorStatus } from './shared/anchor-types.js';
import { devWarn } from './utilities/dev-warn.js';

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
  /**
   * Whether the quote is currently in the document.
   *
   * `orphaned` anchors are tracked but render nothing, and are retried on every
   * later re-anchoring pass so restoring the text restores the anchor.
   */
  status: AnchorStatus;
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
  /**
   * @deprecated Never called. An anchor whose quote leaves the document is
   * marked `orphaned` and reported through `onAnchorsUpdate` with
   * `status: 'orphaned'` instead of being deleted, because deletion and
   * cut-and-paste are indistinguishable within the re-anchoring window
   * (cinder#1284). Removing a thread is the consumer's decision.
   */
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
function anchorMatchesDocument(doc: ProseMirrorNode, anchor: AnchorState): boolean {
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
function handleMetaTransaction(
  meta: AnchorPluginMeta,
  prevState: AnchorPluginState,
  doc: ProseMirrorNode,
): AnchorPluginState {
  switch (meta.type) {
    case 'sync': {
      // Sync external thread state into plugin
      const newAnchors = new Map<string, AnchorState>();
      let needsReanchor = false;
      for (const thread of meta.threads) {
        const anchor = thread.anchor;
        const anchorState: AnchorState = {
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
        // An anchor that is ALREADY orphaned is known-bad: re-raising here would
        // make the deferred pass dispatch this same sync, which re-raises again,
        // forever, on an idle document. Only a later document change (handled in
        // `mapAnchorsThroughTransaction`) should schedule another attempt.
        if (anchorState.status !== 'orphaned' && !anchorMatchesDocument(doc, anchorState)) {
          needsReanchor = true;
        }
        warnOnMisSeededAnchor(doc, anchorState, prevState.anchors.has(thread.id));
        newAnchors.set(thread.id, anchorState);
      }
      return {
        anchors: newAnchors,
        needsReanchor,
        activeThreadId: prevState.activeThreadId,
        hoveredThreadId: prevState.hoveredThreadId,
      };
    }

    case 'add': {
      const newAnchors = new Map(prevState.anchors);
      const anchor = meta.thread.anchor;
      const anchorState: AnchorState = {
        threadId: meta.thread.id,
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
      warnOnMisSeededAnchor(doc, anchorState, prevState.anchors.has(meta.thread.id));
      newAnchors.set(meta.thread.id, anchorState);
      return {
        ...prevState,
        anchors: newAnchors,
        needsReanchor: prevState.needsReanchor || !anchorMatchesDocument(doc, anchorState),
      };
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
function mapAnchorsThroughTransaction(
  tr: Transaction,
  prevState: AnchorPluginState,
  newState: EditorState,
): AnchorPluginState {
  const newAnchors = new Map<string, AnchorState>();
  let needsReanchor = false;

  // A wholesale replacement carries no usable position mapping. Keep every
  // anchor's quote/prefix/suffix untouched and defer to re-anchoring, which
  // searches by quote. Mapping through it instead would expand each anchor to
  // the full document AND (via the "follow the edit" branch below) overwrite
  // `quote` with the entire document text — destroying the only information
  // re-anchoring could have used to recover.
  if (isFullDocumentReplacement(tr, tr.before.content.size)) {
    for (const [threadId, anchor] of prevState.anchors) {
      newAnchors.set(threadId, anchor);
    }
    return {
      anchors: newAnchors,
      needsReanchor: newAnchors.size > 0,
      activeThreadId: prevState.activeThreadId,
      hoveredThreadId: prevState.hoveredThreadId,
    };
  }

  for (const [threadId, anchor] of prevState.anchors) {
    // Any document change is a chance for an orphan's text to have come back,
    // so retry it. This runs only on `docChanged`, so it is one retry per edit —
    // bounded, unlike re-raising on every sync, which loops on an idle document.
    if (anchor.status === 'orphaned') needsReanchor = true;

    // An orphan restored from persistence sits at the unplaced `0`/`0` sentinel
    // `toRuntimeThreads` writes: the range says "nowhere", while
    // `lastKnownOffset` still records where the quote used to be. Mapping that
    // sentinel produces offset 0, so recomputing the hint from it below would
    // trade the saved location for the top of the document. Re-anchoring leans
    // on that hint to choose between repeated occurrences of the same quote, so
    // losing it reattaches the recovered comment to the FIRST occurrence rather
    // than the one it was written against. Only an anchor that collapsed
    // somewhere real has a mapped position worth reading.
    const isUnplacedOrphan = anchor.status === 'orphaned' && anchor.from === 0 && anchor.to === 0;

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
      const collapsedOffset = isUnplacedOrphan
        ? anchor.lastKnownOffset
        : proseMirrorPositionToTextOffset(newState.doc, mappedFrom);
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

    // Only an anchor that verifiably described its own text BEFORE this
    // transaction may adopt the text at its mapped range afterwards.
    //
    // An anchor that never checked out — a consumer seeded the wrong coordinate
    // space, or restored a copy the document has moved past — is already
    // flagged for the deferred re-anchoring pass, which searches by QUOTE.
    // Letting it take the branch below would overwrite that quote with whatever
    // text happens to sit at the bad range; `anchorMatchesDocument` would then
    // report it healthy and the deferred pass would skip it forever.
    //
    // That is not hypothetical. Milkdown's `syncHeadingIdPlugin` stamps `id`
    // attributes onto every heading on load, as an attribute-only
    // `replaceAround` spanning the whole heading. It lands inside the 300ms
    // debounce, reaches this branch, and cements a mis-seeded heading anchor
    // one character off — `{from: 2, to: 14}` for "Release Plan" renders
    // "elease Plan" permanently, while the same mistake in a paragraph (which
    // that transaction does not touch) repairs correctly. cinder#1275.
    if (
      didTransactionAffectAnchorRange(tr, anchor.from, anchor.to) &&
      anchorMatchesDocument(tr.before, anchor)
    ) {
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
      // Inserting a block at the very top of the document expands the sentinel
      // range instead of leaving it collapsed, which lands a restored orphan
      // here rather than in the branch above. The hint is no more recoverable
      // from `0`/`15` than from `0`/`0`, so preserve it on the same terms.
      const newLastKnownOffset = isUnplacedOrphan
        ? anchor.lastKnownOffset
        : proseMirrorPositionToTextOffset(newState.doc, mappedFrom);
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
function performDeferredReanchoring(
  view: EditorView,
  pluginState: AnchorPluginState,
  options: AnchorPluginOptions,
): void {
  const { doc } = view.state;
  const documentText = doc.textBetween(0, doc.content.size, '\n');
  const updates: AnchorUpdate[] = [];

  const newAnchors = new Map<string, AnchorState>();

  for (const [threadId, anchor] of pluginState.anchors) {
    // Re-anchor if the quote at current position doesn't match. Checked via
    // anchorMatchesDocument rather than a bare textBetween: after a wholesale
    // document replacement the stored positions can point past the end of the
    // new document, and textBetween throws a RangeError on out-of-range input.
    if (anchorMatchesDocument(doc, anchor)) {
      // The quote is at the stored range. If this anchor was orphaned, the text
      // has come back — a paste that restored it at the SAME position, where the
      // insertion mapping expands the collapsed range onto the restored quote so
      // no drift is detected. Recover it here; otherwise it would sit orphaned
      // and undecorated forever with its own text sitting under it.
      if (anchor.status === 'orphaned') {
        const recovered: AnchorState = { ...anchor, status: 'anchored' };
        newAnchors.set(threadId, recovered);
        updates.push({
          threadId,
          from: recovered.from,
          to: recovered.to,
          quote: recovered.quote,
          prefix: recovered.prefix,
          suffix: recovered.suffix,
          status: 'anchored',
          ...(recovered.lastKnownOffset !== undefined
            ? { lastKnownOffset: recovered.lastKnownOffset }
            : {}),
        });
        continue;
      }
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

    // The quote is not in the document right now. Keep the anchor, mark it
    // orphaned, and report the status change so the consumer can surface it.
    // The next pass retries it — `mapAnchorsThroughTransaction` re-raises
    // `needsReanchor` for a collapsed range on every later edit — so a paste
    // that restores the text restores the anchor.
    if (!result.found) {
      const orphaned: AnchorState = { ...anchor, status: 'orphaned' };
      newAnchors.set(threadId, orphaned);
      if (anchor.status !== 'orphaned') {
        updates.push({
          threadId,
          from: anchor.from,
          to: anchor.to,
          quote: anchor.quote,
          prefix: anchor.prefix,
          suffix: anchor.suffix,
          status: 'orphaned',
          ...(anchor.lastKnownOffset !== undefined
            ? { lastKnownOffset: anchor.lastKnownOffset }
            : {}),
        });
      }
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
      status: 'anchored',
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
        anchor: { ...a },
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
}

// ============================================================================
// Decorations
// ============================================================================

/**
 * Compute decorations for all anchors.
 *
 * All anchors get a simple inline highlight. Active and hovered states
 * are indicated via additional CSS classes.
 *
 * cinder#1304: the decoration used to carry only `class` and `data-thread-id`
 * — both invisible to assistive tech — so an anchored comment was mouse-only.
 * `role="mark"` and `aria-description` fix the announcement half (a screen
 * reader now identifies the run of text as carrying a comment, the same job
 * `<mark>` does natively, without a `<mark>` element ProseMirror does not
 * render here). They do NOT fix reachability: `role="mark"` carries no
 * default tab stop, deliberately — `tabindex` on an inline decoration inside
 * a contenteditable is fragile (it fights ProseMirror's own selection/caret
 * handling on every render) and was rejected as "probably not the fix" in the
 * issue itself. The keyboard route lives in `review-editor-impl.svelte`
 * instead: a container-level Ctrl-Alt-ArrowDown/Up command that moves the
 * caret between anchors in document order and opens the one it lands on,
 * which needs `threads` state this plugin does not have and so cannot live
 * here.
 *
 * `aria-details` (pointing at the thread's sidebar entry, as the issue also
 * suggested) is deliberately NOT set: `CommentSidebar` only mounts while
 * `sidebarOpen`, so the referenced id would not exist in the DOM most of the
 * time — an `aria-details` that dangles whenever the sidebar is closed is a
 * worse failure mode (an axe `aria-valid-attr-value` violation) than the one
 * this fix exists to close.
 */
function computeDecorations(state: EditorState): DecorationSet {
  const pluginState = anchorPluginKey.getState(state);
  if (!pluginState) return DecorationSet.empty;

  const decorations: Decoration[] = [];
  const docSize = state.doc.content.size;
  const activeThreadId = pluginState.activeThreadId;
  const hoveredThreadId = pluginState.hoveredThreadId;

  for (const [threadId, anchor] of pluginState.anchors) {
    // An orphaned anchor's quote is not in the document, so there is nothing to
    // highlight. It stays tracked (and retried) rather than decorated.
    if (anchor.status === 'orphaned') continue;

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
          role: 'mark',
          'aria-description': 'Commented text',
        },
        { key: `anchor-${threadId}` },
      ),
    );
  }

  return DecorationSet.create(state.doc, decorations);
}

/**
 * Move `view`'s selection to cover `[from, to)` and scroll it into view.
 *
 * Exists so ReviewEditor's keyboard "next/previous comment" navigation
 * (cinder#1304 — the keyboard route to an anchor that has no `tabindex` of
 * its own, see `computeDecorations` above) can move the caret to an anchor's
 * range WITHOUT importing ProseMirror value modules directly into
 * `review-editor-impl.svelte`. That component reaches ProseMirror only
 * through this file, which `review-editor.ssr.test.ts` enforces at the
 * source level (`@milkdown/`/`prosemirror-` value imports are only SSR-safe
 * here, not at the component layer) — a second entry point there would be a
 * new, unaudited one.
 *
 * Returns `false` (and dispatches nothing) if the range cannot be resolved
 * against the CURRENT document, e.g. a stale position after an intervening
 * edit the caller has not re-checked.
 */
export function selectAnchorRange(view: EditorView, from: number, to: number): boolean {
  if (from < 0 || to > view.state.doc.content.size || from > to) return false;
  try {
    const selection = TextSelection.create(view.state.doc, from, to);
    view.dispatch(view.state.tr.setSelection(selection).scrollIntoView());
    return true;
  } catch {
    // Position valid by size but not addressable (mid-node boundary).
    return false;
  }
}

/**
 * Resolve the range to select for `threadId`'s anchor, preferring this
 * plugin's own LIVE, per-transaction-mapped position over the caller's
 * `fallback` (typically converted from the thread's own cached
 * `anchor.from`/`to`, which `computeDecorations` above also reads from the
 * SAME plugin state, not from a thread).
 *
 * cinder#1304's keyboard "next/previous comment" navigation used to read
 * only the fallback: an ordinary edit before an anchor maps this plugin's
 * tracked position through the transaction immediately (the position
 * `computeDecorations` paints the live decoration from), but does not call
 * `onAnchorsUpdate` — that only fires during deferred re-anchoring — so a
 * caller holding the thread's own cached anchor (never told about the
 * mapped shift) could select stale, unrelated text at the anchor's FORMER
 * position even though the decoration itself had already moved to the
 * right one. Falls back to `fallback` if the plugin has no live entry for
 * `threadId` (e.g. the anchor plugin isn't mounted, or the thread was never
 * synced into it).
 */
export function resolveAnchorSelectionRange(
  view: EditorView,
  threadId: string,
  fallback: { from: number; to: number },
): { from: number; to: number } {
  const liveAnchor = anchorPluginKey.getState(view.state)?.anchors.get(threadId);
  if (!liveAnchor) return fallback;
  return { from: liveAnchor.from, to: liveAnchor.to };
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
  });
}
