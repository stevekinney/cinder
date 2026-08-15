/// <reference lib="dom" />
import type { Node as ProseMirrorNode } from '@milkdown/prose/model';
import { Selection, TextSelection } from '@milkdown/prose/state';
import { afterEach, describe, expect, test } from 'bun:test';
import type { FakeClock } from '../test/fake-clock.js';
import { drainMount, installFakeClock } from '../test/fake-clock.js';
import { setupHappyDom } from '../test/happy-dom.js';
import { createEditor } from './editor.js';
import type { EditorState } from './types.js';

setupHappyDom();

/**
 * cinder#1302 — the commonmark preset's OWN `listItemKeymap` binds plain
 * Tab/Shift-Tab to sink/lift-list-item independently of createEditorKeymap's
 * Tab-escape latch (keymap-plugin.ts). Both get merged into a single
 * ProseMirror keymap plugin by Milkdown's KeymapManager, and the preset's
 * handler registered first, so it always ran before the latch-aware one got a
 * chance — a successful sink/lift returns `true`, which ends the chain and
 * preventDefaults the key. #1285's Escape-then-Tab release was therefore
 * unreachable in a real editor: this suite boots the real commonmark preset
 * (unlike keymap-plugin.test.ts, which drives `createKeymapBindings` directly
 * against a bare Schema/EditorView and cannot see this interaction at all) so
 * the merge itself is under test, not just the latch's own bookkeeping.
 *
 * Every test asserts on `event.defaultPrevented`, not just on the resulting
 * document: prosemirror-view only calls `event.preventDefault()` when its
 * merged `handleKeyDown` chain returns `true` (see
 * node_modules/prosemirror-view's `editHandlers.keydown`), so
 * `defaultPrevented === false` is what actually tells the browser to move
 * focus. A document-only assertion could pass even if the handler still
 * returned `true` for an unrelated reason (e.g. a no-op sink at the end of a
 * list), so both are checked everywhere the latch is expected to release.
 */

let editorState: EditorState | undefined;
let clock: FakeClock | undefined;

/**
 * `@milkdown/plugin-listener`'s own `markdownUpdated`/`updated` dispatch is
 * internally debounced 200ms via `lodash-es` — separate from and invisible
 * to `editor.ts`'s own `changeDebounceMs`. This suite's tests dispatch many
 * structural mutations (sink/lift, table-cell nav) and then `afterEach`
 * destroys the editor well under 200ms later, so that debounce is usually
 * still pending at destroy time. Left to fire on its own schedule, it lands
 * AFTER the context this file already destroyed is gone — `serializer(doc)`
 * needs `editorViewCtx` for some node types — throwing "Context editorView
 * not found" as an unhandled rejection. Worse, since nothing in this file is
 * still running by then, it doesn't even surface here: it fires whenever its
 * real 200ms elapses, which in a shared bun test process is usually during
 * the NEXT test file's own async editor mount, misattributed there.
 *
 * The fix is a controllable clock, not a longer wait: advance one past
 * 200ms in `afterEach`, BEFORE destroying the editor, so the debounced
 * callback fires deterministically while the editor (and its context) is
 * still alive, consuming it safely instead of leaving a real timer armed
 * against a context this file is about to tear down. The clock is also
 * restored BEFORE `destroy()` runs, not after: `destroy()`'s own teardown
 * may itself schedule real timers, and anything scheduled while the fake
 * clock is still installed lands in its pending map and never fires —
 * restoring first hands control back to real timers for whatever destroy
 * itself needs.
 */
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

function dispatchKeydown(target: EventTarget, init: KeyboardEventInit & { key: string }): Event {
  const event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
}

/** Mirrors prosemirror-keymap's own mac detection, so Mod- resolves to the same physical key. */
function isMacPlatform(): boolean {
  return /Mac|iP(hone|[oa]d)/.test(navigator.platform);
}

async function mountListEditor(): Promise<EditorState> {
  const container = document.createElement('div');
  document.body.append(container);
  // Installed BEFORE createEditor(), not after: a real timer createEditor's
  // own startup arms is otherwise captured by NOTHING (this suite's earlier
  // late-install left such a timer real, defeating the whole point of a
  // fake clock for it) — see drainMount's own doc comment above for why a
  // bare `await` can't be used once the clock is installed first.
  clock = installFakeClock();
  return drainMount(
    createEditor(container, {
      // The last block is a list item that is NOT the first item of its
      // list — the exact shape the issue's repro requires (a non-first item
      // is what makes sink/lift succeed and therefore swallow the key).
      initialContent: '- First\n- Second',
    }),
    clock,
  );
}

async function mountPlainEditor(): Promise<EditorState> {
  const container = document.createElement('div');
  document.body.append(container);
  clock = installFakeClock();
  return drainMount(
    // No list, no table — sinkListItem/liftListItem/cell-nav all have
    // nothing to act on here, the scenario the Mod-]/Mod-[
    // browser-navigation-collision review finding is about.
    createEditor(container, { initialContent: 'Just a plain paragraph.' }),
    clock,
  );
}

async function mountTableEditor(): Promise<EditorState> {
  const container = document.createElement('div');
  document.body.append(container);
  clock = installFakeClock();
  return drainMount(
    createEditor(container, {
      // A two-cell header row. Caret in cell "A" (not the table's LAST
      // cell) is where goToNextTableCellCommand legitimately succeeds — the
      // table's analogue of "not the first list item" above.
      initialContent: '| A | B |\n| --- | --- |',
    }),
    clock,
  );
}

/** Position right after the given text's own text node — a valid caret spot inside it. */
function findTextEnd(doc: ProseMirrorNode, text: string): number {
  let result: number | null = null;
  doc.descendants((node, pos) => {
    if (result !== null) return false;
    if (node.isText && node.text === text) {
      result = pos + node.nodeSize;
    }
    return true;
  });
  if (result === null) throw new Error(`text ${JSON.stringify(text)} not found in doc`);
  return result;
}

describe('createEditor: Tab-escape latch vs. the commonmark list keymap (cinder#1302)', () => {
  test('plain Tab in a non-first list item still indents (the legitimate affordance is preserved)', async () => {
    editorState = await mountListEditor();
    const { view } = editorState;
    if (!view) throw new Error('view not ready');

    view.dispatch(view.state.tr.setSelection(Selection.atEnd(view.state.doc)));
    const before = editorState.getMarkdown();

    const event = dispatchKeydown(view.dom, { key: 'Tab', keyCode: 9 });

    expect(event.defaultPrevented).toBe(true);
    expect(editorState.getMarkdown()).not.toBe(before);
  });

  test('Escape then Tab releases the key instead of indenting (WCAG 2.1.2 escape actually works)', async () => {
    editorState = await mountListEditor();
    const { view } = editorState;
    if (!view) throw new Error('view not ready');

    view.dispatch(view.state.tr.setSelection(Selection.atEnd(view.state.doc)));

    dispatchKeydown(view.dom, { key: 'Escape', keyCode: 27 });
    const before = editorState.getMarkdown();

    const tabEvent = dispatchKeydown(view.dom, { key: 'Tab', keyCode: 9 });

    // The commonmark preset's own listItemKeymap must not consume this Tab:
    // the document is untouched, and the key is declined (defaultPrevented
    // stays false) so the browser moves focus out of the editor instead.
    expect(tabEvent.defaultPrevented).toBe(false);
    expect(editorState.getMarkdown()).toBe(before);
  });

  test('Escape then Shift-Tab releases the key too (both directions of the trap)', async () => {
    editorState = await mountListEditor();
    const { view } = editorState;
    if (!view) throw new Error('view not ready');

    view.dispatch(view.state.tr.setSelection(Selection.atEnd(view.state.doc)));

    dispatchKeydown(view.dom, { key: 'Escape', keyCode: 27 });
    const before = editorState.getMarkdown();

    const shiftTabEvent = dispatchKeydown(view.dom, { key: 'Tab', keyCode: 9, shiftKey: true });

    expect(shiftTabEvent.defaultPrevented).toBe(false);
    expect(editorState.getMarkdown()).toBe(before);
  });

  test('Mod-]/Mod-[ still sink/lift after the plain Tab/Shift-Tab strip', async () => {
    editorState = await mountListEditor();
    const { view } = editorState;
    if (!view) throw new Error('view not ready');

    view.dispatch(view.state.tr.setSelection(Selection.atEnd(view.state.doc)));
    const mac = isMacPlatform();

    const sunk = editorState.getMarkdown();
    const sinkEvent = dispatchKeydown(view.dom, {
      key: ']',
      metaKey: mac,
      ctrlKey: !mac,
    });
    expect(sinkEvent.defaultPrevented).toBe(true);
    expect(editorState.getMarkdown()).not.toBe(sunk);

    const lifted = editorState.getMarkdown();
    const liftEvent = dispatchKeydown(view.dom, {
      key: '[',
      metaKey: mac,
      ctrlKey: !mac,
    });
    expect(liftEvent.defaultPrevented).toBe(true);
    expect(editorState.getMarkdown()).not.toBe(lifted);
  });

  test('Mod-] on the FIRST list item still preventDefaults, even though sink has nothing to nest under', async () => {
    // cinder#1302 review finding: on macOS, Mod-]/Mod-[ resolve to Cmd+]/
    // Cmd+[ — browser Back/Forward. sinkListItem legitimately returns false
    // for the first item of a list (nothing to nest it under), and
    // prosemirror-keymap only preventDefaults when a bound handler returns
    // true — so before this fix, THIS specific keystroke fell through to
    // the browser, silently navigating away from the editor.
    editorState = await mountListEditor();
    const { view } = editorState;
    if (!view) throw new Error('view not ready');

    // "First" is the doc's first list item — caret at its end.
    const pos = findTextEnd(view.state.doc, 'First');
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, pos)));
    const mac = isMacPlatform();
    const before = editorState.getMarkdown();

    const event = dispatchKeydown(view.dom, { key: ']', metaKey: mac, ctrlKey: !mac });

    expect(event.defaultPrevented).toBe(true);
    // Confirms the premise: sink genuinely had nothing to do here (the
    // document is unchanged), so a naive "return whatever the command
    // returned" binding would have declined the key.
    expect(editorState.getMarkdown()).toBe(before);
  });

  test('an Escape that only dismisses something (no Tab follows) does not arm a stale trap release', async () => {
    // Guards against over-correcting: the latch must still require Escape
    // IMMEDIATELY before Tab. Typing after Escape invalidates the latch, so a
    // later Tab must go back to indenting rather than leaking focus out.
    editorState = await mountListEditor();
    const { view } = editorState;
    if (!view) throw new Error('view not ready');

    view.dispatch(view.state.tr.setSelection(Selection.atEnd(view.state.doc)));
    dispatchKeydown(view.dom, { key: 'Escape', keyCode: 27 });

    // Simulate the user continuing to edit instead of tabbing away.
    view.dispatch(view.state.tr.insertText('!'));

    const before = editorState.getMarkdown();
    const tabEvent = dispatchKeydown(view.dom, { key: 'Tab', keyCode: 9 });

    expect(tabEvent.defaultPrevented).toBe(true);
    expect(editorState.getMarkdown()).not.toBe(before);
  });
});

/**
 * cinder#1302 also covers GFM's `tableKeymap`, found while implementing the
 * list fix above: it binds plain Tab/Shift-Tab to next/previous-cell with the
 * identical "registers before the latch, and a successful command
 * preventDefaults" shape — and at HIGHER priority (100 vs. the list keymap's
 * default 50), so it would have won the merge even more decisively.
 */
describe('createEditor: Tab-escape latch vs. the GFM table keymap (cinder#1302, same trap one node type over)', () => {
  test('plain Tab in a non-last table cell still moves to the next cell (the legitimate affordance is preserved)', async () => {
    editorState = await mountTableEditor();
    const { view } = editorState;
    if (!view) throw new Error('view not ready');

    const pos = findTextEnd(view.state.doc, 'A');
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, pos)));

    const event = dispatchKeydown(view.dom, { key: 'Tab', keyCode: 9 });

    expect(event.defaultPrevented).toBe(true);
    expect(view.state.selection.from).toBeGreaterThan(pos);
  });

  test('Escape then Tab releases the key instead of moving to the next cell', async () => {
    editorState = await mountTableEditor();
    const { view } = editorState;
    if (!view) throw new Error('view not ready');

    const pos = findTextEnd(view.state.doc, 'A');
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, pos)));

    dispatchKeydown(view.dom, { key: 'Escape', keyCode: 27 });
    const beforeSelection = view.state.selection.from;

    const tabEvent = dispatchKeydown(view.dom, { key: 'Tab', keyCode: 9 });

    expect(tabEvent.defaultPrevented).toBe(false);
    expect(view.state.selection.from).toBe(beforeSelection);
  });

  test('Mod-]/Mod-[ still move between table cells after the plain Tab/Shift-Tab strip', async () => {
    editorState = await mountTableEditor();
    const { view } = editorState;
    if (!view) throw new Error('view not ready');

    const pos = findTextEnd(view.state.doc, 'A');
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, pos)));
    const mac = isMacPlatform();

    const nextEvent = dispatchKeydown(view.dom, { key: ']', metaKey: mac, ctrlKey: !mac });
    expect(nextEvent.defaultPrevented).toBe(true);
    expect(view.state.selection.from).toBeGreaterThan(pos);

    const afterNext = view.state.selection.from;
    const prevEvent = dispatchKeydown(view.dom, { key: '[', metaKey: mac, ctrlKey: !mac });
    expect(prevEvent.defaultPrevented).toBe(true);
    expect(view.state.selection.from).toBeLessThan(afterNext);
  });

  test('Mod-] in the LAST table cell still preventDefaults, even though cell-nav has nowhere to go', async () => {
    // Same cinder#1302 review finding as the list-item test above, for the
    // table analogue: goToNextTableCellCommand legitimately returns false
    // in the last cell.
    editorState = await mountTableEditor();
    const { view } = editorState;
    if (!view) throw new Error('view not ready');

    const pos = findTextEnd(view.state.doc, 'B');
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, pos)));
    const mac = isMacPlatform();
    const beforeSelection = view.state.selection.from;

    const event = dispatchKeydown(view.dom, { key: ']', metaKey: mac, ctrlKey: !mac });

    expect(event.defaultPrevented).toBe(true);
    expect(view.state.selection.from).toBe(beforeSelection);
  });
});

/**
 * cinder#1302 review finding: Mod-]/Mod-[ resolve to Cmd+]/Cmd+] on macOS —
 * browser Back/Forward — and must never reach the browser while this editor
 * has focus, with or without a list or table anywhere in the document. The
 * two suites above prove the "structural command legitimately declines"
 * case; this proves the simpler "no list, no table, nothing structural
 * applies at all" case the review finding's own repro leads with.
 */
describe('createEditor: Mod-]/Mod-[ never reach the browser, even with no list or table at all (cinder#1302)', () => {
  test('Mod-] in plain prose preventDefaults', async () => {
    editorState = await mountPlainEditor();
    const { view } = editorState;
    if (!view) throw new Error('view not ready');

    view.dispatch(view.state.tr.setSelection(Selection.atEnd(view.state.doc)));
    const mac = isMacPlatform();
    const before = editorState.getMarkdown();

    const event = dispatchKeydown(view.dom, { key: ']', metaKey: mac, ctrlKey: !mac });

    expect(event.defaultPrevented).toBe(true);
    expect(editorState.getMarkdown()).toBe(before);
  });

  test('Mod-[ in plain prose preventDefaults', async () => {
    editorState = await mountPlainEditor();
    const { view } = editorState;
    if (!view) throw new Error('view not ready');

    view.dispatch(view.state.tr.setSelection(Selection.atEnd(view.state.doc)));
    const mac = isMacPlatform();
    const before = editorState.getMarkdown();

    const event = dispatchKeydown(view.dom, { key: '[', metaKey: mac, ctrlKey: !mac });

    expect(event.defaultPrevented).toBe(true);
    expect(editorState.getMarkdown()).toBe(before);
  });
});
