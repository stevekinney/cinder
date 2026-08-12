/**
 * Orphan RECOVERY tests for the comment anchor plugin.
 *
 * `anchor-decorations.test.ts` covers meta-transaction bookkeeping with plain
 * objects. This file drives the real plugin against a real `EditorState` and a
 * minimal view, because the behaviour under test only exists in the interaction
 * between three pieces: the position mapping in `mapAnchorsThroughTransaction`,
 * the 300ms debounce in the plugin view, and `performDeferredReanchoring`.
 *
 * The sequence is deliberately the pessimistic one — the user pauses longer than
 * the debounce after cutting, so the anchor is genuinely marked `orphaned`
 * BEFORE the text comes back:
 *
 *   1. cut the commented text
 *   2. let the deferred pass run and mark the anchor `orphaned`
 *   3. paste the text back
 *   4. let the deferred pass run again
 *
 * Both re-insertion positions are covered, because they take different code
 * paths on step 3. Pasting at the SAME position expands the collapsed range back
 * onto the restored quote, so no drift is detected and only the fast path in
 * `performDeferredReanchoring` can clear the status. Pasting ELSEWHERE leaves
 * the range collapsed, so the full re-anchoring search runs instead.
 *
 * Either way the status must come back to `anchored`: an anchor left orphaned
 * with its own text sitting under it renders no decoration, which is the exact
 * failure the orphaning feature exists to avoid (cinder#1284).
 */

import { Schema } from '@milkdown/kit/prose/model';
import type { Plugin, Transaction } from '@milkdown/kit/prose/state';
import { EditorState } from '@milkdown/kit/prose/state';
import type { DecorationSet, EditorView } from '@milkdown/kit/prose/view';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import type { AnchorPluginState, AnchorState } from './anchor-decorations.js';
import { anchorPluginKey, createAnchorPlugin } from './anchor-decorations.js';
import type { AnchorUpdate, Thread } from './comments/types.js';
import type { FakeClock } from './test/fake-clock.js';
import { installFakeClock } from './test/fake-clock.js';

// ============================================================================
// Fixtures
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

const FIRST_PARAGRAPH = 'Alpha beta gamma delta.';
const SECOND_PARAGRAPH = 'Second paragraph here.';

/** The commented text, and its ProseMirror range in the pristine document. */
const QUOTE = 'beta gamma';
const QUOTE_FROM = 1 + FIRST_PARAGRAPH.indexOf(QUOTE);
const QUOTE_TO = QUOTE_FROM + QUOTE.length;

/** Start of the second paragraph's content, after the quote has been cut. */
const SECOND_PARAGRAPH_CONTENT_START =
  FIRST_PARAGRAPH.length - QUOTE.length + 2 /* p1 open + close */ + 1; /* p2 open */

const THREAD_ID = 'thread-1';

/**
 * Comfortably past the 300ms re-anchoring debounce, on a clock this file owns.
 *
 * No slack is needed and none is wanted: the earlier version of this file slept
 * for a real 450ms "plus slack for a loaded CI machine", which is a guess that
 * flakes when CI beats it and then invites a bigger guess. Advancing a fake
 * clock removes the wall clock from the test entirely.
 */
const PAST_DEBOUNCE = 400;

let clock: FakeClock | null = null;

beforeEach(() => {
  clock = installFakeClock();
});

afterEach(() => {
  clock?.restore();
  clock = null;
});

function createDocument() {
  return schema.node('doc', null, [
    schema.node('paragraph', null, [schema.text(FIRST_PARAGRAPH)]),
    schema.node('paragraph', null, [schema.text(SECOND_PARAGRAPH)]),
  ]);
}

function createSeedThread(): Thread {
  return {
    id: THREAD_ID,
    anchor: {
      from: QUOTE_FROM,
      to: QUOTE_TO,
      quote: QUOTE,
      originalQuote: QUOTE,
      prefix: FIRST_PARAGRAPH.slice(0, FIRST_PARAGRAPH.indexOf(QUOTE)),
      suffix: FIRST_PARAGRAPH.slice(FIRST_PARAGRAPH.indexOf(QUOTE) + QUOTE.length),
      status: 'anchored',
      lastKnownOffset: FIRST_PARAGRAPH.indexOf(QUOTE),
    },
    comments: [],
    createdAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
  };
}

// ============================================================================
// Harness
// ============================================================================

/** The shape `$prose` returns: a Milkdown plugin that hands back the PM one. */
type MilkdownProsePlugin = ((ctx: unknown) => () => Promise<unknown>) & {
  plugin: () => Plugin<AnchorPluginState>;
};

interface PluginViewLike {
  update?: ((view: EditorView, previousState: EditorState) => void) | undefined;
  destroy?: (() => void) | undefined;
}

/**
 * Drive the plugin without a DOM.
 *
 * `performDeferredReanchoring` only reads `view.state` and calls
 * `view.dispatch`, and the plugin's own view ignores the argument entirely, so
 * a real `EditorView` (and the DOM it needs) buys nothing here. Applying a
 * transaction mirrors what ProseMirror does: update the state, then notify the
 * plugin view — which is what schedules the debounced re-anchoring pass.
 */
class AnchorHarness {
  state: EditorState;
  readonly updates: AnchorUpdate[] = [];
  /** Transactions the plugin dispatched at us, as a runaway-loop tripwire. */
  dispatchCount = 0;
  private readonly pluginView: PluginViewLike | undefined;

  private constructor(plugin: Plugin<AnchorPluginState>, updates: AnchorUpdate[]) {
    this.state = EditorState.create({ doc: createDocument(), schema, plugins: [plugin] });
    this.updates = updates;
    this.pluginView = plugin.spec.view?.(this as unknown as EditorView) as
      | PluginViewLike
      | undefined;
  }

  static async create(): Promise<AnchorHarness> {
    const updates: AnchorUpdate[] = [];
    const milkdownPlugin = createAnchorPlugin({
      onAnchorsUpdate: (received) => updates.push(...received),
    }) as unknown as MilkdownProsePlugin;

    // `$prose(factory)` defers to `ctx.wait(SchemaReady)` and registers the
    // ProseMirror plugin on the editor's ctx. Our factory ignores the ctx, so a
    // stub is enough to get the plugin instance out.
    await milkdownPlugin({ wait: async () => undefined, update: () => undefined })();

    return new AnchorHarness(milkdownPlugin.plugin(), updates);
  }

  dispatch(tr: Transaction): void {
    this.dispatchCount += 1;
    const previousState = this.state;
    this.state = this.state.apply(tr);
    this.pluginView?.update?.(this as unknown as EditorView, previousState);
  }

  /** Seed the plugin the way ReviewEditor does, via a `sync` meta-transaction. */
  sync(threads: Thread[]): void {
    this.dispatch(
      this.state.tr.setMeta(anchorPluginKey, { type: 'sync', threads, source: 'external' }),
    );
  }

  get pluginState(): AnchorPluginState {
    const pluginState = anchorPluginKey.getState(this.state);
    if (!pluginState) throw new Error('anchor plugin state missing');
    return pluginState;
  }

  get anchor(): AnchorState {
    const anchor = this.pluginState.anchors.get(THREAD_ID);
    if (!anchor) throw new Error(`anchor ${THREAD_ID} was dropped from plugin state`);
    return anchor;
  }

  get decoratedRanges(): Array<{ from: number; to: number }> {
    const plugin = this.state.plugins.find((candidate) => candidate.spec.key === anchorPluginKey);
    const decorations = plugin?.props.decorations?.call(plugin, this.state) as
      | DecorationSet
      | null
      | undefined;
    return (decorations?.find() ?? []).map(({ from, to }) => ({ from, to }));
  }

  get documentText(): string {
    return this.state.doc.textBetween(0, this.state.doc.content.size, '\n');
  }

  /**
   * Cross the debounce so the deferred re-anchoring pass runs.
   *
   * `advance` fires the pass synchronously; the awaited microtask that follows
   * lets anything the pass scheduled as a promise settle before assertions.
   */
  async settle(): Promise<void> {
    clock?.advance(PAST_DEBOUNCE);
    await Promise.resolve();
  }

  destroy(): void {
    this.pluginView?.destroy?.();
  }
}

/**
 * Cut the commented text and let the deferred pass conclude it is gone.
 *
 * Returns a harness whose single anchor is `orphaned` — the precondition every
 * test here shares, asserted rather than assumed.
 */
async function createOrphanedHarness(): Promise<AnchorHarness> {
  const harness = await AnchorHarness.create();
  harness.sync([createSeedThread()]);

  expect(harness.anchor.status).toBe('anchored');
  expect(harness.decoratedRanges).toEqual([{ from: QUOTE_FROM, to: QUOTE_TO }]);

  harness.dispatch(harness.state.tr.delete(QUOTE_FROM, QUOTE_TO));
  await harness.settle();

  expect(harness.anchor.status).toBe('orphaned');
  expect(harness.decoratedRanges).toEqual([]);
  expect(harness.updates.at(-1)?.status).toBe('orphaned');

  return harness;
}

// ============================================================================
// Tests
// ============================================================================

describe('an orphaned anchor recovers when its text comes back', () => {
  test('the setup itself orphans: cutting past the debounce keeps the thread, undecorated', async () => {
    const harness = await createOrphanedHarness();

    try {
      expect(harness.pluginState.anchors.size).toBe(1);
      expect(harness.documentText).toBe('Alpha  delta.\nSecond paragraph here.');
      expect(harness.anchor.quote).toBe(QUOTE);
    } finally {
      harness.destroy();
    }
  });

  test('pasting back at the SAME position clears the orphaned status', async () => {
    const harness = await createOrphanedHarness();

    try {
      harness.dispatch(harness.state.tr.insert(QUOTE_FROM, schema.text(QUOTE)));

      // The insertion mapping expands the collapsed range straight back onto the
      // restored quote, so nothing looks like drift at mapping time. The status
      // therefore survives this transaction; only the deferred pass can clear it.
      expect(harness.anchor.status).toBe('orphaned');
      expect(harness.anchor.from).toBe(QUOTE_FROM);
      expect(harness.anchor.to).toBe(QUOTE_TO);

      await harness.settle();

      expect(harness.documentText).toBe('Alpha beta gamma delta.\nSecond paragraph here.');
      expect(harness.anchor.status).toBe('anchored');
      expect(harness.anchor.from).toBe(QUOTE_FROM);
      expect(harness.anchor.to).toBe(QUOTE_TO);
      expect(harness.decoratedRanges).toEqual([{ from: QUOTE_FROM, to: QUOTE_TO }]);
      expect(harness.updates.at(-1)).toMatchObject({
        threadId: THREAD_ID,
        status: 'anchored',
        quote: QUOTE,
        from: QUOTE_FROM,
        to: QUOTE_TO,
      });
    } finally {
      harness.destroy();
    }
  });

  test('pasting back at a DIFFERENT position clears the orphaned status', async () => {
    const harness = await createOrphanedHarness();

    try {
      harness.dispatch(
        harness.state.tr.insert(SECOND_PARAGRAPH_CONTENT_START, schema.text(`${QUOTE} `)),
      );

      // Nothing maps onto the anchor this time — it stays collapsed where the
      // text used to be, so recovery has to come from the re-anchoring search.
      expect(harness.anchor.status).toBe('orphaned');
      expect(harness.anchor.from).toBe(harness.anchor.to);

      await harness.settle();

      expect(harness.documentText).toBe('Alpha  delta.\nbeta gamma Second paragraph here.');
      expect(harness.anchor.status).toBe('anchored');
      expect(harness.anchor.from).toBe(SECOND_PARAGRAPH_CONTENT_START);
      expect(harness.anchor.to).toBe(SECOND_PARAGRAPH_CONTENT_START + QUOTE.length);
      expect(harness.decoratedRanges).toEqual([
        {
          from: SECOND_PARAGRAPH_CONTENT_START,
          to: SECOND_PARAGRAPH_CONTENT_START + QUOTE.length,
        },
      ]);
      expect(harness.updates.at(-1)).toMatchObject({
        threadId: THREAD_ID,
        status: 'anchored',
        quote: QUOTE,
      });
    } finally {
      harness.destroy();
    }
  });

  // The "does the orphan reschedule forever?" case lived here too; it is covered
  // more thoroughly in anchor-decorations-orphan-loop.test.ts, which counts
  // armed timers against a controllable clock rather than just dispatches.
});
