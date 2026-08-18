/// <reference lib="dom" />
import { editorViewOptionsCtx } from '@milkdown/kit/core';
import type { MilkdownPlugin } from '@milkdown/kit/ctx';
import type { Transaction } from '@milkdown/prose/state';
import { TextSelection } from '@milkdown/prose/state';
import type { EditorView } from '@milkdown/prose/view';
import { afterEach, describe, expect, spyOn, test } from 'bun:test';
import type { FakeClock } from '../test/fake-clock.js';
import { installFakeClock } from '../test/fake-clock.js';
import { setupHappyDom } from '../test/happy-dom.js';
import { createEditor } from './editor.js';
import type { EditorState } from './types.js';

setupHappyDom();

let editorState: EditorState | undefined;
let clock: FakeClock | undefined;

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

describe('createEditor selection notifications', () => {
  test('emits Milkdown selection during a selection-only transaction', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    const selections: Array<{ from: number; to: number; isCollapsed: boolean }> = [];

    editorState = await createEditor(container, {
      initialContent: 'selection regression',
      onselectionchange: (selection) => {
        if (selection) selections.push(selection);
      },
    });
    const transaction = editorState.view.state.tr.setSelection(
      TextSelection.create(editorState.view.state.doc, 1, 10),
    );
    editorState.view.dispatch(transaction);

    expect(selections.at(-1)).toEqual({ from: 1, to: 10, isCollapsed: false });
    container.remove();
  });

  test('emits the mapped selection during the document-update debounce window', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    const selections: Array<{ from: number; to: number; isCollapsed: boolean }> = [];

    editorState = await createEditor(container, {
      initialContent: 'document regression',
      onselectionchange: (selection) => {
        if (selection) selections.push(selection);
      },
    });
    clock = installFakeClock();

    editorState.view.dispatch(
      editorState.view.state.tr.setSelection(
        TextSelection.create(editorState.view.state.doc, 2, 8),
      ),
    );
    const transaction = editorState.view.state.tr.insertText('x', 1);
    editorState.view.dispatch(transaction);

    // The selectionUpdated callback must report the mapped selection while
    // the document-change listener is still inside its debounce window.
    expect(selections.at(-1)).toEqual({ from: 3, to: 9, isCollapsed: false });
    clock.advance(200);
    container.remove();
  });
});

describe('createEditor transaction ownership', () => {
  test('preserves the EditorView receiver of a configured transaction dispatcher', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    let expectedView: EditorView | undefined;
    let receiverWasExpected = false;
    const receiverAwareDispatcher: MilkdownPlugin = (context) => async () => {
      context.update(editorViewOptionsCtx, (previous) => ({
        ...previous,
        dispatchTransaction(this: EditorView, transaction: Transaction) {
          receiverWasExpected = this === expectedView;
          this.updateState(this.state.apply(transaction));
        },
      }));
    };

    editorState = await createEditor(container, {
      initialContent: 'receiver regression',
      plugins: [receiverAwareDispatcher],
    });
    expectedView = editorState.view;
    clock = installFakeClock();
    editorState.view.dispatch(editorState.view.state.tr.insertText('x', 1));

    expect(receiverWasExpected).toBe(true);
    expect(editorState.getMarkdown()).toContain('xreceiver regression');
    container.remove();
  });

  test('does not serialize Markdown synchronously at the transaction boundary', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    editorState = await createEditor(container, {
      initialContent: 'serialization regression',
    });
    const editorAction = spyOn(editorState.editor, 'action');
    clock = installFakeClock();
    editorState.view.dispatch(editorState.view.state.tr.insertText('x', 1));

    // Milkdown's listener remains the serialization boundary and has not
    // reached its 200ms debounce yet.
    expect(editorAction).not.toHaveBeenCalled();
    container.remove();
  });

  test('marks history-excluded document transactions as internal until an external replacement', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    editorState = await createEditor(container, {
      initialContent: 'ownership regression',
    });
    clock = installFakeClock();

    editorState.view.dispatch(
      editorState.view.state.tr.insertText('x', 1).setMeta('addToHistory', false),
    );
    expect(editorState.hasPendingInternalChange()).toBe(true);

    editorState.setMarkdown('Authoritative replacement.');
    expect(editorState.hasPendingInternalChange()).toBe(false);
    expect(editorState.getMarkdown().trim()).toBe('Authoritative replacement.');
    container.remove();
  });
});
