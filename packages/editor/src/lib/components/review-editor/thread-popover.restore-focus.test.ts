/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';
import { tick } from 'svelte';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: ThreadPopover } = await import('./thread-popover.svelte');

/**
 * Deleting a thread from inside its own popover removes the sidebar item the
 * popover was opened from. The focus trap captured that item on activation, so
 * by the time it restores, its target is disconnected — and focus lands on
 * `<body>`: silence for a screen reader, and a keyboard user restarted at the
 * top of the document.
 *
 * Reproduced in live Chromium on a consumer route before this was fixed:
 * `document.activeElement === document.body` after activating "Delete thread".
 * The popover now hands the trap a `restoreFallback`, and
 * `review-editor-impl.svelte` points it at the comments-sidebar toggle for the
 * same editor instance — always mounted, always focusable, and adjacent to what
 * the user was doing.
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
} as never;

const BASE_PROPS = {
  id: 'test-thread-popover',
  thread: THREAD,
  currentUserId: 'author-1',
  position: { x: 10, y: 10 },
} as const;

function mountOpener(): HTMLButtonElement {
  const opener = document.createElement('button');
  opener.setAttribute('data-testid', 'opener');
  document.body.appendChild(opener);
  opener.focus();
  return opener;
}

/**
 * The popover only arms its focus trap once `createAnchoredOverlay` has a
 * position (`active: () => anchoredOverlay.positionReady`), and that runs
 * through an async floating-ui `computePosition` inside `autoUpdate`. Without
 * waiting for it, every assertion here would pass or fail because the trap never
 * activated at all, which is indistinguishable from the behavior under test.
 * The component renders the flag as `data-position-ready`, so it is observable.
 */
async function waitForPositionReady(): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const popover = document.querySelector('[data-position-ready]');
    if (popover?.getAttribute('data-position-ready') === 'true') return;
    await tick();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error(
    'the thread popover never reported data-position-ready="true"; its focus trap never armed, ' +
      'so nothing below would be measuring focus restoration',
  );
}

function mountSidebarToggle(): HTMLButtonElement {
  // Shaped like the real one: `review-editor-controls.svelte` gives the comments
  // toggle `aria-controls={sidebarId}`, which is what the impl's selector keys on.
  const toggle = document.createElement('button');
  toggle.setAttribute('aria-controls', 'test-editor-sidebar');
  document.body.appendChild(toggle);
  return toggle;
}

describe('ThreadPopover focus restoration', () => {
  test('restores to the fallback when the element that opened it was removed', async () => {
    const toggle = mountSidebarToggle();
    const opener = mountOpener();

    const { unmount } = render(ThreadPopover, {
      props: { ...BASE_PROPS, restoreFallback: '[aria-controls="test-editor-sidebar"]' },
    });
    await tick();
    await waitForPositionReady();

    // The delete removes the sidebar item and closes the popover in one action.
    opener.remove();
    unmount();
    await tick();

    expect(document.activeElement).toBe(toggle);
    expect(document.activeElement).not.toBe(document.body);
  });

  test('still returns to the opener when it survives, so an ordinary close is unchanged', async () => {
    const toggle = mountSidebarToggle();
    const opener = mountOpener();

    const { unmount } = render(ThreadPopover, {
      props: { ...BASE_PROPS, restoreFallback: '[aria-controls="test-editor-sidebar"]' },
    });
    await tick();
    await waitForPositionReady();

    unmount();
    await tick();

    expect(document.activeElement).toBe(opener);
    expect(document.activeElement).not.toBe(toggle);
  });

  test('lands on the body without a fallback, which is the behavior being fixed', async () => {
    // Kept as the contrast case: it pins that the fallback is what does the
    // work, not some other change in the popover, and it documents the old
    // behavior precisely enough to recognise a regression.
    mountSidebarToggle();
    const opener = mountOpener();

    const { unmount } = render(ThreadPopover, { props: BASE_PROPS });
    await tick();
    await waitForPositionReady();

    opener.remove();
    unmount();
    await tick();

    expect(document.activeElement).toBe(document.body);
  });
});
