/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';
import { tick } from 'svelte';

import { setupHappyDom } from '@lostgradient/testing';
import type { Thread } from '../../comments/types.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: ThreadPopover } = await import('./thread-popover.svelte');

/**
 * Escape inside the comment-edit textarea must cancel only the edit. It used to
 * bubble to the popover's dialog-level Escape handler with `defaultPrevented`
 * false, closing the whole thread popover (reproduced in Chromium: dialog count
 * 1 -> 0). The Cancel button and the reply composer already left it open.
 */
const THREAD = {
  id: 'thread-1',
  anchor: {
    from: 1,
    to: 10,
    quote: 'Release Plan',
    prefix: '',
    suffix: '',
    type: 'text',
    status: 'anchored',
  },
  comments: [
    {
      id: 'comment-1',
      threadId: 'thread-1',
      authorId: 'author-1',
      body: 'A note.',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  createdAt: '2026-01-01T00:00:00.000Z',
} satisfies Thread;

async function openEditor(onclose: () => void) {
  render(ThreadPopover, {
    props: {
      id: 'test-thread-popover',
      thread: THREAD,
      currentUserId: 'author-1',
      position: { x: 10, y: 10 },
      onclose,
    },
  });
  await tick();
  document.querySelector<HTMLElement>('[aria-label="Edit comment"]')?.click();
  await tick();
  const textarea = document.querySelector<HTMLTextAreaElement>('.comment-edit-textarea');
  expect(textarea).not.toBeNull();
  return textarea as HTMLTextAreaElement;
}

describe('ThreadPopover: Escape while editing a comment', () => {
  test('cancels the edit without closing the popover', async () => {
    let closed = 0;
    const textarea = await openEditor(() => (closed += 1));

    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    textarea.dispatchEvent(event);
    await tick();

    expect(event.defaultPrevented).toBe(true);
    expect(document.querySelector('.comment-edit-textarea')).toBeNull();
    expect(closed).toBe(0);
  });

  test('a second Escape, with no edit open, still closes the popover', async () => {
    let closed = 0;
    const textarea = await openEditor(() => (closed += 1));
    textarea.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );
    await tick();

    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    dialog?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );
    expect(closed).toBe(1);
  });
});
