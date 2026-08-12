/**
 * Regression tests: a restored orphan keeps its disambiguation hint.
 *
 * `lastKnownOffset` is a `doc.textBetween()` offset, and it is the only thing
 * `reanchorQuote` has to choose between repeated occurrences of the same quote:
 * when the context around each occurrence is identical (boilerplate, a repeated
 * checklist row, a table of near-identical entries), context scoring ties and
 * proximity to that offset decides the winner.
 *
 * `toRuntimeThreads`/`setState` restore a persisted anchor at the unplaced
 * `0`/`0` sentinel while keeping the saved `lastKnownOffset`, so for a restored
 * ORPHAN the range says "nowhere" and the offset says "here is where it used to
 * be". Recomputing the offset from that sentinel range yields offset 0, which
 * silently trades the saved location for the top of the document, and the
 * recovered anchor attaches to the FIRST occurrence of its quote rather than
 * the one the comment was written against.
 *
 * These tests drive the real plugin against a real `EditorState` with a
 * controllable clock in place of the 300ms debounce. No DOM required: the
 * plugin view touches only `view.state` and `view.dispatch`.
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
import type { FakeClock } from './test/fake-clock.js';
import { installFakeClock } from './test/fake-clock.js';

// ============================================================================
// Fixture
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

/**
 * A repeated row whose quote is surrounded by more than 50 characters of
 * identical text on both sides.
 *
 * That is what makes the test measure the right thing: the plugin stores a
 * 50-character prefix and suffix, so every occurrence of QUOTE scores an
 * identical 1.0 on context and only the proximity hint can separate them.
 */
const LEAD = 'Milestone review checklist for the current release cycle. ';
const QUOTE = 'Owner: TBD.';
const TRAIL = ' Assign an owner before the release train departs on Friday.';

const ROW = `${LEAD}${QUOTE}${TRAIL}`;
const ROW_WITHOUT_QUOTE = `${LEAD}${TRAIL}`;

const PREFIX = LEAD.slice(-50);
const SUFFIX = TRAIL.slice(0, 50);

const THREAD_ID = 'thread-owner';
const DEBOUNCE_MS = 300;

if (LEAD.length < 50 || TRAIL.length < 50) {
  throw new Error('Fixture context must exceed the 50-character prefix/suffix window');
}

function makeDoc(...paragraphs: string[]): ProseMirrorNode {
  return schema.node(
    'doc',
    null,
    paragraphs.map((text) =>
      schema.node('paragraph', null, text.length > 0 ? [schema.text(text)] : []),
    ),
  );
}

function documentTextOf(doc: ProseMirrorNode): string {
  return doc.textBetween(0, doc.content.size, '\n');
}

/** Text offset (not a ProseMirror position) of the nth occurrence, 0-based. */
function textOffsetOfOccurrence(doc: ProseMirrorNode, quote: string, occurrence: number): number {
  const text = documentTextOf(doc);
  let index = -1;
  for (let seen = 0; seen <= occurrence; seen += 1) {
    index = text.indexOf(quote, index + 1);
    if (index === -1) throw new Error(`Fixture has fewer than ${occurrence + 1} occurrences`);
  }
  return index;
}

/** ProseMirror position of the nth occurrence, verified against `textBetween`. */
function positionOfOccurrence(doc: ProseMirrorNode, quote: string, occurrence: number): number {
  const found: number[] = [];
  doc.descendants((node, pos) => {
    const text = node.text;
    if (!node.isText || text === undefined) return true;
    let index = text.indexOf(quote);
    while (index !== -1) {
      found.push(pos + index);
      index = text.indexOf(quote, index + 1);
    }
    return true;
  });

  const position = found[occurrence];
  if (position === undefined) throw new Error(`Fixture has fewer than ${occurrence + 1} matches`);
  if (doc.textBetween(position, position + quote.length, '\n') !== quote) {
    throw new Error(`Computed position ${position} does not read ${quote}`);
  }
  return position;
}

/**
 * A thread as `toRuntimeThreads` hands it back: the saved quote, context, and
 * `lastKnownOffset`, with the range replaced by the unplaced `0`/`0` sentinel.
 */
function restoredOrphanThread(lastKnownOffset: number): Thread {
  return {
    id: THREAD_ID,
    anchor: {
      from: 0,
      to: 0,
      quote: QUOTE,
      originalQuote: QUOTE,
      prefix: PREFIX,
      suffix: SUFFIX,
      status: 'orphaned',
      lastKnownOffset,
    },
    comments: [],
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

// ============================================================================
// Harness
// ============================================================================

type MilkdownProsePlugin = {
  (ctx: {
    wait: (timer: unknown) => Promise<void>;
    update: (slice: unknown, updater: (plugins: Plugin[]) => Plugin[]) => void;
  }): () => Promise<unknown>;
  plugin: () => Plugin;
};

interface Harness {
  readonly state: EditorState;
  readonly updates: AnchorUpdate[];
  readonly documentText: string;
  dispatch(transaction: Transaction): void;
  syncThreads(threads: Thread[]): void;
  pluginState(): AnchorPluginState;
  anchor(): AnchorState;
  destroy(): void;
}

async function createHarness(doc: ProseMirrorNode): Promise<Harness> {
  const updates: AnchorUpdate[] = [];
  const milkdownPlugin = createAnchorPlugin({
    onAnchorsUpdate: (received) => updates.push(...received),
  }) as unknown as MilkdownProsePlugin;

  await milkdownPlugin({ wait: async () => {}, update: () => {} })();
  const prosePlugin = milkdownPlugin.plugin();

  let state = EditorState.create({ schema, doc, plugins: [prosePlugin] });
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
      state = state.apply(transaction);
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
    get documentText() {
      return documentTextOf(state.doc);
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
    anchor() {
      const anchor = pluginState().anchors.get(THREAD_ID);
      if (!anchor) throw new Error(`no anchor tracked for ${THREAD_ID}`);
      return anchor;
    },
    destroy() {
      pluginView.destroy?.();
    },
  };
}

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

describe('a restored orphan keeps its disambiguation offset', () => {
  test('an unrelated edit does not replace the saved offset with the top of the document', async () => {
    // No row carries the quote, so the thread stays orphaned across the whole
    // test and nothing but the mapping can touch its hint. The saved offset is
    // the one the fourth row held when the comment was written.
    const doc = makeDoc(ROW_WITHOUT_QUOTE, ROW_WITHOUT_QUOTE, ROW_WITHOUT_QUOTE, ROW_WITHOUT_QUOTE);
    const savedOffset = documentTextOf(makeDoc(ROW, ROW, ROW, ROW)).lastIndexOf(QUOTE);

    harness = await createHarness(doc);
    clock = installFakeClock();

    harness.syncThreads([restoredOrphanThread(savedOffset)]);
    expect(harness.anchor().status).toBe('orphaned');
    expect(harness.anchor().lastKnownOffset).toBe(savedOffset);

    // Any edit anywhere: typing a character at the end of the document.
    harness.dispatch(harness.state.tr.insertText('!', harness.state.doc.content.size - 1));

    expect(harness.anchor().lastKnownOffset).toBe(savedOffset);

    // And the deferred retry that edit schedules must not lose it either.
    clock.advance(DEBOUNCE_MS);
    expect(harness.anchor().status).toBe('orphaned');
    expect(harness.anchor().lastKnownOffset).toBe(savedOffset);
  });

  test('the recovered anchor lands on the occurrence it was written against', async () => {
    const doc = makeDoc(ROW, ROW, ROW, ROW_WITHOUT_QUOTE);
    const restoredDoc = makeDoc(ROW, ROW, ROW, ROW);
    const savedOffset = documentTextOf(restoredDoc).lastIndexOf(QUOTE);
    const fourthRowPosition = positionOfOccurrence(restoredDoc, QUOTE, 3);
    const firstRowPosition = positionOfOccurrence(restoredDoc, QUOTE, 0);

    harness = await createHarness(doc);
    clock = installFakeClock();

    harness.syncThreads([restoredOrphanThread(savedOffset)]);
    expect(harness.anchor().status).toBe('orphaned');

    // The user types the missing text back into the fourth row. Every
    // occurrence now carries identical context, so nothing but the proximity
    // hint can tell the plugin which one the comment belongs to.
    harness.dispatch(harness.state.tr.insertText(QUOTE, fourthRowPosition));
    expect(harness.documentText).toBe(documentTextOf(restoredDoc));
    expect(textOffsetOfOccurrence(harness.state.doc, QUOTE, 3)).toBe(savedOffset);

    clock.advance(DEBOUNCE_MS);

    const recovered = harness.anchor();
    expect(recovered.status).toBe('anchored');
    expect(recovered.from).toBe(fourthRowPosition);
    expect(recovered.to).toBe(fourthRowPosition + QUOTE.length);
    expect(recovered.from).not.toBe(firstRowPosition);
    expect(harness.updates.at(-1)).toMatchObject({
      threadId: THREAD_ID,
      status: 'anchored',
      lastKnownOffset: savedOffset,
    });
  });

  test('an in-session orphan still tracks the document as text is inserted above it', async () => {
    // The other half of the contract: an anchor that collapsed HERE has a real
    // collapse point, and its hint must keep following the document. Only the
    // unplaced sentinel is exempt from recomputation.
    const doc = makeDoc(ROW, ROW, ROW, ROW);
    const fourthRowPosition = positionOfOccurrence(doc, QUOTE, 3);
    const fourthRowOffset = textOffsetOfOccurrence(doc, QUOTE, 3);

    harness = await createHarness(doc);
    clock = installFakeClock();

    harness.syncThreads([
      {
        id: THREAD_ID,
        anchor: {
          from: fourthRowPosition,
          to: fourthRowPosition + QUOTE.length,
          quote: QUOTE,
          originalQuote: QUOTE,
          prefix: PREFIX,
          suffix: SUFFIX,
          status: 'anchored',
          lastKnownOffset: fourthRowOffset,
        },
        comments: [],
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]);

    // Delete every occurrence, newest first, so the quote is genuinely gone and
    // the anchor orphans against a real collapse point in the fourth row.
    for (let occurrence = 3; occurrence >= 0; occurrence -= 1) {
      const position = positionOfOccurrence(harness.state.doc, QUOTE, occurrence);
      harness.dispatch(harness.state.tr.delete(position, position + QUOTE.length));
    }
    clock.advance(DEBOUNCE_MS);
    expect(harness.anchor().status).toBe('orphaned');

    const collapsedOffset = harness.anchor().lastKnownOffset;
    expect(collapsedOffset).toBeGreaterThan(0);

    // Insert text above the collapse point; the hint has to move with it.
    const inserted = 'Prelude paragraph. ';
    harness.dispatch(harness.state.tr.insertText(inserted, 1));

    expect(harness.anchor().lastKnownOffset).toBe((collapsedOffset ?? 0) + inserted.length);
  });

  test('a new paragraph at the very top of the document does not consume the offset', async () => {
    // The sentinel is `0`/`0`, and an insertion AT position 0 expands it
    // (`map(0, -1)` stays put while `map(0, 1)` moves past the new node) instead
    // of leaving it collapsed. The anchor takes the drifted branch rather than
    // the collapsed one, which is a second way to lose the same hint.
    const doc = makeDoc(ROW, ROW, ROW, ROW_WITHOUT_QUOTE);
    const savedOffset = documentTextOf(makeDoc(ROW, ROW, ROW, ROW)).lastIndexOf(QUOTE);

    harness = await createHarness(doc);
    clock = installFakeClock();

    harness.syncThreads([restoredOrphanThread(savedOffset)]);
    harness.dispatch(
      harness.state.tr.insert(0, schema.node('paragraph', null, [schema.text('New top line.')])),
    );

    expect(harness.anchor().status).toBe('orphaned');
    expect(harness.anchor().lastKnownOffset).toBe(savedOffset);
  });
});
