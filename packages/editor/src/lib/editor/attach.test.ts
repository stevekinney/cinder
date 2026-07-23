/// <reference lib="dom" />
import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import { createEditorAttachment } from './attach.js';
import * as editorRuntime from './editor.js';
import type { EditorConfig, EditorState } from './types.js';

let resolveCreatedEditor: ((state: EditorState) => void) | undefined;
let rejectCreatedEditor: ((error: unknown) => void) | undefined;

const createEditorMock = mock((_element: HTMLElement, _configuration?: EditorConfig) => {
  return new Promise<EditorState>((resolve, reject) => {
    resolveCreatedEditor = resolve;
    rejectCreatedEditor = reject;
  });
});

const destroyEditorMock = mock((_state: EditorState) => {});

function createEditorState(): EditorState {
  return {
    editor: { destroy: mock(() => {}) } as unknown as EditorState['editor'],
    view: {} as EditorState['view'],
    focus: mock(() => {}),
    getMarkdown: mock(() => ''),
    setMarkdown: mock((_content: string) => {}),
    clearPendingTimers: mock(() => {}),
    markDestroyed: mock(() => {}),
  };
}

function createAttachmentOptions(
  overrides: Partial<Parameters<typeof createEditorAttachment>[0]> = {},
) {
  return {
    getInitialValue: () => 'Initial markdown',
    getReadonly: () => false,
    getAriaLabel: () => 'Markdown editor',
    ...overrides,
  };
}

function createEditorElement(): HTMLElement {
  return {} as HTMLElement;
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

/**
 * The `Attachment` type allows a `void | (() => void)` return, but
 * `createEditorAttachment` always returns a cleanup function. Narrow it once
 * here instead of asserting at every call site.
 */
function expectDetachFunction(detach: void | (() => void)): () => void {
  if (typeof detach !== 'function') {
    throw new Error('expected the attachment to return a detach function');
  }
  return detach;
}

describe('createEditorAttachment', () => {
  beforeEach(() => {
    resolveCreatedEditor = undefined;
    rejectCreatedEditor = undefined;
    createEditorMock.mockClear();
    destroyEditorMock.mockClear();
    spyOn(editorRuntime, 'createEditor').mockImplementation(createEditorMock);
    spyOn(editorRuntime, 'destroyEditor').mockImplementation(destroyEditorMock);
  });

  afterEach(() => {
    mock.restore();
  });

  test('destroys the editor when initialization resolves after detach', async () => {
    const onready = mock((_state: EditorState) => {});
    const attachment = createEditorAttachment(createAttachmentOptions({ onready }));
    const detach = expectDetachFunction(attachment(createEditorElement()));

    detach();

    const editorState = createEditorState();
    resolveCreatedEditor?.(editorState);
    await flushMicrotasks();

    expect(onready).not.toHaveBeenCalled();
    expect(destroyEditorMock).toHaveBeenCalledTimes(1);
    expect(destroyEditorMock).toHaveBeenCalledWith(editorState);
  });

  test('does not log initialization failures after detach', async () => {
    const originalConsoleError = console.error;
    const consoleErrorMock = mock((_message?: unknown, ..._optionalParameters: unknown[]) => {});
    console.error = consoleErrorMock;

    try {
      const attachment = createEditorAttachment(createAttachmentOptions());
      const detach = expectDetachFunction(attachment(createEditorElement()));

      detach();
      rejectCreatedEditor?.(new Error('late Milkdown initialization failure'));
      await flushMicrotasks();
    } finally {
      console.error = originalConsoleError;
    }

    expect(consoleErrorMock).not.toHaveBeenCalled();
  });
});
