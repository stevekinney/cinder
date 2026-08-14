/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';
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

/**
 * Elements these tests append to `document.body` directly. Testing Library's
 * `cleanup` only owns the containers `render` created, so without this they
 * accumulate across a single-process run and a later document-scoped selector —
 * including the one the fix itself uses — can resolve a stray left by an earlier
 * test.
 */
const appended: HTMLElement[] = [];

afterEach(() => {
  for (const element of appended.splice(0)) element.remove();
});

function mountOpener(): HTMLButtonElement {
  const opener = document.createElement('button');
  opener.setAttribute('data-testid', 'opener');
  document.body.appendChild(opener);
  appended.push(opener);
  opener.focus();
  return opener;
}

/**
 * The popover only arms its focus trap once `createAnchoredOverlay` has a
 * position (`active: () => anchoredOverlay.positionReady`), and that runs
 * through an async floating-ui `computePosition` inside `autoUpdate`. Without
 * waiting for it, every assertion here would pass or fail because the trap never
 * activated at all — indistinguishable from the behavior under test.
 *
 * Observed rather than polled: the component renders the flag as
 * `data-position-ready`, so a `MutationObserver` resolves at the moment it flips
 * and not a scheduling tick later. There is deliberately no attempt cap and no
 * timer — a bounded retry loop here would be a guessed threshold wearing a
 * poll's clothes, and this file's own package treats that as blocking. If the
 * flag never arrives the suite's own timeout fails the test, which is the
 * correct outcome: never-ready is a real failure, not something to wait out.
 */
function waitForPositionReady(): Promise<void> {
  const isReady = () =>
    document.querySelector('[data-position-ready]')?.getAttribute('data-position-ready') === 'true';

  if (isReady()) return Promise.resolve();

  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      if (!isReady()) return;
      observer.disconnect();
      resolve();
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-position-ready'],
    });
  });
}

function mountSidebarToggle(): HTMLButtonElement {
  // Shaped like the real one: `review-editor-controls.svelte` gives the comments
  // toggle `id={sidebarId}-toggle`, which is what the impl passes through as
  // `restoreFallbackId`, and `aria-controls={sidebarId}` alongside it.
  const toggle = document.createElement('button');
  toggle.id = 'test-editor-sidebar-toggle';
  toggle.setAttribute('aria-controls', 'test-editor-sidebar');
  document.body.appendChild(toggle);
  appended.push(toggle);
  return toggle;
}

describe('ThreadPopover focus restoration', () => {
  test('restores to the fallback when the element that opened it was removed', async () => {
    const toggle = mountSidebarToggle();
    const opener = mountOpener();

    const { unmount } = render(ThreadPopover, {
      props: { ...BASE_PROPS, restoreFallbackId: 'test-editor-sidebar-toggle' },
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
      props: { ...BASE_PROPS, restoreFallbackId: 'test-editor-sidebar-toggle' },
    });
    await tick();
    await waitForPositionReady();

    unmount();
    await tick();

    expect(document.activeElement).toBe(opener);
    expect(document.activeElement).not.toBe(toggle);
  });

  test('goes to the fallback after a delete even while the opener is still on screen', async () => {
    // The asynchronous-removal window. A consumer whose `onthreaddelete` waits
    // on a server keeps the sidebar item mounted while the request is in
    // flight, so the popover closes with its opener still perfectly focusable.
    // Ordinary restoration hands focus straight back to it — and then the
    // response lands, the item unmounts, and focus falls to `<body>` after all,
    // with the fallback never consulted.
    //
    // Modelled exactly that way: `ondelete` does nothing, standing in for a
    // request that has not resolved yet.
    const toggle = mountSidebarToggle();
    const opener = mountOpener();

    const { unmount } = render(ThreadPopover, {
      props: { ...BASE_PROPS, restoreFallbackId: 'test-editor-sidebar-toggle', ondelete: () => {} },
    });
    await tick();
    await waitForPositionReady();

    const deleteButton = document.querySelector<HTMLElement>('[aria-label="Delete thread"]');
    expect(deleteButton).not.toBeNull();
    deleteButton?.click();
    await tick();

    unmount();
    await tick();

    // The opener is STILL CONNECTED, which is the whole point of this case.
    expect(opener.isConnected).toBe(true);
    expect(document.activeElement).toBe(toggle);
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
