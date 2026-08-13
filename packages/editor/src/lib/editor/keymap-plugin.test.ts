/**
 * Tab must not be a keyboard trap (WCAG 2.1.2).
 *
 * The bindings are driven directly rather than through a live Milkdown editor:
 * `call` stands in for the command dispatcher, and the only property of it that
 * matters here is the one that creates the trap — sink/lift-list-item return
 * true (handled, and therefore `preventDefault`ed) inside a list item and false
 * anywhere else.
 */

import { Schema } from '@milkdown/kit/prose/model';
import { EditorState, TextSelection } from '@milkdown/kit/prose/state';
import { EditorView } from '@milkdown/kit/prose/view';
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

/**
 * Focus leaving the editor has to invalidate the escape, and is the one
 * invalidation editor state cannot report: leaving and returning to the same
 * caret applies no transaction, so doc and selection still satisfy the identity
 * check. Escape is usually pressed to dismiss a menu rather than to leave, so a
 * latch that outlived focus would sit armed until the user came back and
 * pressed Tab meaning "indent".
 */
describe('editor keymap: the Tab escape does not outlive focus', () => {
  let calls: string[];
  let bindings: ReturnType<typeof createKeymapBindings>;
  let state: EditorState;
  let surface: ReturnType<typeof focusSurface>;

  /**
   * Stands in for the editor's editable element, and counts the listeners left
   * on it so a test can catch both a leak and a stacked duplicate.
   */
  function focusSurface() {
    const listeners = new Set<EventListener>();

    const dom = {
      addEventListener: (type: string, listener: EventListener) => {
        if (type === 'blur') listeners.add(listener);
      },
      removeEventListener: (type: string, listener: EventListener) => {
        if (type === 'blur') listeners.delete(listener);
      },
    };

    return {
      view: { dom } as unknown as EditorView,
      blur: () => {
        // Each listener detaches itself as it runs, which Set iteration allows.
        for (const listener of listeners) listener(new Event('blur'));
      },
      listenerCount: () => listeners.size,
    };
  }

  beforeEach(() => {
    calls = [];
    surface = focusSurface();
    state = editorState({ id: 'doc' }, 10);
    bindings = createKeymapBindings(runtime, (key) => {
      calls.push(typeof key === 'string' ? key : JSON.stringify(key));
      return key === SINK || key === LIFT;
    });
  });

  it('indents a Tab pressed after focus left and came back', () => {
    bindings['Escape']!(state, undefined, surface.view);
    surface.blur();

    // Same doc, same caret — the state check alone would still call this valid.
    expect(bindings['Tab']!(state, undefined, surface.view)).toBe(true);
    expect(calls).toEqual([SINK]);
  });

  it('outdents a Shift-Tab pressed after focus left and came back', () => {
    bindings['Escape']!(state, undefined, surface.view);
    surface.blur();

    expect(bindings['Shift-Tab']!(state, undefined, surface.view)).toBe(true);
    expect(calls).toEqual([LIFT]);
  });

  it('still releases the Tab that follows Escape while focus stays put', () => {
    bindings['Escape']!(state, undefined, surface.view);

    expect(bindings['Tab']!(state, undefined, surface.view)).toBe(false);
    expect(calls).toEqual([]);
  });

  it('stops watching focus once the Tab is spent', () => {
    bindings['Escape']!(state, undefined, surface.view);
    bindings['Tab']!(state, undefined, surface.view);

    expect(surface.listenerCount()).toBe(0);
  });

  it('does not stack a listener per Escape', () => {
    bindings['Escape']!(state, undefined, surface.view);
    bindings['Escape']!(state, undefined, surface.view);

    expect(surface.listenerCount()).toBe(1);
  });

  it('arms without a view — the keymap is still usable headless', () => {
    bindings['Escape']!(state);

    expect(bindings['Tab']!(state)).toBe(false);
    expect(calls).toEqual([]);
  });
});

/**
 * The same regression against a real ProseMirror view, because the claim the
 * fix rests on is a fact about ProseMirror rather than about this file: a focus
 * round trip that does not move the caret dispatches no transaction at all.
 */
describe('editor keymap: focus departure in a real editor view', () => {
  const schema = new Schema({
    nodes: {
      doc: { content: 'block+' },
      paragraph: { content: 'inline*', group: 'block', toDOM: () => ['p', 0] },
      bullet_list: { content: 'list_item+', group: 'block', toDOM: () => ['ul', 0] },
      list_item: { content: 'paragraph block*', toDOM: () => ['li', 0] },
      text: { group: 'inline' },
    },
  });

  function mountListEditor() {
    const mount = document.createElement('div');
    document.body.append(mount);

    const doc = schema.node('doc', null, [
      schema.node('bullet_list', null, [
        schema.node('list_item', null, [schema.node('paragraph', null, [schema.text('one')])]),
        schema.node('list_item', null, [schema.node('paragraph', null, [schema.text('two')])]),
      ]),
    ]);

    let transactions = 0;
    const view: EditorView = new EditorView(mount, {
      state: EditorState.create({ doc, schema }),
      dispatchTransaction(transaction) {
        transactions += 1;
        view.updateState(view.state.apply(transaction));
      },
    });

    // Caret inside the second bullet, where sink-list-item succeeds.
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 4)));

    return {
      view,
      transactionsSince: (mark: number) => transactions - mark,
      mark: () => transactions,
      destroy: () => {
        view.destroy();
        mount.remove();
      },
    };
  }

  it('indents the Tab that follows a real focus round trip', () => {
    const editor = mountListEditor();
    const elsewhere = document.createElement('input');
    document.body.append(elsewhere);

    try {
      const calls: string[] = [];
      const bindings = createKeymapBindings(runtime, (key) => {
        calls.push(typeof key === 'string' ? key : JSON.stringify(key));
        return key === SINK || key === LIFT;
      });

      editor.view.focus();
      const stateAtEscape = editor.view.state;
      const mark = editor.mark();

      bindings['Escape']!(editor.view.state, undefined, editor.view);
      elsewhere.focus();
      editor.view.focus();

      // The premise: nothing about the editor's own state records the trip.
      expect(editor.transactionsSince(mark)).toBe(0);
      expect(editor.view.state).toBe(stateAtEscape);

      expect(bindings['Tab']!(editor.view.state, undefined, editor.view)).toBe(true);
      expect(calls).toEqual([SINK]);
    } finally {
      elsewhere.remove();
      editor.destroy();
    }
  });
});
