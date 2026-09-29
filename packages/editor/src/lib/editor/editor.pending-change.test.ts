/// <reference lib="dom" />
/**
 * COR-525: taking a pending rich edit (`flushPendingChange`) and replacing the
 * document as a new baseline (`resetDocument`), including the late report
 * Milkdown's own debounced listener can still make afterwards.
 */
import { setupHappyDom } from '@lostgradient/testing';
import { listenerCtx } from '@milkdown/kit/plugin/listener';
import { redoDepth, undoDepth } from '@milkdown/kit/prose/history';
import { Selection } from '@milkdown/prose/state';
import { afterEach, describe, expect, mock, test } from 'bun:test';
import type { FakeClock } from '../test/fake-clock.js';
import { installFakeClock } from '../test/fake-clock.js';
import { createEditor } from './editor.js';
import { readPlaceholderConfiguration } from './template-placeholder-configuration-plugin.js';
import type { PlaceholderEditorConfiguration } from './template-placeholder-configuration.js';
import type { EditorState } from './types.js';

setupHappyDom();

let editorState: EditorState | undefined;
let clock: FakeClock | undefined;
let container: HTMLElement | undefined;

afterEach(async () => {
  clock?.restore();
  clock = undefined;
  if (editorState) {
    editorState.markDestroyed();
    await editorState.editor.destroy();
    editorState = undefined;
  }
  container?.remove();
  container = undefined;
});

async function mountEditor(options: {
  initialContent: string;
  onchange: (markdown: string) => void;
  placeholders?: PlaceholderEditorConfiguration;
}): Promise<EditorState> {
  container = document.createElement('div');
  document.body.append(container);
  editorState = await createEditor(container, {
    initialContent: options.initialContent,
    onchange: options.onchange,
    changeDebounceMs: 50,
    ...(options.placeholders ? { placeholders: options.placeholders } : {}),
  });
  // Installed after mount: nothing below waits on Milkdown's own debounce,
  // whose report each test delivers explicitly instead.
  clock = installFakeClock();
  return editorState;
}

/**
 * Deliver the report Milkdown's listener makes when its own debounce fires,
 * exactly as it would: to every `markdownUpdated` subscriber.
 */
function deliverListenerReport(state: EditorState, markdown: string, previous: string): void {
  const { listeners } = state.editor.ctx.get(listenerCtx);
  for (const listener of listeners.markdownUpdated) listener(state.editor.ctx, markdown, previous);
}

describe('EditorState.flushPendingChange', () => {
  test('returns null when no internal change is pending', async () => {
    const onchange = mock((_markdown: string) => {});
    const state = await mountEditor({ initialContent: 'Hello', onchange });

    expect(state.flushPendingChange()).toBeNull();
    expect(onchange).not.toHaveBeenCalled();
  });

  test('takes the pending edit, cancels its notification and drops the late listener report exactly once', async () => {
    const onchange = mock((_markdown: string) => {});
    const state = await mountEditor({ initialContent: 'Hello', onchange });

    state.view.dispatch(state.view.state.tr.insertText('!', 6));
    expect(state.hasPendingInternalChange()).toBe(true);

    const taken = state.flushPendingChange();
    expect(taken?.trim()).toBe('Hello!');
    expect(state.hasPendingInternalChange()).toBe(false);

    // Milkdown's listener still reports the same document afterwards.
    deliverListenerReport(state, 'Hello!\n', 'Hello\n');
    clock?.advance(1000);
    expect(onchange).not.toHaveBeenCalled();

    // The drop covered only that document: the next edit notifies once.
    state.view.dispatch(state.view.state.tr.insertText('?', 7));
    deliverListenerReport(state, 'Hello!?\n', 'Hello!\n');
    clock?.advance(1000);
    expect(onchange).toHaveBeenCalledTimes(1);
    expect(onchange.mock.calls[0]?.[0]).toBe('Hello!?\n');
  });

  test('a notification already scheduled before the flush never fires', async () => {
    const onchange = mock((_markdown: string) => {});
    const state = await mountEditor({ initialContent: 'Hello', onchange });

    state.view.dispatch(state.view.state.tr.insertText('!', 6));
    // The listener reported first; only the component debounce remains.
    deliverListenerReport(state, 'Hello!\n', 'Hello\n');
    expect(state.flushPendingChange()?.trim()).toBe('Hello!');

    clock?.advance(1000);
    expect(onchange).not.toHaveBeenCalled();
  });
});

describe('EditorState.resetDocument', () => {
  const definitions = { candidates: [{ path: 'name', types: ['string'] }] } as const;

  test('replaces the document as a new baseline: empty history, caret at the end, no notification', async () => {
    const onchange = mock((_markdown: string) => {});
    const state = await mountEditor({ initialContent: 'First', onchange });

    state.view.dispatch(state.view.state.tr.insertText(' edit', 6));
    expect(undoDepth(state.view.state)).toBeGreaterThan(0);

    state.resetDocument('Replaced *text*');

    expect(state.getMarkdown().trim()).toBe('Replaced *text*');
    expect(undoDepth(state.view.state)).toBe(0);
    expect(redoDepth(state.view.state)).toBe(0);
    expect(state.view.state.selection.eq(Selection.atEnd(state.view.state.doc))).toBe(true);
    expect(state.hasPendingInternalChange()).toBe(false);

    // The stale report of the pre-reset edit never reaches onchange.
    deliverListenerReport(state, 'First edit\n', 'First\n');
    clock?.advance(1000);
    expect(onchange).not.toHaveBeenCalled();
  });

  test('keeps the current placeholder configuration installed', async () => {
    const onchange = mock((_markdown: string) => {});
    const state = await mountEditor({ initialContent: 'Hello', onchange });
    const configuration: PlaceholderEditorConfiguration = { definitions };
    state.setPlaceholderConfiguration(configuration);
    const before = readPlaceholderConfiguration(state.view.state);
    expect(before.validationCandidates?.map((candidate) => candidate.path)).toEqual(['name']);

    state.resetDocument('Hi {{name}}');

    const after = readPlaceholderConfiguration(state.view.state);
    expect(after.validationCandidates?.map((candidate) => candidate.path)).toEqual(['name']);
    expect(after.completion).toBeDefined();
    expect(undoDepth(state.view.state)).toBe(0);
  });

  test('edits after a reset notify normally', async () => {
    const onchange = mock((_markdown: string) => {});
    const state = await mountEditor({ initialContent: 'Hello', onchange });

    state.resetDocument('Fresh');
    state.view.dispatch(state.view.state.tr.insertText('!', 6));
    deliverListenerReport(state, 'Fresh!\n', 'Fresh\n');
    clock?.advance(1000);

    expect(onchange).toHaveBeenCalledTimes(1);
    expect(undoDepth(state.view.state)).toBe(1);
  });
});
