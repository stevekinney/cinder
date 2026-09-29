/// <reference lib="dom" />
import { setupHappyDom } from '@lostgradient/testing';
import { describe, expect, test } from 'bun:test';
import { resetScrollLock } from '../_internal/overlay.ts';
import { setupAttachmentTests } from './attachments-test-support.ts';
import { createBodyScrollLock } from './attachments.ts';
setupHappyDom();
setupAttachmentTests();

describe('createBodyScrollLock', () => {
  test('hides body overflow when attached', () => {
    const node = document.createElement('div');
    const cleanup = createBodyScrollLock()(node);

    expect(document.body.style.overflow).toBe('hidden');

    cleanup?.();
  });

  test('restores body overflow when released', () => {
    document.body.style.overflow = '';
    const node = document.createElement('div');
    const cleanup = createBodyScrollLock()(node);

    expect(document.body.style.overflow).toBe('hidden');
    cleanup?.();

    expect(document.body.style.overflow).toBe('');
  });

  test('two nested locks keep overflow hidden until both release (shared counter)', () => {
    resetScrollLock();
    const nodeA = document.createElement('div');
    const nodeB = document.createElement('div');

    const cleanupA = createBodyScrollLock()(nodeA);
    const cleanupB = createBodyScrollLock()(nodeB);

    expect(document.body.style.overflow).toBe('hidden');

    // Release first lock — page must still be locked because B is open.
    cleanupA?.();
    expect(document.body.style.overflow).toBe('hidden');

    // Release second lock — now the count reaches zero; scroll restores.
    cleanupB?.();
    expect(document.body.style.overflow).toBe('');
  });

  test('releasing the same attachment twice does not double-decrement the counter', () => {
    resetScrollLock();
    const nodeA = document.createElement('div');
    const nodeB = document.createElement('div');

    const cleanupA = createBodyScrollLock()(nodeA);
    createBodyScrollLock()(nodeB);

    expect(document.body.style.overflow).toBe('hidden');

    // Call the same cleanup twice — idempotent; counter should not drop below 1.
    cleanupA?.();
    cleanupA?.();

    // nodeB's lock is still active; overflow must remain hidden.
    expect(document.body.style.overflow).toBe('hidden');
  });
});
