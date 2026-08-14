/// <reference lib="dom" />
import { TextSelection } from '@milkdown/prose/state';
import { afterEach, describe, expect, test } from 'bun:test';
import { setupHappyDom } from '../test/happy-dom.js';
import { createEditor } from './editor.js';
import type { EditorState } from './types.js';

setupHappyDom();

let editorState: EditorState | undefined;

afterEach(async () => {
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
    container.remove();
  });
});
