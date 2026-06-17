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

describe('Chat virtualization', () => {
  test('renders a window from a complete compatible transcript', async () => {
    const conversation = longConversation(80);
    const { container } = render(Chat, {
      props: virtualizedProps(conversation),
    });

    await waitFor(() =>
      expect(container.querySelectorAll('.chat-message').length).toBeGreaterThan(0),
    );
    const renderedMessages = container.querySelectorAll('.chat-message');

    expect(renderedMessages.length).toBeLessThan(conversation.ids.length);
    expect(container.textContent).toContain('80 messages in conversation');
    expect(conversation.ids).toHaveLength(80);
    expect(Object.keys(conversation.messages).toSorted()).toEqual([...conversation.ids].toSorted());
  });

  test('scrolling shifts the rendered message window', async () => {
    const conversation = longConversation(80);
    const { container } = render(Chat, {
      props: virtualizedProps(conversation),
    });
    const timeline = container.querySelector<HTMLElement>('.chat-timeline')!;

    await waitFor(() => expect(container.textContent).toContain('Message 79'));
    timeline.scrollTop = 1000;
    await fireEvent.scroll(timeline);

    await waitFor(() => expect(container.textContent).toContain('Message 50'));
    expect(container.textContent).not.toContain('Message 0');
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
