/**
 * Regression tests: a persistent orphan must not reschedule itself forever.
 *
 * An anchor whose quote leaves the document is KEPT and marked `orphaned`
 * (cinder#1284) rather than deleted, and retried so that restoring the text
 * restores the anchor. The retry has to be driven by DOCUMENT CHANGES, not by
 * the deferred pass's own bookkeeping: the pass ends by dispatching a `sync`
 * meta-transaction, and if that sync re-raised `needsReanchor` — the stored
 * range of an orphan never matches the document, by definition — the plugin
 * view would schedule another 300ms pass, which would dispatch the same sync,
 * forever. An idle document with one unresolvable comment would emit an
 * unbounded stream of ProseMirror transactions and full-document quote
 * searches.
 *
 * The guard lives in `handleMetaTransaction`'s `sync` branch (an already
 * `orphaned` anchor does not re-raise `needsReanchor`) and the one legitimate
 * retry trigger lives in `mapAnchorsThroughTransaction` (an orphan re-raises on
 * `docChanged`, which is one retry per edit).
 *
 * These tests drive the REAL plugin — its state field and its plugin view —
 * against a real EditorState, with a controllable clock standing in for the
 * 300ms debounce, and count transactions and scheduled timers.
 *
 * No DOM required: the plugin view touches only `view.state` and
 * `view.dispatch`.
 */

import { setupHappyDom } from '@lostgradient/testing';
import type { Node as ProseMirrorNode } from '@milkdown/kit/prose/model';
import { Schema } from '@milkdown/kit/prose/model';
import type { Transaction } from '@milkdown/kit/prose/state';
import { EditorState } from '@milkdown/kit/prose/state';
import { EditorView } from '@milkdown/kit/prose/view';
import { afterEach, describe, expect, test } from 'bun:test';

import { anchorPluginKey } from './anchor-plugin-state.js';
import type { AnchorPluginState, AnchorState } from './anchor-plugin-types.js';
import { createAnchorProsePlugin } from './anchor-plugin.js';
import type { AnchorUpdate, Thread } from './comments/types.js';
import type { FakeClock } from './test/fake-clock.js';
import { installFakeClock } from './test/fake-clock.js';

// ============================================================================
// Schema
// ============================================================================

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: {
      content: 'inline*',
      group: 'block',
      parseDOM: [{ tag: 'p' }],
      toDOM() {
        return ['p', 0];
      },
    },
    text: { group: 'inline' },
  },
});

function makeDoc(...paragraphs: string[]): ProseMirrorNode {
  return schema.node(
    'doc',
    null,
    paragraphs.map((text) =>
      schema.node('paragraph', null, text.length > 0 ? [schema.text(text)] : []),
    ),
  );
}

/**
 * ProseMirror range of a literal quote in the document.
 *
 * Verified against `textBetween` so a test can never assert on the wrong
 * coordinate space (the exact mistake `warnOnMisSeededAnchor` exists to catch).
 */
function rangeOf(doc: ProseMirrorNode, quote: string): { from: number; to: number } {
  let found: { from: number; to: number } | null = null;

  doc.descendants((node, pos) => {
    if (found !== null) return false;
    const text = node.text;
    if (!node.isText || text === undefined) return true;
    const index = text.indexOf(quote);
    if (index !== -1) found = { from: pos + index, to: pos + index + quote.length };
    return true;
  });

  if (found === null) throw new Error(`Test fixture does not contain ${JSON.stringify(quote)}`);
  const range: { from: number; to: number } = found;
  if (doc.textBetween(range.from, range.to, '\n') !== quote) {
    throw new Error(`Computed range ${range.from}-${range.to} does not read ${quote}`);
  }
  return range;
}

// ============================================================================
// Harness
// ============================================================================

setupHappyDom();

interface Harness {
  readonly state: EditorState;
  readonly transactionCount: number;
  readonly updates: AnchorUpdate[];
  dispatch(transaction: Transaction): void;
  syncThreads(threads: Thread[]): void;
  pluginState(): AnchorPluginState;
  anchor(threadId: string): AnchorState;
  destroy(): void;
}

async function createHarness(doc: ProseMirrorNode): Promise<Harness> {
  const updates: AnchorUpdate[] = [];
  const prosePlugin = createAnchorProsePlugin({
    onAnchorsUpdate: (received) => updates.push(...received),
  });
  const mount = document.createElement('div');
  document.body.append(mount);
  let transactionCount = 0;
  let view!: EditorView;
  view = new EditorView(mount, {
    state: EditorState.create({ schema, doc, plugins: [prosePlugin] }),
    dispatchTransaction(transaction) {
      transactionCount += 1;
      view.updateState(view.state.apply(transaction));
    },
  });

  function pluginState(): AnchorPluginState {
    const current = anchorPluginKey.getState(view.state);
    if (!current) throw new Error('anchor plugin state missing');
    return current;
  }

  return {
    get state() {
      return view.state;
    },
    get transactionCount() {
      return transactionCount;
    },
    updates,
    dispatch(transaction) {
      view.dispatch(transaction);
    },
    syncThreads(threads) {
      view.dispatch(
        view.state.tr.setMeta(anchorPluginKey, { type: 'sync', threads, source: 'external' }),
      );
    },
    pluginState,
    anchor(threadId) {
      const anchor = pluginState().anchors.get(threadId);
      if (!anchor) throw new Error(`no anchor tracked for ${threadId}`);
      return anchor;
    },
    destroy() {
      view.destroy();
      mount.remove();
    },
  };
}

function makeThread(
  id: string,
  anchor: {
    from: number;
    to: number;
    quote: string;
    prefix?: string;
    suffix?: string;
    lastKnownOffset?: number;
  },
): Thread {
  return {
    id,
    anchor: {
      from: anchor.from,
      to: anchor.to,
      quote: anchor.quote,
      originalQuote: anchor.quote,
      prefix: anchor.prefix ?? '',
      suffix: anchor.suffix ?? '',
      status: 'anchored',
      lastKnownOffset: anchor.lastKnownOffset,
    },
    comments: [],
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

const DEBOUNCE_MS = 300;
const IDLE_PASSES = 30;

let clock: FakeClock | null = null;
let harness: Harness | null = null;

afterEach(() => {
  harness?.destroy();
  harness = null;
  clock?.restore();
  clock = null;
});

// ============================================================================
// Tests
// ============================================================================

describe('a persistent orphan does not reschedule itself', () => {
  test('an idle document stops dispatching once the anchor is orphaned', async () => {
    const doc = makeDoc('Alpha beta gamma delta.');
    const beta = rangeOf(doc, 'beta');

    harness = await createHarness(doc);
    clock = installFakeClock();

    // A healthy anchor: the quote is exactly where the thread says it is, so
    // nothing is scheduled at all.
    harness.syncThreads([
      makeThread('thread-1', { ...beta, quote: 'beta', prefix: 'Alpha ', suffix: ' gamma delta.' }),
    ]);
    expect(harness.pluginState().needsReanchor).toBe(false);
    expect(clock.scheduledCount).toBe(0);

    // Delete the quoted text. That is the cut-or-delete moment: the anchor
    // collapses, re-anchoring is scheduled once.
    harness.dispatch(harness.state.tr.delete(beta.from, beta.to));
    expect(harness.pluginState().needsReanchor).toBe(true);
    expect(clock.scheduledCount).toBe(1);
    expect(clock.pendingCount).toBe(1);

    // The deferred pass runs, fails to find the quote, and orphans the anchor.
    clock.advance(DEBOUNCE_MS);
    expect(harness.anchor('thread-1').status).toBe('orphaned');
    expect(harness.updates).toHaveLength(1);
    expect(harness.updates[0]?.status).toBe('orphaned');

    // Everything after this point is the actual claim under test.
    const transactionsAfterOrphaning = harness.transactionCount;
    const timersAfterOrphaning = clock.scheduledCount;

    expect(harness.pluginState().needsReanchor).toBe(false);
    expect(clock.pendingCount).toBe(0);

    for (let pass = 0; pass < IDLE_PASSES; pass += 1) {
      clock.advance(DEBOUNCE_MS);
      expect(clock.pendingCount).toBe(0);
      expect(clock.scheduledCount).toBe(timersAfterOrphaning);
      expect(harness.transactionCount).toBe(transactionsAfterOrphaning);
    }

    // Still orphaned, still reported exactly once.
    expect(harness.anchor('thread-1').status).toBe('orphaned');
    expect(harness.updates).toHaveLength(1);
  });

  test('a thread synced with a quote that is not in the document settles after one pass', async () => {
    // The consumer-seeded shape: a persisted thread restored at the 0/0
    // sentinel whose quote no longer exists anywhere in the document. No
    // document edit ever happens here — only the sync.
    const doc = makeDoc('Alpha beta gamma delta.');

    harness = await createHarness(doc);
    clock = installFakeClock();

    harness.syncThreads([
      makeThread('ghost', {
        from: 0,
        to: 0,
        quote: 'a sentence nobody ever wrote here',
        prefix: 'wildly ',
        suffix: ' unrelated',
      }),
    ]);

    expect(harness.pluginState().needsReanchor).toBe(true);
    expect(clock.scheduledCount).toBe(1);

    clock.advance(DEBOUNCE_MS);
    expect(harness.anchor('ghost').status).toBe('orphaned');

    const transactionsAfterOrphaning = harness.transactionCount;

    for (let pass = 0; pass < IDLE_PASSES; pass += 1) {
      clock.advance(DEBOUNCE_MS);
    }

    expect(clock.scheduledCount).toBe(1);
    expect(clock.pendingCount).toBe(0);
    expect(harness.transactionCount).toBe(transactionsAfterOrphaning);
    expect(harness.updates).toHaveLength(1);
  });

  test('replaces a pending pass when a same-size edit supersedes its document', async () => {
    const doc = makeDoc('Alpha beta gamma delta.');
    const beta = rangeOf(doc, 'beta');

    harness = await createHarness(doc);
    clock = installFakeClock();
    harness.syncThreads([
      makeThread('thread-1', { ...beta, quote: 'beta', prefix: 'Alpha ', suffix: ' gamma delta.' }),
    ]);
    harness.dispatch(harness.state.tr.delete(beta.from, beta.to));
    expect(clock.pendingCount).toBe(1);

    const replacementPosition = 1;
    harness.dispatch(
      harness.state.tr.replaceWith(replacementPosition, replacementPosition + 1, schema.text('X')),
    );
    expect(clock.pendingCount).toBe(1);

    clock.advance(DEBOUNCE_MS);
    expect(harness.anchor('thread-1').status).toBe('orphaned');
    expect(harness.updates).toHaveLength(1);
  });

  test('destroy clears a pending pass before it can dispatch', async () => {
    const doc = makeDoc('Alpha beta gamma delta.');
    const beta = rangeOf(doc, 'beta');

    harness = await createHarness(doc);
    clock = installFakeClock();
    harness.syncThreads([
      makeThread('thread-1', { ...beta, quote: 'beta', prefix: 'Alpha ', suffix: ' gamma delta.' }),
    ]);
    harness.dispatch(harness.state.tr.delete(beta.from, beta.to));
    expect(clock.pendingCount).toBe(1);

    const destroyedHarness = harness;
    const transactionsBeforeDestroy = destroyedHarness.transactionCount;
    destroyedHarness.destroy();
    harness = null;
    clock.advance(DEBOUNCE_MS);

    expect(clock.pendingCount).toBe(0);
    expect(destroyedHarness.transactionCount).toBe(transactionsBeforeDestroy);
  });

  test('the orphan is retried once per document change, and recovers when the text returns', async () => {
    const doc = makeDoc('Alpha beta gamma delta.');
    const beta = rangeOf(doc, 'beta');

    harness = await createHarness(doc);
    clock = installFakeClock();

    harness.syncThreads([
      makeThread('thread-1', { ...beta, quote: 'beta', prefix: 'Alpha ', suffix: ' gamma delta.' }),
    ]);
    harness.dispatch(harness.state.tr.delete(beta.from, beta.to));
    clock.advance(DEBOUNCE_MS);
    expect(harness.anchor('thread-1').status).toBe('orphaned');

    // Unrelated edits keep retrying — exactly one deferred pass, and therefore
    // one dispatched sync, per edit. That is the bounded retry the recovery
    // behavior needs.
    for (let edit = 0; edit < 3; edit += 1) {
      const endOfDocument = harness.state.doc.content.size - 1;
      const timersBefore = clock.scheduledCount;
      harness.dispatch(harness.state.tr.insertText('!', endOfDocument));
      expect(clock.scheduledCount).toBe(timersBefore + 1);

      const transactionsBefore = harness.transactionCount;
      clock.advance(DEBOUNCE_MS);
      expect(harness.transactionCount).toBe(transactionsBefore + 1);
      expect(harness.anchor('thread-1').status).toBe('orphaned');
      expect(clock.pendingCount).toBe(0);
    }

    // Paste the text back where it was. The next pass recovers the anchor.
    harness.dispatch(harness.state.tr.insertText('beta', beta.from));
    clock.advance(DEBOUNCE_MS);

    const recovered = harness.anchor('thread-1');
    expect(recovered.status).toBe('anchored');
    expect(harness.state.doc.textBetween(recovered.from, recovered.to, '\n')).toBe('beta');

    // And a recovered anchor is idle too — a healthy anchor must not re-arm the
    // debounce either.
    const transactionsAfterRecovery = harness.transactionCount;
    const timersAfterRecovery = clock.scheduledCount;

    for (let pass = 0; pass < IDLE_PASSES; pass += 1) {
      clock.advance(DEBOUNCE_MS);
    }

    expect(harness.transactionCount).toBe(transactionsAfterRecovery);
    expect(clock.scheduledCount).toBe(timersAfterRecovery);
    expect(clock.pendingCount).toBe(0);
  });
});
