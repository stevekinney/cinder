/// <reference lib="dom" />
import { afterAll, afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';
import type { ChatAdapterErrorEvent } from './adapter/chat-adapter.ts';
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
const { default: ChatHistoryPaginationFixture } =
  await import('./chat-history-pagination-fixture.svelte');

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

function createConversation(id = 'virtual-conversation'): ConversationHistory {
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

function prependMessage(
  conversation: ConversationHistory,
  role: MessageRole,
  id: string,
  content: string,
): ConversationHistory {
  const message: Message = {
    id,
    role,
    content,
    position: 0,
    createdAt: '2026-06-01T11:59:00.000Z',
    metadata: {},
    hidden: false,
  };
  const ids = [id, ...conversation.ids];
  return {
    ...conversation,
    ids,
    messages: {
      [id]: message,
      ...Object.fromEntries(
        conversation.ids.map((messageId, index) => {
          const existing = conversation.messages[messageId]!;
          return [messageId, { ...existing, position: index + 1 }];
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

function virtualizedProps(conversation: ConversationHistory) {
  return {
    id: 'virtual-chat',
    conversation,
    virtualized: true,
    virtualizationEstimatedRowHeight: 20,
    virtualizationInitialHeight: 100,
    virtualizationOverscan: 0,
  };
}

async function waitForVirtualizedTimeline(container: HTMLElement): Promise<HTMLElement> {
  const timeline = container.querySelector<HTMLElement>('.chat-timeline');
  expect(timeline).not.toBeNull();
  await waitFor(() => expect(timeline?.hasAttribute('data-cinder-virtualized')).toBe(true));
  return timeline!;
}

describe('Chat virtualization', () => {
  test('renders a window from a complete compatible transcript', async () => {
    const conversation = longConversation(80);
    const originalConversation = structuredClone(conversation);
    const { container } = render(Chat, {
      props: virtualizedProps(conversation),
    });

    await waitForVirtualizedTimeline(container);
    await waitFor(() =>
      expect(container.querySelectorAll('.chat-message').length).toBeLessThan(
        conversation.ids.length,
      ),
    );
    const renderedMessages = container.querySelectorAll('.chat-message');

    expect(renderedMessages.length).toBeLessThan(conversation.ids.length);
    expect(container.textContent).toContain('80 messages in conversation');
    expect(conversation.ids).toHaveLength(80);
    expect(Object.keys(conversation.messages).toSorted()).toEqual([...conversation.ids].toSorted());
    expect(conversation).toEqual(originalConversation);
  });

  test('turns off the timeline live region when the transcript is virtualized', async () => {
    const conversation = longConversation(80);
    const { container } = render(Chat, {
      props: virtualizedProps(conversation),
    });

    const timeline = await waitForVirtualizedTimeline(container);

    expect(timeline.getAttribute('role')).toBe('log');
    expect(timeline.getAttribute('aria-live')).toBe('off');
    expect(timeline.hasAttribute('aria-relevant')).toBe(false);
  });

  test('scrolling shifts the rendered message window', async () => {
    const conversation = longConversation(80);
    const { container } = render(Chat, {
      props: virtualizedProps(conversation),
    });
    const timeline = await waitForVirtualizedTimeline(container);

    await waitFor(() => expect(container.textContent).toContain('Message 79'));
    timeline.scrollTop = 1000;
    await fireEvent.scroll(timeline);

    await waitFor(() => expect(container.textContent).not.toContain('Message 0'));
    expect(container.textContent).toContain('Message 50');
  });

  test('search scrolls virtualized off-window matches into the rendered window', async () => {
    const conversation = longConversation(80);
    const { container } = render(Chat, {
      props: virtualizedProps(conversation),
    });
    const timeline = await waitForVirtualizedTimeline(container);
    timeline.scrollTo = (options?: ScrollToOptions | number, y?: number) => {
      timeline.scrollTop =
        typeof options === 'number' ? (typeof y === 'number' ? y : options) : (options?.top ?? 0);
      timeline.dispatchEvent(new Event('scroll'));
    };

    await waitFor(() => expect(container.textContent).toContain('Message 79'));
    await fireEvent.keyDown(container.querySelector('.chat-container')!, {
      key: 'f',
      ctrlKey: true,
    });
    const input = container.querySelector<HTMLInputElement>('.chat-search-input')!;
    await fireEvent.input(input, { target: { value: 'Message 20' } });

    await waitFor(() => expect(container.querySelector('#message-message-20')).not.toBeNull());
    await waitFor(() => expect(timeline.scrollTop).toBeGreaterThan(0));
  });

  test('arrow navigation crosses virtualized window boundaries', async () => {
    const conversation = longConversation(80);
    const { container } = render(Chat, {
      props: virtualizedProps(conversation),
    });
    const timeline = await waitForVirtualizedTimeline(container);
    timeline.scrollTo = (options?: ScrollToOptions | number, y?: number) => {
      timeline.scrollTop =
        typeof options === 'number' ? (typeof y === 'number' ? y : options) : (options?.top ?? 0);
      timeline.dispatchEvent(new Event('scroll'));
    };

    await waitFor(() => expect(container.textContent).toContain('Message 79'));
    timeline.scrollTop = 0;
    await fireEvent.scroll(timeline);
    await waitFor(() => expect(container.querySelector('#message-message-0')).not.toBeNull());
    const renderedMessages = [...container.querySelectorAll<HTMLElement>('.chat-message')];
    const lastRenderedMessage = renderedMessages[renderedMessages.length - 1]!;
    const lastRenderedId = lastRenderedMessage.id;
    lastRenderedMessage.focus();

    await fireEvent.keyDown(timeline, { key: 'ArrowDown' });

    await waitFor(() => expect(document.activeElement?.id).not.toBe(lastRenderedId));
    expect(document.activeElement?.classList.contains('chat-message')).toBe(true);
    expect(timeline.scrollTop).toBeGreaterThan(0);
  });

  test('appending to a virtualized conversation preserves existing rendered rows', async () => {
    let conversation = longConversation(20);
    const { container, rerender } = render(Chat, {
      props: virtualizedProps(conversation),
    });

    await waitForVirtualizedTimeline(container);
    await waitFor(() => expect(container.textContent).toContain('Message 19'));
    const existingRow = container.querySelector<HTMLElement>('#message-message-19');
    expect(existingRow).not.toBeNull();

    conversation = appendMessage(conversation, 'assistant', 'message-20', 'Message 20');
    await rerender(virtualizedProps(conversation));

    await waitFor(() => expect(container.textContent).toContain('Message 20'));
    expect(container.querySelector('#message-message-19')).toBe(existingRow);
  });

  test('appending at the virtualized bottom corrects scroll after row measurement expands', async () => {
    const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
    HTMLElement.prototype.getBoundingClientRect = function getVirtualRowRect() {
      if (this instanceof HTMLElement && this.classList.contains('chat-virtual-row')) {
        const height = this.textContent?.includes('Message 20') ? 120 : 20;
        return new DOMRect(0, 0, 100, height);
      }
      return originalGetBoundingClientRect.call(this);
    };

    try {
      let conversation = longConversation(20);
      const { container, rerender } = render(Chat, {
        props: virtualizedProps(conversation),
      });
      const timeline = await waitForVirtualizedTimeline(container);
      Object.defineProperty(timeline, 'clientHeight', { configurable: true, value: 100 });

      await waitFor(() => expect(container.textContent).toContain('Message 19'));
      await waitFor(() => expect(timeline.scrollTop).toBeGreaterThanOrEqual(300));

      conversation = appendMessage(conversation, 'assistant', 'message-20', 'Message 20');
      await rerender(virtualizedProps(conversation));

      await waitFor(() => expect(container.textContent).toContain('Message 20'));
      await waitFor(() => expect(timeline.scrollTop).toBeGreaterThan(340));
    } finally {
      HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
    }
  });
});

describe('Chat history pagination', () => {
  test('uses an explicit trigger and prepends compatible messages', async () => {
    let conversation = longConversation(3);
    const loadCalls: string[] = [];
    const { container } = render(ChatHistoryPaginationFixture, {
      props: {
        conversation,
        loadHistory: async (currentConversation: ConversationHistory) => {
          loadCalls.push('load');
          conversation = prependMessage(
            currentConversation,
            'assistant',
            'older-message',
            'Earlier context',
          );
          return conversation;
        },
      },
    });

    const trigger = container.querySelector<HTMLButtonElement>(
      '[data-cinder-history-trigger] button',
    );
    expect(trigger?.textContent).toContain('Load earlier messages');
    await fireEvent.click(trigger!);

    await waitFor(() => expect(container.textContent).toContain('Earlier context'));
    expect(loadCalls).toEqual(['load']);
    expect(conversation.ids[0]).toBe('older-message');
    expect(conversation.messages['older-message']?.role).toBe('assistant');
  });

  test('callback history loading preserves non-virtualized scroll position after prepend', async () => {
    let conversation = longConversation(20);
    let timeline: HTMLElement;
    const { container } = render(ChatHistoryPaginationFixture, {
      props: {
        conversation,
        loadHistory: async (currentConversation: ConversationHistory) => {
          conversation = prependMessage(
            currentConversation,
            'assistant',
            'older-message',
            'Earlier context',
          );
          Object.defineProperty(timeline, 'scrollHeight', { configurable: true, value: 1240 });
          return conversation;
        },
      },
    });
    timeline = container.querySelector<HTMLElement>('.chat-timeline')!;
    Object.defineProperty(timeline, 'scrollHeight', { configurable: true, value: 1000 });
    timeline.scrollTop = 120;
    const scrollTops: number[] = [];
    timeline.scrollTo = (options?: ScrollToOptions | number, y?: number) => {
      const top =
        typeof options === 'number' ? (typeof y === 'number' ? y : options) : (options?.top ?? 0);
      scrollTops.push(top);
      timeline.scrollTop = top;
    };

    await fireEvent.click(
      container.querySelector<HTMLButtonElement>('[data-cinder-history-trigger] button')!,
    );

    await waitFor(() => expect(scrollTops).toContain(360));
    expect(container.textContent).toContain('Earlier context');
  });

  test('callback history loading preserves virtualized scroll position after prepend', async () => {
    let conversation = longConversation(20);
    const { container } = render(ChatHistoryPaginationFixture, {
      props: {
        conversation,
        virtualized: true,
        loadHistory: async (currentConversation: ConversationHistory) => {
          conversation = prependMessage(
            currentConversation,
            'assistant',
            'older-virtual-message',
            'Earlier virtual context',
          );
          return conversation;
        },
      },
    });
    const timeline = container.querySelector<HTMLElement>('.chat-timeline')!;
    Object.defineProperty(timeline, 'clientHeight', { configurable: true, value: 100 });
    timeline.scrollTop = 120;
    timeline.scrollTo = (options?: ScrollToOptions | number, y?: number) => {
      const top =
        typeof options === 'number' ? (typeof y === 'number' ? y : options) : (options?.top ?? 0);
      timeline.scrollTop = top;
      timeline.dispatchEvent(new Event('scroll'));
    };

    await fireEvent.click(
      container.querySelector<HTMLButtonElement>('[data-cinder-history-trigger] button')!,
    );

    await waitFor(() => expect(timeline.scrollTop).toBeGreaterThan(120));
    expect(container.querySelector('.chat-timeline')).toBe(timeline);
    expect(conversation.ids[0]).toBe('older-virtual-message');
    await waitFor(() => expect(container.textContent).toContain('1 earlier message loaded'));
    await waitFor(() => expect(container.textContent).toContain('Message 0'));

    timeline.scrollTop += 80;
    await fireEvent.scroll(timeline);

    await waitFor(() => expect(container.textContent).toContain('Message 9'));
    const originalFirstMessageRow = container
      .querySelector('#message-message-0')
      ?.closest<HTMLElement>('.chat-virtual-row');
    await waitFor(() =>
      expect(originalFirstMessageRow?.style.transform).not.toBe(
        `translateY(${timeline.scrollTop}px)`,
      ),
    );
  });

  test('routes history loading through the adapter and hides the trigger when exhausted', async () => {
    const conversation = longConversation(3);
    const loadCalls: string[] = [];
    let resolveLoad: ((result: { hasMore: boolean }) => void) | undefined;
    const adapter = {
      sendMessage: async () => {},
      loadOlderMessages: async (conversationId: string) => {
        loadCalls.push(conversationId);
        return await new Promise<{ hasMore: boolean }>((resolve) => {
          resolveLoad = resolve;
        });
      },
    };
    const { container } = render(Chat, {
      props: {
        id: 'adapter-history-chat',
        conversation,
        adapter,
        loadEarlierLabel: 'Earlier',
        loadingEarlierLabel: 'Loading earlier',
      },
    });

    const trigger = container.querySelector<HTMLButtonElement>(
      '[data-cinder-history-trigger] button',
    )!;
    await fireEvent.click(trigger);

    await waitFor(() => expect(trigger.textContent).toContain('Loading earlier'));
    expect(loadCalls).toEqual(['virtual-conversation']);

    resolveLoad?.({ hasMore: false });
    await waitFor(() =>
      expect(container.querySelector('[data-cinder-history-trigger]')).toBeNull(),
    );
  });

  test('keeps exhausted adapter trigger mounted until virtualized scroll restoration settles', async () => {
    let conversation = longConversation(20);
    const loadCalls: string[] = [];
    let resolveLoad: ((result: { hasMore: boolean }) => void) | undefined;
    let adapterResolved = false;
    const adapter = {
      sendMessage: async () => {},
      loadOlderMessages: async (conversationId: string) => {
        loadCalls.push(conversationId);
        const result = await new Promise<{ hasMore: boolean }>((resolve) => {
          resolveLoad = resolve;
        });
        adapterResolved = true;
        return result;
      },
    };
    const { container, rerender } = render(Chat, {
      props: {
        id: 'adapter-virtual-history-chat',
        conversation,
        adapter,
        virtualized: true,
        virtualizationEstimatedRowHeight: 20,
        virtualizationInitialHeight: 100,
        virtualizationOverscan: 0,
        loadingEarlierLabel: 'Loading earlier',
      },
    });
    const timeline = await waitForVirtualizedTimeline(container);
    Object.defineProperty(timeline, 'clientHeight', { configurable: true, value: 100 });
    timeline.scrollTop = 120;

    await fireEvent.click(
      container.querySelector<HTMLButtonElement>('[data-cinder-history-trigger] button')!,
    );

    expect(loadCalls).toEqual(['virtual-conversation']);
    resolveLoad?.({ hasMore: false });
    await waitFor(() => expect(adapterResolved).toBe(true));

    const loadingTrigger = container.querySelector<HTMLButtonElement>(
      '[data-cinder-history-trigger] button',
    );
    expect(loadingTrigger?.textContent).toContain('Loading earlier');

    conversation = prependMessage(
      conversation,
      'assistant',
      'older-adapter-virtual-message',
      'Earlier adapter virtual context',
    );
    await rerender({
      id: 'adapter-virtual-history-chat',
      conversation,
      adapter,
      virtualized: true,
      virtualizationEstimatedRowHeight: 20,
      virtualizationInitialHeight: 100,
      virtualizationOverscan: 0,
      loadingEarlierLabel: 'Loading earlier',
    });

    await waitFor(() => expect(timeline.scrollTop).toBeGreaterThan(120));
    await waitFor(() =>
      expect(container.querySelector('[data-cinder-history-trigger]')).toBeNull(),
    );
  });

  test('resets adapter history exhaustion when the active conversation changes', async () => {
    const loadCalls: string[] = [];
    const adapter = {
      sendMessage: async () => {},
      loadOlderMessages: async (conversationId: string) => {
        loadCalls.push(conversationId);
        return { hasMore: false };
      },
    };
    const firstConversation = longConversation(3);
    const secondConversation = longConversation(3);
    const secondConversationWithId = { ...secondConversation, id: 'second-conversation' };
    const { container, rerender } = render(Chat, {
      props: {
        id: 'adapter-history-switch-chat',
        conversation: firstConversation,
        adapter,
      },
    });

    await fireEvent.click(
      container.querySelector<HTMLButtonElement>('[data-cinder-history-trigger] button')!,
    );
    await waitFor(() =>
      expect(container.querySelector('[data-cinder-history-trigger]')).toBeNull(),
    );

    await rerender({
      id: 'adapter-history-switch-chat',
      conversation: secondConversationWithId,
      adapter,
    });
    await waitFor(() =>
      expect(container.querySelector('[data-cinder-history-trigger]')).not.toBeNull(),
    );
    await fireEvent.click(
      container.querySelector<HTMLButtonElement>('[data-cinder-history-trigger] button')!,
    );

    await waitFor(() => expect(loadCalls).toEqual(['virtual-conversation', 'second-conversation']));
  });

  test('reports adapter history loading failures without removing the trigger', async () => {
    const conversation = longConversation(3);
    const errors: ChatAdapterErrorEvent[] = [];
    const failure = new Error('history unavailable');
    const adapter = {
      sendMessage: async () => {},
      loadOlderMessages: async () => {
        throw failure;
      },
    };
    const { container } = render(Chat, {
      props: {
        id: 'adapter-history-error-chat',
        conversation,
        adapter,
        onadaptererror: (event: ChatAdapterErrorEvent) => errors.push(event),
      },
    });

    await fireEvent.click(
      container.querySelector<HTMLButtonElement>('[data-cinder-history-trigger] button')!,
    );

    await waitFor(() => expect(errors).toEqual([{ command: 'loadOlderMessages', error: failure }]));
    expect(container.querySelector('[data-cinder-history-trigger]')).not.toBeNull();
  });
});
