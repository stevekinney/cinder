/// <reference lib="dom" />
import { describe, expect, mock, test } from 'bun:test';

import { setEditorReadonly } from './editor.js';
import type { EditorState } from './types.js';

/**
 * `readonly` has to reach the accessibility tree, not just the DOM.
 *
 * `setProps({ editable: () => false })` gives the ProseMirror node
 * `contenteditable="false"`, which stops edits — but Chromium still computes the
 * resulting textbox as `readonly=false, settable=true`, so a screen reader
 * announces an ordinary editable field that silently ignores typing. Measured
 * with CDP `Accessibility.getFullAXTree` against a readonly `ReviewEditor`.
 *
 * The attribute must land on `view.dom` specifically. The same measurement with
 * `aria-readonly` on the wrapping `role="application"` host changed nothing:
 * the textbox role lives on the ProseMirror node, and ARIA states do not
 * inherit down to it.
 */
function createStubState(): { state: EditorState; dom: HTMLElement; props: unknown[] } {
  const dom = document.createElement('div');
  const props: unknown[] = [];
  const state = {
    view: {
      dom,
      setProps: mock((next: unknown) => {
        props.push(next);
      }),
    },
  } as unknown as EditorState;
  return { state, dom, props };
}

describe('setEditorReadonly', () => {
  test('marks the editable node aria-readonly when it goes readonly', () => {
    const { state, dom } = createStubState();

    setEditorReadonly(state, true);

    expect(dom.getAttribute('aria-readonly')).toBe('true');
  });

  test('removes aria-readonly when it goes editable again', () => {
    const { state, dom } = createStubState();

    setEditorReadonly(state, true);
    setEditorReadonly(state, false);

    // Absent, not `aria-readonly="false"`. A stale `true` would tell a screen
    // reader the document cannot be edited while `contenteditable` says it can.
    expect(dom.hasAttribute('aria-readonly')).toBe(false);
  });

  test('still drives the editable prop, so the ARIA state cannot drift from the behavior', () => {
    // Guards against "fixing" this by writing the attribute and dropping the
    // prop: the two have to move together or the editor is announced readonly
    // while still accepting input.
    const { state, props } = createStubState();

    setEditorReadonly(state, true);
    expect(props).toHaveLength(1);
    const [first] = props as [{ editable: () => boolean }];
    expect(first.editable()).toBe(false);

    setEditorReadonly(state, false);
    const [, second] = props as [unknown, { editable: () => boolean }];
    expect(second.editable()).toBe(true);
  });

  test('does nothing when the view is gone, rather than throwing on teardown', () => {
    const state = { view: undefined } as unknown as EditorState;

    expect(() => setEditorReadonly(state, true)).not.toThrow();
  });
});
