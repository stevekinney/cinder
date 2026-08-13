/// <reference lib="dom" />
import { afterAll, afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';
import type { ConversationHistory, Message, MessageRole } from './conversation-model.ts';

setupHappyDom();

class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
const originalResizeObserver = globalThis.ResizeObserver;
globalThis.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver;

class TestIntersectionObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}
const originalIntersectionObserver = globalThis.IntersectionObserver;
globalThis.IntersectionObserver =
  TestIntersectionObserver as unknown as typeof IntersectionObserver;

afterAll(() => {
  globalThis.ResizeObserver = originalResizeObserver;
  globalThis.IntersectionObserver = originalIntersectionObserver;
});

const { render, fireEvent, waitFor, cleanup } = await import('@testing-library/svelte');
const { default: Chat } = await import('./chat.svelte');

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

function longConversation(count: number): ConversationHistory {
  const now = '2026-06-01T12:00:00.000Z';
  const ids: string[] = [];
  const messages: Record<string, Message> = {};

  for (let index = 0; index < count; index += 1) {
    const id = `message-${index}`;
    const role: MessageRole = index % 2 === 0 ? 'user' : 'assistant';
    ids.push(id);
    messages[id] = {
      id,
      role,
      content: `Message ${index}`,
      position: index,
      createdAt: now,
      metadata: {},
      hidden: false,
    };
  }

  return {
    schemaVersion: 4,
    id: 'jump-focus-conversation',
    status: 'active',
    metadata: {},
    ids,
    messages,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Render a virtualized Chat and give its timeline a real scroll geometry:
 * happy-dom reports a zero `clientHeight` and its `scrollTo` neither moves
 * `scrollTop` nor fires `scroll`, so the virtualizer would never see a window
 * change. Stubbing both is what the other virtualization suites do.
 */
async function renderVirtualizedChat(messageCount = 80) {
  const { container } = render(Chat, {
    props: {
      id: 'virtual-chat',
      conversation: longConversation(messageCount),
      virtualized: true,
      virtualizationEstimatedRowHeight: 20,
      virtualizationInitialHeight: 100,
      virtualizationOverscan: 0,
    },
  });

  const chatContainer = container.querySelector<HTMLElement>('.chat-container')!;
  const timeline = container.querySelector<HTMLElement>('.chat-timeline')!;
  await waitFor(() => expect(timeline.hasAttribute('data-cinder-virtualized')).toBe(true));

  Object.defineProperty(timeline, 'clientHeight', { configurable: true, value: 100 });
  timeline.scrollTo = (options?: ScrollToOptions | number, y?: number) => {
    const top =
      typeof options === 'number' ? (typeof y === 'number' ? y : options) : (options?.top ?? 0);
    timeline.scrollTop = top;
    timeline.dispatchEvent(new Event('scroll'));
  };

  return { container, chatContainer, timeline };
}

function renderedMessageIds(container: HTMLElement): string[] {
  return [...container.querySelectorAll<HTMLElement>('.chat-message')].map((node) => node.id);
}

describe('Chat jump-to-latest focus in a virtualized transcript', () => {
  test('keeps keyboard shortcuts alive after the virtualizer recycles the window', async () => {
    const { container, chatContainer, timeline } = await renderVirtualizedChat();

    timeline.focus();
    await fireEvent.keyDown(chatContainer, { key: 'End' });
    await waitFor(() => expect(timeline.scrollTop).toBeGreaterThan(0));
    const bottomScrollTop = timeline.scrollTop;
    const windowAtBottom = renderedMessageIds(container);
    expect(windowAtBottom.length).toBeGreaterThan(0);

    // The virtualizer's next window pass. Any of them does this — a
    // post-mount remeasurement, the tail of a smooth scroll, the user
    // scrolling away — and each one unmounts the rows that were on screen a
    // moment ago.
    timeline.scrollTop = 0;
    await fireEvent.scroll(timeline);
    await waitFor(() =>
      expect(renderedMessageIds(container).some((id) => windowAtBottom.includes(id))).toBe(false),
    );

    // Focus must still be somewhere inside the chat, or the container-bound
    // keydown handler stops receiving anything.
    expect(document.activeElement).not.toBe(document.body);
    expect(chatContainer.contains(document.activeElement)).toBe(true);

    // The consequence that matters: End still jumps to the latest message.
    await fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'End' });
    await waitFor(() => expect(timeline.scrollTop).toBe(bottomScrollTop));
  });

  // NOT TESTED HERE, deliberately: the reclaim path itself.
  //
  // `reclaimFocusIfRowDetached` re-checks the focused row's connectivity on
  // every scroll-state recompute, because a browser removing the focused node
  // moves focus to <body> WITHOUT reliably dispatching `focusout` from it. An
  // earlier version of this file dispatched a synthetic `focusout` before
  // detaching a row, which passed while masking exactly that.
  //
  // Driving the honest version — detach a row, then let a real scroll recompute
  // notice — segfaults Bun's happy-dom harness: hand-removing a node the
  // virtualizer believes it owns and then running its measurement pass over the
  // result is not a state it is built to survive, and the `waitFor` polling
  // that the rAF-deferred recompute requires makes it worse. Three attempts,
  // three crashes (RSS peaked at 8.8GB).
  //
  // What IS covered: the test above proves the user-facing consequence — after
  // a real window pass recycles the rows, keyboard shortcuts still work — and
  // the test below proves the reclaim does not fire when nothing was recycled.
  // The gap is the isolated unit, and it wants a real browser, which is what
  // chatroom's Playwright suite is for.

  test('leaves focus alone when the user clicks away onto inert page chrome', async () => {
    const { container, timeline } = await renderVirtualizedChat();

    const row = container.querySelector<HTMLElement>('.chat-message')!;
    row.focus();

    // A click-away onto inert page chrome leaves the row CONNECTED — nothing
    // was recycled — so the chat must not yank focus back off the body.
    row.blur();
    expect(document.activeElement).toBe(document.body);

    // A scroll that recycles nothing must not yank focus back: the row the user
    // left is still connected, so nothing was taken from them.
    await fireEvent.scroll(timeline);
    expect(document.activeElement).toBe(document.body);
    expect(document.activeElement).not.toBe(timeline);
  });
});

// NOT TESTED HERE, deliberately, for the same reason the reclaim itself is not:
// the paths added for review round 5 both depend on `reclaimFocusIfRowDetached`
// actually running, and this harness cannot exercise it (see the note above).
//
// Two attempts are worth recording so they are not repeated:
//
// 1. Driving a non-scroll row removal through the `conversation` prop does not
//    work, because Chat does not remove rows when the conversation shrinks. A
//    Chat rendered with 6 messages and then re-rendered with 3 still shows all
//    6, container-scoped, with one instance mounted — while message CONTENT
//    updates flow through normally. That is a separate pre-existing bug
//    (cinder#1286); the rendered-set effect is dead code until it is fixed, and
//    load-bearing after.
//
// 2. A "clicked away, then the row recycled" test passes identically with and
//    without the outside-pointer clearing, because happy-dom does not blur a
//    focused element when a pointerdown lands on inert chrome. A test that
//    cannot fail is worse than no test, so it is not here.
