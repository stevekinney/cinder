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

import type { Node as ProseMirrorNode } from '@milkdown/kit/prose/model';
import { Schema } from '@milkdown/kit/prose/model';
import type { Plugin, Transaction } from '@milkdown/kit/prose/state';
import { EditorState } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { afterEach, describe, expect, test } from 'bun:test';

import type { AnchorPluginState, AnchorState } from './anchor-decorations.js';
import { anchorPluginKey, createAnchorPlugin } from './anchor-decorations.js';
import type { AnchorUpdate, Thread } from './comments/types.js';

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
// Controllable clock
// ============================================================================

interface FakeClock {
  /** Fire every timer due at or before `now + ms`. Timers scheduled by a firing
   *  timer are NOT fired in the same advance — that is how a self-rescheduling
   *  loop stays visible instead of running away inside one call. */
  advance(ms: number): void;
  /** Total `setTimeout` calls since install. */
  readonly scheduledCount: number;
  /** Timers currently armed. */
  readonly pendingCount: number;
  restore(): void;
}

function installFakeClock(): FakeClock {
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;

  let now = 0;
  let nextId = 1;
  let scheduledCount = 0;
  const pending = new Map<number, { callback: () => void; dueAt: number }>();

  globalThis.setTimeout = ((callback: () => void, delay = 0) => {
    const id = nextId++;
    scheduledCount += 1;
    pending.set(id, { callback, dueAt: now + delay });
    return id as unknown as ReturnType<typeof setTimeout>;
  }) as unknown as typeof setTimeout;

  globalThis.clearTimeout = ((id: unknown) => {
    if (typeof id === 'number') pending.delete(id);
  }) as unknown as typeof clearTimeout;

  return {
    advance(ms: number) {
      now += ms;
      const due = [...pending.entries()]
        .filter(([, timer]) => timer.dueAt <= now)
        .sort((a, b) => a[1].dueAt - b[1].dueAt);
      for (const [id, timer] of due) {
        pending.delete(id);
        timer.callback();
      }
    },
    get scheduledCount() {
      return scheduledCount;
    },
    get pendingCount() {
      return pending.size;
    },
    restore() {
      globalThis.setTimeout = originalSetTimeout;
      globalThis.clearTimeout = originalClearTimeout;
    },
  };
}

// ============================================================================
// Harness
// ============================================================================

/**
 * `createAnchorPlugin` returns a Milkdown `$prose` wrapper. Running its
 * initializer with a stub ctx hands back the real ProseMirror plugin.
 */
type MilkdownProsePlugin = {
  (ctx: {
    wait: (timer: unknown) => Promise<void>;
    update: (slice: unknown, updater: (plugins: Plugin[]) => Plugin[]) => void;
  }): () => Promise<unknown>;
  plugin: () => Plugin;
};

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
  const milkdownPlugin = createAnchorPlugin({
    onAnchorsUpdate: (received) => updates.push(...received),
  }) as unknown as MilkdownProsePlugin;

  const initialize = milkdownPlugin({
    wait: async () => {},
    update: () => {},
  });
  await initialize();
  const prosePlugin = milkdownPlugin.plugin();

  let state = EditorState.create({ schema, doc, plugins: [prosePlugin] });
  let transactionCount = 0;
  let pluginView: {
    update?: (view: EditorView, previous: EditorState) => void;
    destroy?: () => void;
  } = {};

  const view = {
    get state() {
      return state;
    },
    dispatch(transaction: Transaction) {
      const previous = state;
      transactionCount += 1;
      state = state.apply(transaction);
      // Real ProseMirror notifies every plugin view after `updateState`.
      pluginView.update?.(view as unknown as EditorView, previous);
    },
  };

  pluginView = prosePlugin.spec.view?.(view as unknown as EditorView) ?? {};

  function pluginState(): AnchorPluginState {
    const current = anchorPluginKey.getState(state);
    if (!current) throw new Error('anchor plugin state missing');
    return current;
  }

  return {
    get state() {
      return state;
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
        state.tr.setMeta(anchorPluginKey, { type: 'sync', threads, source: 'external' }),
      );
    },
    pluginState,
    anchor(threadId) {
      const anchor = pluginState().anchors.get(threadId);
      if (!anchor) throw new Error(`no anchor tracked for ${threadId}`);
      return anchor;
    },
    destroy() {
      pluginView.destroy?.();
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
