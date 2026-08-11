/// <reference lib="dom" />
/**
 * Regression coverage for #1237 — non-virtualized history-prepend anchor
 * restoration at scrollTop=0:
 *
 * - the restore lands SYNCHRONOUSLY with the flush that commits the prepend
 *   (no animation-frame gap that paints the un-compensated transcript first);
 * - the stick-to-bottom effect must not engage on a history prepend when the
 *   viewport's live geometry says it is not at the bottom, even when the
 *   rAF-deferred `atBottom` flag is stale-true;
 * - the restore absorbs the load-trigger row's height change when the trigger
 *   swaps back from its loading state after the restore settled;
 * - asking for older history pins any still-running scroll animation before
 *   capturing (a glide can outlive its guard when the scroll-quiet backstop
 *   settles under main-thread jank).
 */
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
const { tick } = await import('svelte');

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

function createConversation(id = 'prepend-conversation'): ConversationHistory {
  const now = '2026-06-01T12:00:00.000Z';
  return {
    schemaVersion: 4,
    id,
    status: 'active',
    metadata: {},
    ids: [],
    messages: {},
    createdAt: now,
    updatedAt: now,
  };
}

function appendMessage(
  conversation: ConversationHistory,
  role: MessageRole,
  id: string,
  content: string,
): ConversationHistory {
  const message: Message = {
    id,
    role,
    content,
    position: conversation.ids.length,
    createdAt: `2026-06-01T12:${String(conversation.ids.length).padStart(2, '0')}:00.000Z`,
    metadata: {},
    hidden: false,
  };
  return {
    ...conversation,
    ids: [...conversation.ids, id],
    messages: { ...conversation.messages, [id]: message },
    updatedAt: message.createdAt,
  };
}

function prependMessages(
  conversation: ConversationHistory,
  entries: { id: string; content: string }[],
): ConversationHistory {
  const olderMessages: Message[] = entries.map((entry, index) => ({
    id: entry.id,
    role: index % 2 === 0 ? 'user' : 'assistant',
    content: entry.content,
    position: index,
    createdAt: '2026-06-01T11:59:00.000Z',
    metadata: {},
    hidden: false,
  }));
  return {
    ...conversation,
    ids: [...olderMessages.map((message) => message.id), ...conversation.ids],
    messages: {
      ...Object.fromEntries(olderMessages.map((message) => [message.id, message])),
      ...Object.fromEntries(
        conversation.ids.map((messageId, index) => {
          const existing = conversation.messages[messageId]!;
          return [messageId, { ...existing, position: olderMessages.length + index }];
        }),
      ),
    },
    updatedAt: conversation.updatedAt,
  };
}

function longConversation(count: number): ConversationHistory {
  let conversation = createConversation();
  for (let index = 0; index < count; index++) {
    conversation = appendMessage(
      conversation,
      index % 2 === 0 ? 'user' : 'assistant',
      `message-${index}`,
      `Message ${index}`,
    );
  }
  return conversation;
}

const MESSAGE_HEIGHT = 100;
const VIEWPORT_HEIGHT = 300;

/**
 * Wait until every transcript row is committed to the DOM, then drain the
 * microtask + macrotask queues so any mount-time auto-scroll continuation has
 * already run. Bun/happy-dom versions differ in when the mount effects flush
 * relative to the test's first interaction (bun 1.3.13 on CI committed the
 * rows LATER than bun 1.3.14 locally, which changed what a click captured);
 * settling first makes the starting state identical everywhere.
 */
async function settleRenderedRows(container: HTMLElement, expectedRows: number): Promise<void> {
  await waitFor(() => {
    expect(container.querySelectorAll('.chat-message').length).toBe(expectedRows);
  });
  await tick();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * A tiny layout model driving `getBoundingClientRect` for message rows so the
 * anchor-measurement path (not the scrollHeight-delta fallback) is exercised.
 *
 * Content coordinates: the load-earlier trigger row occupies
 * [0, triggerHeight), then each transcript message occupies MESSAGE_HEIGHT.
 * Viewport-relative positions subtract the timeline's live scrollTop.
 *
 * The trigger row's height is derived from the trigger's LIVE DOM state —
 * absent → 0, `disabled` (loading) → `loadingTriggerHeight`, idle →
 * `idleTriggerHeight` — exactly as a real layout engine would report it the
 * moment a flush commits. That keeps the model in lockstep with the
 * component's own `isLoadingHistory` / trigger-unmount flushes without the
 * test having to guess when those land (which varies across bun versions).
 *
 * All geometry is injected via OWN properties on the nodes the component
 * actually reads, never via `Element.prototype` patching: every element that
 * Chat obtains goes through the timeline's `querySelector`/`querySelectorAll`,
 * so wrapping those (node-level, like the scrollHeight/clientHeight stubs)
 * lets the model stamp a live `getBoundingClientRect` onto each row at the
 * moment the component retrieves it — including rows freshly created by the
 * `{#key}` block mid-flush. A prototype patch proved unreliable on the CI
 * runner (rects read as zeros there, sending the restore down the
 * scrollHeight-delta fallback) even though node-level stubs held.
 */
function installLayoutModel(
  timeline: HTMLElement,
  options?: { idleTriggerHeight?: number; loadingTriggerHeight?: number },
): {
  relayout: (ids: readonly string[]) => void;
  triggerHeight: () => number;
  scrollTops: { top: number; behavior: string | undefined }[];
  uninstall: () => void;
} {
  const idleTriggerHeight = options?.idleTriggerHeight ?? 0;
  const loadingTriggerHeight = options?.loadingTriggerHeight ?? idleTriggerHeight;
  // Message offsets relative to the END of the trigger row.
  const messageOffsets = new Map<string, number>();

  function relayout(ids: readonly string[]): void {
    messageOffsets.clear();
    for (const [index, id] of ids.entries()) {
      messageOffsets.set(id, index * MESSAGE_HEIGHT);
    }
  }

  const originalQuerySelector = timeline.querySelector.bind(timeline);
  const originalQuerySelectorAll = timeline.querySelectorAll.bind(timeline);

  function triggerHeight(): number {
    const trigger = originalQuerySelector('[data-cinder-history-trigger] button');
    if (!trigger) return 0;
    // Attribute check rather than the HTMLButtonElement `disabled` property:
    // the bound querySelector's return type is plain `Element | null`.
    return trigger.hasAttribute('disabled') ? loadingTriggerHeight : idleTriggerHeight;
  }

  function domRect(top: number, bottom: number): DOMRect {
    return {
      top,
      bottom,
      left: 0,
      right: 400,
      width: 400,
      height: bottom - top,
      x: 0,
      y: top,
      toJSON: () => ({}),
    } as DOMRect;
  }

  // Stamp a LIVE rect (computed from the model + current scrollTop at call
  // time) as an own property on a message row. Own properties cannot be
  // shadowed or bypassed the way a prototype patch can.
  function stampMessageRect(element: Element | null): void {
    if (!element) return;
    const elementId = (element as HTMLElement).id;
    if (!elementId.startsWith('message-')) return;
    (element as HTMLElement).getBoundingClientRect = () => {
      const messageOffset = messageOffsets.get(elementId.slice('message-'.length));
      if (messageOffset === undefined) return domRect(0, 0);
      const viewportTop = triggerHeight() + messageOffset - timeline.scrollTop;
      return domRect(viewportTop, viewportTop + MESSAGE_HEIGHT);
    };
  }

  timeline.querySelector = ((selector: string) => {
    const element = originalQuerySelector(selector);
    stampMessageRect(element);
    return element;
  }) as typeof timeline.querySelector;

  timeline.querySelectorAll = ((selector: string) => {
    const elements = originalQuerySelectorAll(selector);
    for (const element of elements) {
      stampMessageRect(element);
    }
    return elements;
  }) as typeof timeline.querySelectorAll;

  timeline.getBoundingClientRect = () => domRect(0, VIEWPORT_HEIGHT);

  // scrollHeight is derived from the rows currently IN the DOM, not from the
  // model's id list: `$effect.pre` reads it before the DOM mutation commits
  // and must see the pre-prepend extent, exactly as a real layout engine
  // would report it.
  Object.defineProperty(timeline, 'scrollHeight', {
    configurable: true,
    get: () => triggerHeight() + originalQuerySelectorAll('.chat-message').length * MESSAGE_HEIGHT,
  });

  Object.defineProperty(timeline, 'clientHeight', {
    configurable: true,
    value: VIEWPORT_HEIGHT,
  });

  const scrollTops: { top: number; behavior: string | undefined }[] = [];
  timeline.scrollTo = ((options?: ScrollToOptions | number, y?: number) => {
    const top =
      typeof options === 'number' ? (typeof y === 'number' ? y : options) : (options?.top ?? 0);
    const behavior = typeof options === 'object' ? options?.behavior : undefined;
    scrollTops.push({ top, behavior });
    timeline.scrollTop = top;
  }) as typeof timeline.scrollTo;

  return {
    relayout,
    triggerHeight,
    scrollTops,
    // Node-level stubs die with the rendered tree; nothing global to undo.
    uninstall: () => {},
  };
}

describe('history prepend at scrollTop=0 (#1237)', () => {
  test('restores the anchor exactly, synchronously with the prepend flush, and absorbs the loading-trigger height change', async () => {
    let conversation = longConversation(20);
    let resolveLoad: ((result: { hasMore: boolean }) => void) | undefined;
    const adapter = {
      sendMessage: async () => {},
      loadOlderMessages: async () => {
        return await new Promise<{ hasMore: boolean }>((resolve) => {
          resolveLoad = resolve;
        });
      },
    };
    const { container, rerender } = render(Chat, {
      props: { id: 'prepend-anchor-chat', conversation, adapter },
    });
    await settleRenderedRows(container, 20);
    const timeline = container.querySelector<HTMLElement>('.chat-timeline')!;
    const layout = installLayoutModel(timeline, {
      idleTriggerHeight: 50,
      loadingTriggerHeight: 30,
    });
    try {
      layout.relayout(conversation.ids);
      timeline.scrollTop = 0;

      // Capture happens synchronously inside the click handler, BEFORE the
      // loading state flushes to the DOM: the idle trigger (50px) is still
      // measured, so the first visible message (message-0) sits at offset 50.
      const trigger = container.querySelector<HTMLButtonElement>(
        '[data-cinder-history-trigger] button',
      )!;
      await fireEvent.click(trigger);
      // The loading state has committed by now: the trigger is disabled and
      // the model reports its loading (30px) height.
      await waitFor(() => {
        expect(trigger.disabled).toBe(true);
      });
      expect(layout.triggerHeight()).toBe(30);

      const prepended = [
        { id: 'older-0', content: 'Older 0' },
        { id: 'older-1', content: 'Older 1' },
      ];
      conversation = prependMessages(conversation, prepended);
      layout.relayout(conversation.ids);
      await rerender({ id: 'prepend-anchor-chat', conversation, adapter });

      // The restore must land with the SAME flush that committed the prepend
      // — no animation-frame wait — so after rerender's tick the correction
      // has already been applied: the anchor (message-0) moved from content
      // offset 50 (idle trigger) to 30 + 200 = 230 (loading trigger + two
      // prepended rows), so scrollTop compensates to 180 and the anchor stays
      // at viewport offset 50, exactly where it was captured. (Anchor reads
      // go through the timeline's stamped querySelector so the assertion uses
      // the same injected geometry the component measured.)
      expect(timeline.scrollTop).toBe(180);
      const anchorRect = timeline
        .querySelector<HTMLElement>('#message-message-0')!
        .getBoundingClientRect();
      expect(Math.abs(anchorRect.top - 50)).toBeLessThanOrEqual(1);

      // Once the adapter resolves, isLoadingHistory flips back and the
      // trigger re-enables — the model's trigger row grows back to 50px, a
      // 20px shift above the anchor. The post-settle correction must absorb
      // exactly that delta or the anchored message drifts by the trigger-row
      // height difference (#1237's deterministic under-compensation).
      resolveLoad?.({ hasMore: true });
      await waitFor(() => {
        expect(timeline.scrollTop).toBe(200);
      });
      const settledRect = timeline
        .querySelector<HTMLElement>('#message-message-0')!
        .getBoundingClientRect();
      expect(Math.abs(settledRect.top - 50)).toBeLessThanOrEqual(1);
    } finally {
      layout.uninstall();
    }
  });

  test('pins a still-running scroll animation before capturing when no guard is active', async () => {
    const conversation = longConversation(20);
    const adapter = {
      sendMessage: async () => {},
      loadOlderMessages: async () => ({ hasMore: true }),
    };
    const { container } = render(Chat, {
      props: { id: 'prepend-pin-chat', conversation, adapter },
    });
    await settleRenderedRows(container, 20);
    const timeline = container.querySelector<HTMLElement>('.chat-timeline')!;
    const layout = installLayoutModel(timeline, { idleTriggerHeight: 50 });
    try {
      layout.relayout(conversation.ids);
      timeline.scrollTop = 120;

      await fireEvent.click(
        container.querySelector<HTMLButtonElement>('[data-cinder-history-trigger] button')!,
      );

      // No guarded scroll was in flight, so finishUserScrollGuard() had
      // nothing to finish — the load path must still abort any residual
      // animation by pinning the current position with an instant scroll
      // BEFORE the capture (#1237's nondeterministic mode: a glide whose
      // guard settled via the scroll-quiet backstop keeps animating).
      expect(layout.scrollTops[0]).toEqual({ top: 120, behavior: 'instant' });
    } finally {
      layout.uninstall();
    }
  });
});

describe('stick-to-bottom vs history prepend (#1237)', () => {
  test('does not engage on a prepend when live geometry says the viewport is not at the bottom, even with a stale atBottom flag', async () => {
    let conversation = longConversation(20);
    const { container, rerender } = render(Chat, {
      // No adapter/onLoadHistory: this is a plain consumer prepend, so no
      // pending history restoration guards the stick-to-bottom effect (and no
      // trigger row is rendered, so the model's trigger height is 0).
      props: { id: 'prepend-stick-chat', conversation },
    });
    await settleRenderedRows(container, 20);
    const timeline = container.querySelector<HTMLElement>('.chat-timeline')!;
    const layout = installLayoutModel(timeline);
    try {
      layout.relayout(conversation.ids);
      // Parked at the very top of an overflowing transcript. The bindable
      // atBottom prop and the internal flag both still default to TRUE —
      // exactly the stale-flag state a rAF-deferred recompute leaves behind.
      timeline.scrollTop = 0;
      layout.scrollTops.length = 0;

      conversation = prependMessages(conversation, [
        { id: 'older-stick-0', content: 'Older 0' },
        { id: 'older-stick-1', content: 'Older 1' },
      ]);
      layout.relayout(conversation.ids);
      await rerender({ id: 'prepend-stick-chat', conversation });
      await tick();
      await new Promise((resolve) => setTimeout(resolve, 50));

      // The prepend must not be treated as an append: no scroll to the
      // bottom, and no scroll at all (nothing was pending to restore).
      const bottomScrolls = layout.scrollTops.filter(
        (call) => call.top >= timeline.scrollHeight - VIEWPORT_HEIGHT,
      );
      expect(bottomScrolls).toEqual([]);
      expect(timeline.scrollTop).toBe(0);
    } finally {
      layout.uninstall();
    }
  });

  test('still pins the latest message when a prepend lands while genuinely at the bottom', async () => {
    let conversation = longConversation(20);
    const { container, rerender } = render(Chat, {
      props: { id: 'prepend-stick-bottom-chat', conversation },
    });
    await settleRenderedRows(container, 20);
    const timeline = container.querySelector<HTMLElement>('.chat-timeline')!;
    const layout = installLayoutModel(timeline);
    try {
      layout.relayout(conversation.ids);
      // Genuinely parked at the bottom: 20 * 100 - 300 = 1700.
      timeline.scrollTop = 1700;
      layout.scrollTops.length = 0;

      conversation = prependMessages(conversation, [
        { id: 'older-pin-0', content: 'Older 0' },
        { id: 'older-pin-1', content: 'Older 1' },
      ]);
      layout.relayout(conversation.ids);
      await rerender({ id: 'prepend-stick-bottom-chat', conversation });

      // Stick-to-bottom keeps the latest message pinned by scrolling to the
      // (grown) bottom.
      await waitFor(() => {
        expect(
          layout.scrollTops.some((call) => call.top >= timeline.scrollHeight - VIEWPORT_HEIGHT),
        ).toBe(true);
      });
    } finally {
      layout.uninstall();
    }
  });
});
