/**
 * Tab must not be a keyboard trap (WCAG 2.1.2).
 *
 * The bindings are driven directly rather than through a live Milkdown editor:
 * `call` stands in for the command dispatcher, and the only property of it that
 * matters here is the one that creates the trap — sink/lift-list-item return
 * true (handled, and therefore `preventDefault`ed) inside a list item and false
 * anywhere else.
 */

import type { EditorState } from '@milkdown/kit/prose/state';
import { beforeEach, describe, expect, it } from 'bun:test';

import { createKeymapBindings } from './keymap-plugin.js';

// The bindings only touch `.key` on each command, so string stand-ins are enough.
const runtime = new Proxy(
  {},
  {
    get: (_target, property: string) => ({ key: property }),
  },
) as Parameters<typeof createKeymapBindings>[0];

const SINK = 'sinkListItemCommand';
const LIFT = 'liftListItemCommand';

/**
 * A stand-in EditorState. `doc` and `selection` are distinct objects per state,
 * mirroring ProseMirror's immutability: a new one exists only where a real
 * transaction would have produced one.
 */
function editorState(document_: object, selectionHead: number): EditorState {
  return {
    doc: document_,
    selection: {
      head: selectionHead,
      eq: (other: { head: number }) => other.head === selectionHead,
    },
  } as unknown as EditorState;
}

describe('editor keymap: Tab inside a list item', () => {
  let calls: string[];
  let inListItem: boolean;
  let bindings: ReturnType<typeof createKeymapBindings>;
  let document_: object;
  let state: EditorState;

  // Optional call, so a build with no Escape binding fails on the Tab
  // assertion that follows — the actual trap — rather than on a TypeError here.
  const pressEscape = (escapeState: EditorState) => bindings['Escape']?.(escapeState);

  beforeEach(() => {
    calls = [];
    inListItem = true;
    document_ = { id: 'doc' };
    state = editorState(document_, 10);
    bindings = createKeymapBindings(runtime, (key) => {
      // The probe records which commands were attempted. `key` is only ever one
      // of the string command identifiers in this harness, so record it as-is
      // rather than coercing a value whose type has no meaningful `toString`.
      calls.push(typeof key === 'string' ? key : JSON.stringify(key));
      // sink/lift only apply in a list item; every other command is irrelevant here.
      return (key === SINK || key === LIFT) && inListItem;
    });
  });

  it('still indents and outdents — the affordance is not the bug', () => {
    expect(bindings['Tab']!(state)).toBe(true);
    expect(calls).toEqual([SINK]);
    expect(bindings['Shift-Tab']!(state)).toBe(true);
    expect(calls).toEqual([SINK, LIFT]);
  });

  it('declines Tab outside a list so the browser moves focus', () => {
    inListItem = false;
    expect(bindings['Tab']!(state)).toBe(false);
  });

  it('releases the NEXT Tab after Escape instead of indenting', () => {
    pressEscape(state);

    // The trap: without the latch this returns true (handled → preventDefault →
    // focus stays) AND runs sink-list-item, silently re-indenting the bullet.
    expect(bindings['Tab']!(state)).toBe(false);
    expect(calls).toEqual([]);
  });

  it('leaves Escape itself unhandled — menus and popovers listen for it too', () => {
    expect(bindings['Escape']!(state)).toBe(false);
  });

  it('releases the next Shift-Tab after Escape too', () => {
    pressEscape(state);
    expect(bindings['Shift-Tab']!(state)).toBe(false);
    expect(calls).toEqual([]);
  });

  it('spends the release on one Tab only', () => {
    pressEscape(state);
    bindings['Tab']!(state);

    // A user who tabbed back in and meant to indent gets an indent.
    expect(bindings['Tab']!(state)).toBe(true);
    expect(calls).toEqual([SINK]);
  });

  it('drops the release when the document changed in between', () => {
    pressEscape(state);
    // Anything typed after Escape means the user is still editing.
    const afterTyping = editorState({ id: 'doc-edited' }, 11);

    expect(bindings['Tab']!(afterTyping)).toBe(true);
    expect(calls).toEqual([SINK]);
  });

  it('drops the release when the caret moved in between', () => {
    pressEscape(state);
    const afterArrowKey = editorState(document_, 24);

    expect(bindings['Tab']!(afterArrowKey)).toBe(true);
    expect(calls).toEqual([SINK]);
  });

  it('does not release a Tab that no Escape preceded', () => {
    expect(bindings['Tab']!(state)).toBe(true);
    expect(calls).toEqual([SINK]);
  });
});
