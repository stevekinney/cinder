import { setupHappyDom } from '@lostgradient/testing';
import { describe, expect, mock, test } from 'bun:test';
import { destroyEditor } from './editor-lifecycle.js';
import { createEditor } from './editor.js';

setupHappyDom();

describe('destroyEditor', () => {
  test('rejects asynchronous Milkdown teardown failures without mutating stderr', async () => {
    const destroy = mock(async () => {
      throw new Error('teardown failed');
    });
    const state = await createEditor(document.createElement('div'));
    const originalDestroy = state.editor.destroy;
    const originalStderrWrite = process.stderr.write;
    Object.defineProperty(state.editor, 'destroy', { value: destroy });

    try {
      const failure = await destroyEditor(state).then(
        () => undefined,
        (error: unknown) => error,
      );
      expect(failure).toBeInstanceOf(Error);
      expect(failure).toMatchObject({ message: 'teardown failed' });
      expect(destroy).toHaveBeenCalledTimes(1);
      expect(process.stderr.write).toBe(originalStderrWrite);
    } finally {
      Object.defineProperty(state.editor, 'destroy', { value: originalDestroy });
      await originalDestroy();
    }
  });
});
