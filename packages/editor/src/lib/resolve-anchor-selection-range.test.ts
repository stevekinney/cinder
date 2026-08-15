/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';
import {
  anchorPluginKey,
  createAnchorPlugin,
  resolveAnchorSelectionRange,
} from './anchor-decorations.js';
import type { Thread } from './comments/types.js';
import { createEditor } from './editor/editor.js';
import type { EditorState } from './editor/types.js';
import type { FakeClock } from './test/fake-clock.js';
import { installFakeClock } from './test/fake-clock.js';
import { setupHappyDom } from './test/happy-dom.js';

setupHappyDom();

/**
 * cinder#1304 — a PR review finding on the keyboard "next/previous comment"
 * navigation this issue's fix added: `navigateToAdjacentComment`
 * (review-editor-impl.svelte) used to read an anchor's position only from
 * `threads` (the component's own external state), converted to a body
 * position. An ordinary edit BEFORE an anchor maps this plugin's OWN
 * tracked position through the transaction immediately — the same live
 * position `computeDecorations` paints the visible highlight from — but
 * does not call `onAnchorsUpdate` (that only fires during deferred
 * re-anchoring), so `threads` can hold a stale position indefinitely after
 * such an edit, even though the anchor is neither orphaned nor visibly
 * wrong. `resolveAnchorSelectionRange` is the fix: prefer this plugin's
 * live state, falling back to the caller's (possibly stale) position only
 * when the plugin has no live entry.
 *
 * This drives a REAL editor with the REAL anchor plugin and a REAL
 * `view.dispatch()` insertion — not a hand-constructed position — so the
 * mapping under test is the same one `computeDecorations` and the plugin's
 * own `apply()` use, not a reimplementation of it. The insertion is
 * strictly inside an EXISTING paragraph's text (not at a block boundary):
 * a boundary-adjacent insertion (e.g. splitting a new block immediately
 * before the anchor's own start) hits a separate, pre-existing position-
 * mapping ambiguity in this plugin unrelated to this fix — reproduced
 * during development, confirmed independent of `resolveAnchorSelectionRange`
 * (it manifested identically with the fix fully reverted), and out of scope
 * for cinder#1302/#1304/#1306. An in-paragraph insertion avoids it while
 * still proving the exact claim the review finding made: a position shift
 * from an edit that never orphans or re-anchors the thread.
 */

let editorState: EditorState | undefined;
let clock: FakeClock | undefined;

/** See anchor-decorations-a11y.test.ts's afterEach for the fuller explanation. */
afterEach(async () => {
  clock?.advance(200);
  clock?.restore();
  clock = undefined;
  if (editorState) {
    editorState.markDestroyed();
    await editorState.editor.destroy();
    editorState = undefined;
  }
});

function makeThread(): Thread {
  return {
    id: 'thread-shift',
    createdAt: new Date().toISOString(),
    anchor: {
      // "Preface paragraph." occupies body positions 1..19 (18 chars); the
      // second paragraph opens at 20, its text starts at 21. "Commented" is
      // 9 characters: 21..30.
      from: 21,
      to: 30,
      quote: 'Commented',
      prefix: '',
      suffix: ' text follows in this paragraph.',
      status: 'anchored',
      originalQuote: 'Commented',
      lastKnownOffset: 20,
    },
    comments: [
      {
        id: 'comment-shift',
        threadId: 'thread-shift',
        authorId: 'reviewer',
        body: 'A note on this text.',
        createdAt: new Date().toISOString(),
      },
    ],
  };
}

describe('resolveAnchorSelectionRange (cinder#1304)', () => {
  test('prefers the live, edit-shifted plugin position over a stale cached one', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    const anchorPlugin = createAnchorPlugin();

    editorState = await createEditor(container, {
      initialContent: 'Preface paragraph.\n\nCommented text follows in this paragraph.',
      plugins: [anchorPlugin],
    });
    clock = installFakeClock();
    const { view } = editorState;
    if (!view) throw new Error('view not ready');

    view.dispatch(
      view.state.tr.setMeta(anchorPluginKey, {
        type: 'sync',
        threads: [makeThread()],
        source: 'external',
      }),
    );

    // Sanity: before any edit, the plugin's own live state agrees with the
    // thread's cached anchor — the two paths aren't discriminated yet.
    const beforeEdit = resolveAnchorSelectionRange(view, 'thread-shift', { from: 21, to: 30 });
    expect(beforeEdit).toEqual({ from: 21, to: 30 });
    expect(view.state.doc.textBetween(beforeEdit.from, beforeEdit.to)).toBe('Commented');

    // Insert 3 characters INSIDE "Preface paragraph." (position 5, strictly
    // between its open and close, not at a block boundary), shifting
    // everything after it — including the anchor — forward by exactly 3.
    view.dispatch(view.state.tr.insertText('XXX', 5));

    // The STALE fallback (what `threads` would still say, unaware of the
    // shift) now points 3 positions too early.
    const staleFallback = { from: 21, to: 30 };
    expect(view.state.doc.textBetween(staleFallback.from, staleFallback.to)).not.toBe('Commented');

    // The fix: resolveAnchorSelectionRange follows the live, mapped
    // position instead.
    const afterEdit = resolveAnchorSelectionRange(view, 'thread-shift', staleFallback);
    expect(afterEdit).toEqual({ from: 24, to: 33 });
    expect(view.state.doc.textBetween(afterEdit.from, afterEdit.to)).toBe('Commented');
  });

  test('falls back to the caller-provided range when the plugin has no live entry for the thread', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    const anchorPlugin = createAnchorPlugin();

    editorState = await createEditor(container, {
      initialContent: 'Preface paragraph.\n\nCommented text follows in this paragraph.',
      plugins: [anchorPlugin],
    });
    clock = installFakeClock();
    const { view } = editorState;
    if (!view) throw new Error('view not ready');

    // No sync dispatched — the plugin tracks no anchors at all.
    const fallback = { from: 21, to: 30 };
    expect(resolveAnchorSelectionRange(view, 'thread-never-synced', fallback)).toEqual(fallback);
  });
});
