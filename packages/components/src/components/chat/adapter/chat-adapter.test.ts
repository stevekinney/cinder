/**
 * Tests for the optional ChatAdapter event seam (C2).
 *
 * The adapter is an event/transport boundary, NOT a second conversation model.
 * These tests prove:
 *   1. Equivalence — for the same user action, the adapter method and the
 *      callback prop drive the SAME command, with the adapter taking precedence
 *      when both are present. Exercised through the failed-message retry button
 *      (a deterministic affordance that needs no composer).
 *   2. A conversationalist-shaped transcript snapshot drives Chat unchanged
 *      whether the consumer wires callbacks or an adapter.
 *   3. subscribe lifecycle — subscribed on mount, re-subscribed on
 *      conversation.id change, torn down on unmount.
 *   4. Streaming pushes through subscribe drive the imperative buffer.
 *   5. No behavior change when the adapter is omitted (covered by the existing
 *      chat suite; re-asserted here for the retry path).
 */

/// <reference lib="dom" />
import { afterAll, afterEach, describe, expect, test } from 'bun:test';
import { createRawSnippet, flushSync, mount, tick, unmount } from 'svelte';

import { setupHappyDom } from '../../../test/happy-dom.ts';
import type { ConversationHistory, Message, MessageInput } from '../conversation-model.ts';
import type { ChatAdapter, ChatPushHandlers } from './chat-adapter.ts';

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

const { default: Chat } = await import('../chat.svelte');
const { default: ChatHistoryPaginationFixture } =
  await import('../chat-history-pagination-fixture.svelte');
const { default: AdapterSwitchFixture } = await import('./chat-adapter-switch-fixture.svelte');

type SwitchFixtureInstance = { setConversation: (next: ConversationHistory) => void };
type ChatImperative = {
  beginStreaming: (messageId: string) => void;
  pushToken: (token: string) => void;
  endStreaming: () => void;
  scrollToBottom: () => void;
  scrollToTop: () => void;
};

afterEach(() => {
  document.body.replaceChildren();
});

/**
 * A conversationalist-shaped transcript snapshot with one FAILED assistant
 * message (so the retry affordance renders). The `_deliveryStatus` lives in
 * transient namespaced metadata — exactly how a plain compatible transcript
 * carries UI-only delivery state.
 */
function failedConversation(id = 'adapter-conversation'): ConversationHistory {
  const now = '2026-06-02T00:00:00.000Z';
  const message: Message = {
    id: 'failed-1',
    role: 'assistant',
    content: 'this one failed to send',
    position: 0,
    createdAt: now,
    metadata: { _deliveryStatus: 'failed' },
    hidden: false,
  };
  return {
    schemaVersion: 4,
    id,
    status: 'active',
    metadata: {},
    ids: ['failed-1'],
    messages: { 'failed-1': message },
    createdAt: now,
    updatedAt: now,
  };
}

function mountChat(props: Record<string, unknown>): {
  container: HTMLElement;
  instance: ReturnType<typeof mount>;
} {
  const container = document.createElement('div');
  document.body.append(container);
  const instance = mount(Chat, { target: container, props: props as never });
  flushSync();
  return { container, instance };
}

function clickRetry(container: HTMLElement): void {
  const retry = container.querySelector<HTMLButtonElement>('.chat-message-retry');
  if (!retry) throw new Error('retry button not found');
  retry.click();
  flushSync();
}

function message(
  id: string,
  role: Message['role'],
  content: string,
  position: number,
  createdAt = '2026-06-02T00:00:00.000Z',
): Message {
  return {
    id,
    role,
    content,
    position,
    createdAt,
    metadata: {},
    hidden: false,
  };
}

function conversationFromMessages(id: string, messages: Message[]): ConversationHistory {
  const createdAt = messages[0]?.createdAt ?? '2026-06-02T00:00:00.000Z';
  return {
    schemaVersion: 4,
    id,
    status: 'active',
    metadata: {},
    ids: messages.map((item) => item.id),
    messages: Object.fromEntries(messages.map((item) => [item.id, item])),
    createdAt,
    updatedAt: messages.at(-1)?.createdAt ?? createdAt,
  };
}

function manyMessages(count: number): Message[] {
  return Array.from({ length: count }, (_item, index) =>
    message(
      `message-${index}`,
      index % 2 === 0 ? 'user' : 'assistant',
      `Message ${index}`,
      index,
      `2026-06-02T00:${String(index).padStart(2, '0')}:00.000Z`,
    ),
  );
}

function prependMessageToConversation(
  conversation: ConversationHistory,
  id: string,
  content: string,
): ConversationHistory {
  const olderMessage = message(id, 'assistant', content, 0, '2026-06-01T11:59:00.000Z');
  return {
    ...conversation,
    ids: [id, ...conversation.ids],
    messages: {
      [id]: olderMessage,
      ...Object.fromEntries(
        conversation.ids.map((messageId, index) => {
          const existing = conversation.messages[messageId]!;
          return [messageId, { ...existing, position: index + 1 }];
        }),
      ),
    },
  };
}

function messageIdSnippet(attributeName: string) {
  return createRawSnippet<[Message]>((currentMessage) => ({
    render: () =>
      `<span data-${attributeName}="${currentMessage().id}">${currentMessage().id}</span>`,
    setup: () => {},
  }));
}

function replacingRowSnippet() {
  return createRawSnippet<[Message]>((currentMessage) => ({
    render: () =>
      `<article data-custom-row="${currentMessage().id}">Custom ${currentMessage().role} row</article>`,
    setup: () => {},
  }));
}

function createFileList(files: File[]): FileList {
  const fileList = {
    length: files.length,
    item: (index: number) => files[index] ?? null,
    [Symbol.iterator]: function* iterator() {
      for (const file of files) yield file;
    },
  } as FileList & { [index: number]: File };

  files.forEach((file, index) => {
    fileList[index] = file;
  });

  return fileList;
}

function createDragEvent(type: string, files: File[], types: string[] = ['Files']): DragEvent {
  const event = new Event(type, { bubbles: true, cancelable: true }) as DragEvent;
  Object.defineProperty(event, 'dataTransfer', {
    configurable: true,
    value: {
      files: createFileList(files),
      types,
      dropEffect: 'none',
    },
  });
  return event;
}

describe('ChatAdapter — command equivalence', () => {
  test('retry routes to the callback when no adapter is supplied', () => {
    const retried: string[] = [];
    const { container, instance } = mountChat({
      id: 'chat-cb-retry',
      conversation: failedConversation(),
      onretry: (id: string) => retried.push(id),
    });

    clickRetry(container);
    expect(retried).toEqual(['failed-1']);

    unmount(instance);
  });

  test('retry routes to the adapter when one is supplied', async () => {
    const adapterRetried: string[] = [];
    const adapter: ChatAdapter = {
      sendMessage: async () => {},
      retryMessage: async (id) => {
        adapterRetried.push(id);
      },
    };
    const { container, instance } = mountChat({
      id: 'chat-adapter-retry',
      conversation: failedConversation(),
      adapter,
    });

    clickRetry(container);
    // The adapter method is awaited; let its microtask settle.
    await Promise.resolve();
    expect(adapterRetried).toEqual(['failed-1']);

    unmount(instance);
  });

  test('the adapter takes precedence over the callback (no double-dispatch)', async () => {
    const adapterRetried: string[] = [];
    const callbackRetried: string[] = [];
    const adapter: ChatAdapter = {
      sendMessage: async () => {},
      retryMessage: async (id) => {
        adapterRetried.push(id);
      },
    };
    const { container, instance } = mountChat({
      id: 'chat-precedence',
      conversation: failedConversation(),
      adapter,
      onretry: (id: string) => callbackRetried.push(id),
    });

    clickRetry(container);
    await Promise.resolve();
    // Adapter handled it; the callback did NOT also fire.
    expect(adapterRetried).toEqual(['failed-1']);
    expect(callbackRetried).toEqual([]);

    unmount(instance);
  });

  test('a SYNC adapter method (returns undefined, not a promise) still suppresses the callback', () => {
    // Regression: a synchronously-returning adapter method must still count as
    // "handled" — the matching callback must NOT also fire (no double-dispatch),
    // even though the method returns `undefined` rather than a promise.
    const adapterRetried: string[] = [];
    const callbackRetried: string[] = [];
    const adapter = {
      sendMessage: async () => {},
      // Synchronous, returns undefined (a type-violating but possible JS shape).
      retryMessage: ((id: string) => {
        adapterRetried.push(id);
      }) as unknown as (id: string) => Promise<void>,
    } satisfies ChatAdapter;
    const { container, instance } = mountChat({
      id: 'chat-sync-method',
      conversation: failedConversation(),
      adapter,
      onretry: (id: string) => callbackRetried.push(id),
    });

    clickRetry(container);
    flushSync();
    expect(adapterRetried).toEqual(['failed-1']);
    expect(callbackRetried).toEqual([]);

    unmount(instance);
  });

  test('an adapter command rejection routes to onadaptererror', async () => {
    const errors: Array<{ command: string; error: unknown }> = [];
    const adapter: ChatAdapter = {
      sendMessage: async () => {},
      retryMessage: async () => {
        throw new Error('transport down');
      },
    };
    const { container, instance } = mountChat({
      id: 'chat-error',
      conversation: failedConversation(),
      adapter,
      onadaptererror: (event: { command: string; error: unknown }) => errors.push(event),
    });

    clickRetry(container);
    await Promise.resolve();
    await Promise.resolve();
    expect(errors).toHaveLength(1);
    const errorEvent = errors[0]!;
    expect(errorEvent.command).toBe('retryMessage');
    expect(errorEvent.error).toBeInstanceOf(Error);
    expect((errorEvent.error as Error).message).toBe('transport down');

    unmount(instance);
  });

  test('retry affordance still renders for an adapter-only consumer (no onretry)', () => {
    const adapter: ChatAdapter = { sendMessage: async () => {}, retryMessage: async () => {} };
    const { container, instance } = mountChat({
      id: 'chat-adapter-only',
      conversation: failedConversation(),
      adapter,
    });
    expect(container.querySelector('.chat-message-retry')).not.toBeNull();
    unmount(instance);
  });

  test('no retry affordance when neither a callback nor an adapter can handle it', () => {
    const { container, instance } = mountChat({
      id: 'chat-no-handler',
      conversation: failedConversation(),
    });
    expect(container.querySelector('.chat-message-retry')).toBeNull();
    unmount(instance);
  });

  test('a synchronously-throwing adapter command routes to onadaptererror', async () => {
    // The adapter method throws synchronously (e.g. "not connected") rather than
    // rejecting a promise. The dispatcher must still route it to onadaptererror,
    // not let it escape.
    const errors: Array<{ command: string; error: unknown }> = [];
    const adapter = {
      sendMessage: async () => {},
      retryMessage: () => {
        throw new Error('not connected');
      },
    } satisfies ChatAdapter;
    const { container, instance } = mountChat({
      id: 'chat-sync-throw',
      conversation: failedConversation(),
      adapter,
      onadaptererror: (event: { command: string; error: unknown }) => errors.push(event),
    });

    clickRetry(container);
    await Promise.resolve();
    expect(errors).toHaveLength(1);
    const errorEvent = errors[0]!;
    expect(errorEvent.command).toBe('retryMessage');
    expect(errorEvent.error).toBeInstanceOf(Error);
    expect((errorEvent.error as Error).message).toBe('not connected');

    unmount(instance);
  });

  test('sendMessage: the adapter takes precedence over onsubmit (via an empty-state prompt)', async () => {
    // An empty-state prompt button submits a message — a deterministic submit
    // path that needs no composer. Proves submit routes through the dispatcher
    // with adapter precedence, the same as retry.
    const sent: Array<{ content: unknown }> = [];
    const submitted: unknown[] = [];
    const adapter = {
      sendMessage: async (message: MessageInput) => {
        sent.push({ content: message.content });
      },
    } satisfies ChatAdapter;
    const conversation: ConversationHistory = {
      schemaVersion: 4,
      id: 'send-precedence',
      status: 'active',
      metadata: {},
      ids: [],
      messages: {},
      createdAt: '2026-06-02T00:00:00.000Z',
      updatedAt: '2026-06-02T00:00:00.000Z',
    };
    const { container, instance } = mountChat({
      id: 'chat-send-precedence',
      conversation,
      adapter,
      emptyPrompts: ['Hello there'],
      onsubmit: (event: { message: MessageInput }) => submitted.push(event),
    });

    const prompt = container.querySelector<HTMLButtonElement>('.chat-empty-prompt');
    expect(prompt).not.toBeNull();
    prompt!.click();
    flushSync();
    await Promise.resolve();

    // Adapter handled the send; onsubmit did NOT also fire.
    expect(sent).toEqual([{ content: 'Hello there' }]);
    expect(submitted).toEqual([]);

    unmount(instance);
  });

  test('sendMessage: falls back to onsubmit when no adapter is present', () => {
    const submitted: Array<{ message: MessageInput }> = [];
    const conversation: ConversationHistory = {
      schemaVersion: 4,
      id: 'send-callback',
      status: 'active',
      metadata: {},
      ids: [],
      messages: {},
      createdAt: '2026-06-02T00:00:00.000Z',
      updatedAt: '2026-06-02T00:00:00.000Z',
    };
    const { container, instance } = mountChat({
      id: 'chat-send-callback',
      conversation,
      emptyPrompts: ['Just callback'],
      onsubmit: (event: { message: MessageInput }) => submitted.push(event),
    });

    container.querySelector<HTMLButtonElement>('.chat-empty-prompt')!.click();
    flushSync();
    expect(submitted).toHaveLength(1);
    expect(submitted[0]?.message.content).toBe('Just callback');

    unmount(instance);
  });

  test('sendMessage: a throwing callback prevents submit auto-scroll', async () => {
    const conversation: ConversationHistory = {
      schemaVersion: 4,
      id: 'send-callback-throw',
      status: 'active',
      metadata: {},
      ids: [],
      messages: {},
      createdAt: '2026-06-02T00:00:00.000Z',
      updatedAt: '2026-06-02T00:00:00.000Z',
    };
    const { container, instance } = mountChat({
      id: 'chat-send-callback-throw',
      conversation,
      emptyPrompts: ['Rejected send'],
      onsubmit: () => {
        throw new Error('consumer rejected send');
      },
    });

    const timeline = container.querySelector<HTMLElement>('.chat-timeline');
    expect(timeline).not.toBeNull();
    let scrollCount = 0;
    timeline!.scrollTo = (() => {
      scrollCount += 1;
    }) as HTMLElement['scrollTo'];

    container.querySelector<HTMLButtonElement>('.chat-empty-prompt')!.click();
    flushSync();
    await Promise.resolve();
    await Promise.resolve();

    expect(scrollCount).toBe(0);

    unmount(instance);
  });

  test('stopGenerating: routes to the adapter while streaming', async () => {
    const stopped: string[] = [];
    const adapter = {
      sendMessage: async () => {},
      stopGenerating: async (messageId: string) => {
        stopped.push(messageId);
      },
    } satisfies ChatAdapter;
    // A streaming conversation with a trailing assistant message to stop.
    const now = '2026-06-02T00:00:00.000Z';
    const conversation: ConversationHistory = {
      schemaVersion: 4,
      id: 'stop-conversation',
      status: 'active',
      metadata: {},
      ids: ['u1', 'a1'],
      messages: {
        u1: {
          id: 'u1',
          role: 'user',
          content: 'go',
          position: 0,
          createdAt: now,
          metadata: {},
          hidden: false,
        },
        a1: {
          id: 'a1',
          role: 'assistant',
          content: 'thinking…',
          position: 1,
          createdAt: now,
          metadata: {},
          hidden: false,
        },
      },
      createdAt: now,
      updatedAt: now,
    };
    const { container, instance } = mountChat({
      id: 'chat-stop',
      conversation,
      adapter,
      streaming: true,
    });

    // The stop affordance lives in the composer; find it by its accessible role.
    const stopButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label*="Stop" i], button[title*="Stop" i], .chat-input-stop',
    );
    expect(stopButton).not.toBeNull();
    stopButton!.click();
    flushSync();
    await Promise.resolve();

    expect(stopped).toEqual(['a1']);

    unmount(instance);
  });

  test('message action and status snippets render through the adapter-backed Chat surface', () => {
    const conversation = conversationFromMessages('adapter-message-snippets', [
      message('assistant-1', 'assistant', 'Message with adapter actions', 0),
    ]);
    const { container, instance } = mountChat({
      id: 'chat-adapter-message-snippets',
      conversation,
      adapter: { sendMessage: async () => {} },
      messageActions: messageIdSnippet('message-action'),
      messageStatus: messageIdSnippet('message-status'),
    });

    expect(container.querySelector('[data-message-action="assistant-1"]')).not.toBeNull();
    expect(container.querySelector('[data-message-status="assistant-1"]')).not.toBeNull();
    expect(container.textContent).toContain('Message with adapter actions');

    unmount(instance);
  });

  test('row override can replace a message row without changing the transcript snapshot', () => {
    const conversation = conversationFromMessages('adapter-row-override', [
      message('user-1', 'user', 'Original message text', 0),
    ]);
    const { container, instance } = mountChat({
      id: 'chat-adapter-row-override',
      conversation,
      adapter: { sendMessage: async () => {} },
      row: replacingRowSnippet(),
    });

    expect(container.querySelector('[data-custom-row="user-1"]')?.textContent).toBe(
      'Custom user row',
    );
    expect(container.querySelector('.chat-message')).toBeNull();
    expect(conversation.ids).toEqual(['user-1']);

    unmount(instance);
  });

  test('virtualized rendering windows the DOM without shrinking the compatible transcript', () => {
    const transcript = manyMessages(80);
    const conversation = conversationFromMessages('adapter-virtualized', transcript);
    const { container, instance } = mountChat({
      id: 'chat-adapter-virtualized',
      conversation,
      adapter: { sendMessage: async () => {} },
      virtualized: true,
      virtualizationInitialHeight: 160,
      virtualizationEstimatedRowHeight: 40,
      virtualizationOverscan: 1,
    });

    expect(container.querySelector('.chat-timeline')?.hasAttribute('data-cinder-virtualized')).toBe(
      true,
    );
    expect(container.querySelector('.chat-virtual-spacer')).not.toBeNull();
    expect(container.querySelectorAll('.chat-message').length).toBeLessThan(transcript.length);
    expect(conversation.ids).toHaveLength(80);

    unmount(instance);
  });

  test('virtualized imperative streaming keeps the active stream mounted even when offscreen', () => {
    const frames: FrameRequestCallback[] = [];
    const originalRaf = globalThis.requestAnimationFrame;
    const originalCancelRaf = globalThis.cancelAnimationFrame;
    globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    }) as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = ((handle: number) => {
      if (handle >= 1 && handle <= frames.length) frames[handle - 1] = () => {};
    }) as typeof cancelAnimationFrame;

    const conversation = conversationFromMessages('adapter-virtualized-stream', manyMessages(60));
    const { container, instance } = mountChat({
      id: 'chat-adapter-virtualized-stream',
      conversation,
      adapter: { sendMessage: async () => {} },
      virtualized: true,
      virtualizationInitialHeight: 120,
      virtualizationEstimatedRowHeight: 36,
      virtualizationOverscan: 1,
    });
    const api = instance as unknown as ChatImperative;

    try {
      expect(container.querySelector('#message-message-59')).toBeNull();

      api.beginStreaming('message-59');
      flushSync();
      expect(container.querySelector('#message-message-59')).not.toBeNull();

      api.pushToken('offscreen stream');
      for (const frame of frames.splice(0)) frame(performance.now());
      flushSync();
      expect(container.textContent).toContain('offscreen stream');

      api.scrollToBottom();
      api.scrollToTop();
      api.endStreaming();
    } finally {
      globalThis.requestAnimationFrame = originalRaf;
      globalThis.cancelAnimationFrame = originalCancelRaf;
      unmount(instance);
    }
  });

  test('adapter history loading hides the trigger when the transport is exhausted', async () => {
    const calls: string[] = [];
    const adapter: ChatAdapter = {
      sendMessage: async () => {},
      loadOlderMessages: async (conversationId) => {
        calls.push(conversationId);
        return { hasMore: false };
      },
    };
    const conversation = conversationFromMessages('adapter-history', manyMessages(4));
    const { container, instance } = mountChat({
      id: 'chat-adapter-history',
      conversation,
      adapter,
      moreHistoryAvailable: true,
      loadEarlierLabel: 'Load previous page',
    });

    const trigger = container.querySelector<HTMLButtonElement>('.chat-history-trigger-button');
    expect(trigger).not.toBeNull();
    trigger!.click();
    flushSync();
    await Promise.resolve();
    await tick();
    flushSync();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      if (!container.querySelector('.chat-history-trigger')) break;
      await tick();
      flushSync();
    }

    expect(calls).toEqual(['adapter-history']);
    expect(container.querySelector('.chat-history-trigger') === null).toBe(true);
    expect(conversation.ids).toHaveLength(4);

    unmount(instance);
  });

  test('callback history loading prepends compatible messages without changing the model contract', async () => {
    let conversation = conversationFromMessages('adapter-callback-history', manyMessages(3));
    const loadCalls: string[] = [];
    const target = document.createElement('div');
    document.body.append(target);
    const instance = mount(ChatHistoryPaginationFixture, {
      target,
      props: {
        conversation,
        loadHistory: async (currentConversation: ConversationHistory) => {
          loadCalls.push(currentConversation.id);
          conversation = prependMessageToConversation(
            currentConversation,
            'older-message',
            'Earlier compatible context',
          );
          return conversation;
        },
      },
    });
    flushSync();

    target.querySelector<HTMLButtonElement>('.chat-history-trigger-button')!.click();
    flushSync();
    await Promise.resolve();
    await tick();
    flushSync();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      if (target.textContent?.includes('Earlier compatible context')) break;
      await tick();
      flushSync();
    }

    expect(loadCalls).toEqual(['adapter-callback-history']);
    expect(target.textContent).toContain('Earlier compatible context');
    expect(conversation.ids[0]).toBe('older-message');
    expect(Object.keys(conversation.messages).toSorted()).toEqual([...conversation.ids].toSorted());

    unmount(instance);
    target.remove();
  });

  test('streaming status and non-file drops stay render-only container state', () => {
    const conversation = conversationFromMessages('adapter-container-state', [
      message('user-1', 'user', 'Can you help?', 0),
    ]);
    const { container, instance } = mountChat({
      id: 'chat-adapter-container-state',
      conversation,
      adapter: { sendMessage: async () => {} },
      streaming: true,
      streamingStatus: 'Thinking through the adapter response',
    });
    const root = container.querySelector<HTMLElement>('.chat-container')!;
    const file = new File(['hello'], 'note.txt', { type: 'text/plain' });
    const dropEvent = createDragEvent('drop', [file], ['text/plain']);

    expect(container.querySelector('.chat-typing-indicator')?.textContent).toContain(
      'Thinking through the adapter response',
    );
    root.dispatchEvent(dropEvent);
    flushSync();

    expect(dropEvent.defaultPrevented).toBe(false);
    expect(container.querySelector('.chat-drop-overlay')).toBeNull();
    expect(conversation.ids).toEqual(['user-1']);

    unmount(instance);
  });

  test('editMessage routes through the adapter without mutating the transcript snapshot', async () => {
    const edited: Array<{ messageId: string; content: string }> = [];
    const adapter: ChatAdapter = {
      sendMessage: async () => {},
      editMessage: async (event) => {
        edited.push(event);
      },
    };
    const conversation = conversationFromMessages('adapter-edit', [
      message('user-1', 'user', 'Original text', 0),
    ]);
    const { container, instance } = mountChat({
      id: 'chat-adapter-edit',
      conversation,
      adapter,
    });

    container.querySelector<HTMLButtonElement>('.chat-message-edit-button')!.click();
    flushSync();
    const editor = container.querySelector<HTMLTextAreaElement>('.chat-message-edit-textarea');
    expect(editor).not.toBeNull();
    editor!.value = 'Updated text';
    editor!.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
    container.querySelector<HTMLButtonElement>('.chat-message-edit-save')!.click();
    flushSync();
    await Promise.resolve();

    expect(edited).toEqual([{ messageId: 'user-1', content: 'Updated text' }]);
    expect(conversation.messages['user-1']?.content).toBe('Original text');

    unmount(instance);
  });

  test('file drag overlay is container state and empty file drops do not touch the transcript', () => {
    const conversation = conversationFromMessages('adapter-file-drag', [
      message('user-1', 'user', 'Keep this transcript stable', 0),
    ]);
    const { container, instance } = mountChat({
      id: 'chat-adapter-file-drag',
      conversation,
      adapter: { sendMessage: async () => {} },
      capabilities: { attachments: true },
    });
    const root = container.querySelector<HTMLElement>('.chat-container')!;
    const dragOver = createDragEvent('dragover', []);

    root.dispatchEvent(dragOver);
    flushSync();

    expect(dragOver.defaultPrevented).toBe(true);
    expect(dragOver.dataTransfer?.dropEffect).toBe('copy');
    expect(container.querySelector('.chat-drop-overlay')).not.toBeNull();

    const drop = createDragEvent('drop', []);
    root.dispatchEvent(drop);
    flushSync();

    expect(drop.defaultPrevented).toBe(true);
    expect(container.querySelector('.chat-drop-overlay')).toBeNull();
    expect(conversation.ids).toEqual(['user-1']);

    unmount(instance);
  });

  test('imperative streaming cancels stale animation frames on restart and end', async () => {
    const frames: FrameRequestCallback[] = [];
    const cancelled: number[] = [];
    const originalRaf = globalThis.requestAnimationFrame;
    const originalCancelRaf = globalThis.cancelAnimationFrame;
    globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    }) as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = ((handle: number) => {
      cancelled.push(handle);
      if (handle >= 1 && handle <= frames.length) frames[handle - 1] = () => {};
    }) as typeof cancelAnimationFrame;

    const conversation = conversationFromMessages('adapter-stream-cancel', manyMessages(60));
    const { container, instance } = mountChat({
      id: 'chat-adapter-stream-cancel',
      conversation,
      adapter: { sendMessage: async () => {} },
      virtualized: true,
      virtualizationInitialHeight: 120,
      virtualizationEstimatedRowHeight: 36,
      virtualizationOverscan: 1,
    });
    const api = instance as unknown as ChatImperative;

    try {
      api.beginStreaming('message-59');
      flushSync();
      api.pushToken('stale frame');
      const staleFrameHandle = frames.length;
      api.beginStreaming('message-59');
      flushSync();
      frames[staleFrameHandle - 1]?.(performance.now());
      flushSync();
      expect(cancelled).toContain(staleFrameHandle);
      expect(container.textContent).not.toContain('stale frame');

      api.pushToken('fresh frame');
      const freshFrameHandle = frames.length;
      frames[freshFrameHandle - 1]?.(performance.now());
      flushSync();
      await tick();
      flushSync();
      expect(container.textContent).toContain('fresh frame');

      api.pushToken('cancelled frame');
      const cancelledFrameHandle = frames.length;
      api.endStreaming();
      flushSync();
      frames[cancelledFrameHandle - 1]?.(performance.now());
      flushSync();
      await tick();
      flushSync();
      expect(cancelled).toContain(cancelledFrameHandle);
      expect(container.textContent).not.toContain('cancelled frame');
    } finally {
      globalThis.requestAnimationFrame = originalRaf;
      globalThis.cancelAnimationFrame = originalCancelRaf;
      unmount(instance);
    }
  });
});

describe('ChatAdapter — subscribe lifecycle', () => {
  test('subscribes on mount and tears down on unmount', () => {
    const events: string[] = [];
    const adapter: ChatAdapter = {
      sendMessage: async () => {},
      subscribe: (conversationId) => {
        events.push(`subscribe:${conversationId}`);
        return () => events.push(`teardown:${conversationId}`);
      },
    };
    const { instance } = mountChat({
      id: 'chat-subscribe',
      conversation: failedConversation('conversation-a'),
      adapter,
    });

    expect(events).toEqual(['subscribe:conversation-a']);

    unmount(instance);
    flushSync();
    expect(events).toEqual(['subscribe:conversation-a', 'teardown:conversation-a']);
  });

  test('re-subscribes when conversation.id changes (teardown old, subscribe new)', () => {
    const events: string[] = [];
    const adapter: ChatAdapter = {
      sendMessage: async () => {},
      subscribe: (conversationId) => {
        events.push(`subscribe:${conversationId}`);
        return () => events.push(`teardown:${conversationId}`);
      },
    };
    const target = document.createElement('div');
    document.body.append(target);
    const instance = mount(AdapterSwitchFixture, {
      target,
      props: { initial: failedConversation('conversation-a'), adapter },
    }) as SwitchFixtureInstance;
    flushSync();
    expect(events).toEqual(['subscribe:conversation-a']);

    // Switch to a different conversation id — the old subscription tears down and
    // a new one opens.
    instance.setConversation(failedConversation('conversation-b'));
    flushSync();
    expect(events).toEqual([
      'subscribe:conversation-a',
      'teardown:conversation-a',
      'subscribe:conversation-b',
    ]);

    unmount(instance);
    flushSync();
    expect(events).toEqual([
      'subscribe:conversation-a',
      'teardown:conversation-a',
      'subscribe:conversation-b',
      'teardown:conversation-b',
    ]);
    target.remove();
  });

  test('does NOT re-subscribe when a new conversation snapshot keeps the same id', () => {
    // Regression: the effect keys on the conversation id VALUE, not the object,
    // so a fresh snapshot (common on every transcript update) with an unchanged
    // id must not tear down and reopen the transport.
    const events: string[] = [];
    const adapter: ChatAdapter = {
      sendMessage: async () => {},
      subscribe: (conversationId) => {
        events.push(`subscribe:${conversationId}`);
        return () => events.push(`teardown:${conversationId}`);
      },
    };
    const target = document.createElement('div');
    document.body.append(target);
    const instance = mount(AdapterSwitchFixture, {
      target,
      props: { initial: failedConversation('same-id'), adapter },
    }) as SwitchFixtureInstance;
    flushSync();
    expect(events).toEqual(['subscribe:same-id']);

    // A brand-new conversation object with the SAME id — no resubscription.
    instance.setConversation(failedConversation('same-id'));
    flushSync();
    instance.setConversation(failedConversation('same-id'));
    flushSync();
    expect(events).toEqual(['subscribe:same-id']);

    unmount(instance);
    flushSync();
    expect(events).toEqual(['subscribe:same-id', 'teardown:same-id']);
    target.remove();
  });

  test('switching conversation mid-stream clears the streaming buffer (no leak into the new transcript)', () => {
    // Regression: the subscribe effect's teardown clears the imperative streaming
    // state, so a conversation switch while a push-stream is live does not leave a
    // stale stream driving a row in the new transcript.
    let captured: ChatPushHandlers | undefined;
    const adapter: ChatAdapter = {
      sendMessage: async () => {},
      subscribe: (_conversationId, handlers) => {
        captured = handlers;
        return () => {};
      },
    };

    const frames: FrameRequestCallback[] = [];
    const originalRaf = globalThis.requestAnimationFrame;
    const originalCancelRaf = globalThis.cancelAnimationFrame;
    globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    }) as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = ((handle: number) => {
      if (handle >= 1 && handle <= frames.length) frames[handle - 1] = () => {};
    }) as typeof cancelAnimationFrame;
    const flushFrames = (): void => {
      const pending = frames.splice(0);
      for (const frame of pending) frame(performance.now());
      flushSync();
    };

    // Both conversations carry an assistant message with the SAME id ('a1') so a
    // leaked stream would visibly drive the new transcript's matching row.
    const now = '2026-06-02T00:00:00.000Z';
    const withAssistant = (id: string): ConversationHistory => ({
      schemaVersion: 4,
      id,
      status: 'active',
      metadata: {},
      ids: ['a1'],
      messages: {
        a1: {
          id: 'a1',
          role: 'assistant',
          content: 'final content',
          position: 0,
          createdAt: now,
          metadata: {},
          hidden: false,
        },
      },
      createdAt: now,
      updatedAt: now,
    });

    const target = document.createElement('div');
    document.body.append(target);
    try {
      const instance = mount(AdapterSwitchFixture, {
        target,
        props: { initial: withAssistant('conversation-a'), adapter },
      }) as SwitchFixtureInstance;
      flushSync();

      // Start a push-stream into a1 (no onStreamEnd — the stream is still live).
      captured!.onStreamBegin('a1');
      captured!.onTokenPush('streaming…');
      flushFrames();
      expect(target.querySelector('.message-content-cursor')).not.toBeNull();

      // Switch to a different conversation whose a1 is NOT streaming. The effect
      // teardown must clear the stream so the cursor is gone and the new row shows
      // its own content, not the leaked stream buffer.
      instance.setConversation(withAssistant('conversation-b'));
      flushSync();
      expect(target.querySelector('.message-content-cursor')).toBeNull();
      expect(target.textContent).toContain('final content');

      unmount(instance);
    } finally {
      globalThis.requestAnimationFrame = originalRaf;
      globalThis.cancelAnimationFrame = originalCancelRaf;
      target.remove();
    }
  });

  test('mounts cleanly when the adapter has no subscribe method', () => {
    const adapter: ChatAdapter = { sendMessage: async () => {} };
    const { instance } = mountChat({
      id: 'chat-no-subscribe',
      conversation: failedConversation(),
      adapter,
    });
    // The `if (!resolvedAdapter?.subscribe) return` guard means no subscription
    // is opened; the only observable contract is a clean mount + unmount.
    expect(() => unmount(instance)).not.toThrow();
  });

  test('a subscribe that returns a non-function teardown does not crash cleanup', () => {
    // Contract violation by the adapter: subscribe must return an unsubscribe
    // function. The container guards the teardown so a bad return is dropped
    // rather than crashing Svelte's effect cleanup on unmount/re-subscribe.
    const adapter = {
      sendMessage: async () => {},
      // Intentionally returns a non-function to exercise the guard.
      subscribe: () => undefined as unknown as () => void,
    } satisfies ChatAdapter;
    const { instance } = mountChat({
      id: 'chat-bad-teardown',
      conversation: failedConversation('bad-teardown'),
      adapter,
    });
    expect(() => {
      unmount(instance);
      flushSync();
    }).not.toThrow();
  });

  test('streaming pushes through subscribe drive the imperative buffer', () => {
    let captured: ChatPushHandlers | undefined;
    const adapter: ChatAdapter = {
      sendMessage: async () => {},
      subscribe: (_conversationId, handlers) => {
        captured = handlers;
        return () => {};
      },
    };
    // A conversation with an empty assistant message to stream into.
    const now = '2026-06-02T00:00:00.000Z';
    const conversation: ConversationHistory = {
      schemaVersion: 4,
      id: 'stream-conversation',
      status: 'active',
      metadata: {},
      ids: ['a1'],
      messages: {
        a1: {
          id: 'a1',
          role: 'assistant',
          content: '',
          position: 0,
          createdAt: now,
          metadata: {},
          hidden: false,
        },
      },
      createdAt: now,
      updatedAt: now,
    };
    // pushToken batches its buffer flush into a requestAnimationFrame. happy-dom
    // never advances rAF on its own, so capture the scheduled callbacks and flush
    // them by hand — otherwise the streamed content would never reach the DOM and
    // the assertion below would be meaningless.
    const frames: FrameRequestCallback[] = [];
    const originalRaf = globalThis.requestAnimationFrame;
    const originalCancelRaf = globalThis.cancelAnimationFrame;
    globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    }) as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = ((handle: number) => {
      // 1-based handles map to frames[handle - 1].
      if (handle >= 1 && handle <= frames.length) frames[handle - 1] = () => {};
    }) as typeof cancelAnimationFrame;
    const flushFrames = (): void => {
      const pending = frames.splice(0);
      for (const frame of pending) frame(performance.now());
      flushSync();
    };

    try {
      const { container, instance } = mountChat({
        id: 'chat-stream',
        conversation,
        adapter,
      });

      expect(captured).toBeDefined();

      // Drive a push-stream entirely through the subscription handlers.
      captured!.onStreamBegin('a1');
      captured!.onTokenPush('Hel');
      captured!.onTokenPush('lo');
      flushFrames();

      // The streamed tokens were accumulated and flushed into the message body —
      // proving onStreamBegin/onTokenPush actually drive the imperative buffer.
      const streamed = container.querySelector('#message-a1');
      expect(streamed?.textContent).toContain('Hello');

      // onStreamEnd clears the buffer; the message keeps its own (empty) content.
      captured!.onStreamEnd();
      flushSync();
      expect(container.querySelector('.message-content-cursor')).toBeNull();

      unmount(instance);
    } finally {
      globalThis.requestAnimationFrame = originalRaf;
      globalThis.cancelAnimationFrame = originalCancelRaf;
    }
  });
});

describe('ChatAdapter — push forwarding', () => {
  test('subscribe push events forward to the consumer callbacks (Chat does not mutate the transcript)', () => {
    let captured: ChatPushHandlers | undefined;
    const adapter: ChatAdapter = {
      sendMessage: async () => {},
      subscribe: (_conversationId, handlers) => {
        captured = handlers;
        return () => {};
      },
    };
    const pushedMessages: Message[] = [];
    let typing: boolean | undefined;
    const receipts: Array<{ messageId: string; readAt: string }> = [];

    const conversation = failedConversation('forward-conversation');
    const { instance } = mountChat({
      id: 'chat-forward',
      conversation,
      adapter,
      onpushmessage: (message: Message) => pushedMessages.push(message),
      ontypingchange: (isTyping: boolean) => {
        typing = isTyping;
      },
      onreadreceipt: (event: { messageId: string; readAt: string }) => receipts.push(event),
    });

    const incoming: Message = {
      id: 'incoming-1',
      role: 'user',
      content: 'pushed in',
      position: 1,
      createdAt: '2026-06-02T00:00:00.000Z',
      metadata: {},
      hidden: false,
    };
    captured!.onMessage(incoming);
    captured!.onTypingChange(true);
    captured!.onReadReceipt({ messageId: 'failed-1', readAt: '2026-06-02T00:01:00.000Z' });

    expect(pushedMessages).toEqual([incoming]);
    expect(typing).toBe(true);
    expect(receipts).toEqual([{ messageId: 'failed-1', readAt: '2026-06-02T00:01:00.000Z' }]);

    // The rendered transcript is unchanged — Chat forwarded, it did not append.
    expect(conversation.ids).toEqual(['failed-1']);

    unmount(instance);
  });
});

/**
 * A compatible transcript whose latest tool-result requests approval
 * (outcome === 'action_required' with an action). This is exactly how a plain
 * conversationalist transcript carries an action-required tool call — no
 * Cinder-only fields. C3 derives the approval prompt from it.
 */
function actionRequiredConversation(id = 'approval-conversation'): ConversationHistory {
  const now = '2026-06-02T00:00:00.000Z';
  const result: Message = {
    id: 'tr-1',
    role: 'tool-result',
    content: '',
    position: 0,
    createdAt: now,
    metadata: {},
    hidden: false,
    toolResult: {
      callId: 'call-1',
      outcome: 'action_required',
      content: null,
      action: { type: 'approval', message: 'Deploy to production?' },
    },
  };
  return {
    schemaVersion: 4,
    id,
    status: 'active',
    metadata: {},
    ids: ['tr-1'],
    messages: { 'tr-1': result },
    createdAt: now,
    updatedAt: now,
  };
}

function approvalButton(container: HTMLElement, label: 'Approve' | 'Reject'): HTMLButtonElement {
  const buttons = Array.from(
    container.querySelectorAll<HTMLButtonElement>('.chat-tool-approval-btn'),
  );
  const match = buttons.find((button) => button.textContent?.trim() === label);
  if (!match) throw new Error(`approval button "${label}" not found`);
  return match;
}

describe('ChatAdapter — tool approval', () => {
  test('approve commits and, on adapter SUCCESS, fires the onapprove callback (adapter-then-callback)', async () => {
    const approvedViaAdapter: string[] = [];
    const approvedViaCallback: string[] = [];
    const adapter: ChatAdapter = {
      sendMessage: async () => {},
      approveToolCall: async (callId) => {
        approvedViaAdapter.push(callId);
      },
    };
    const { container, instance } = mountChat({
      id: 'chat-approve-success',
      conversation: actionRequiredConversation(),
      adapter,
      onapprove: (callId: string) => approvedViaCallback.push(callId),
    });

    approvalButton(container, 'Approve').click();
    await Promise.resolve();
    await Promise.resolve();

    expect(approvedViaAdapter).toEqual(['call-1']);
    // Callback fires AFTER the adapter resolves — not skipped.
    expect(approvedViaCallback).toEqual(['call-1']);
    // The prompt is resolved (no Approve button remains).
    expect(container.querySelector('.chat-tool-approval-btn-approve')).toBeNull();

    unmount(instance);
  });

  test('approve rolls back and surfaces onadaptererror when the adapter REJECTS', async () => {
    const errors: Array<{ command: string; error: unknown }> = [];
    const approvedViaCallback: string[] = [];
    const adapter: ChatAdapter = {
      sendMessage: async () => {},
      approveToolCall: async () => {
        throw new Error('transport down');
      },
    };
    const { container, instance } = mountChat({
      id: 'chat-approve-reject',
      conversation: actionRequiredConversation(),
      adapter,
      onapprove: (callId: string) => approvedViaCallback.push(callId),
      onadaptererror: (event: { command: string; error: unknown }) => errors.push(event),
    });

    approvalButton(container, 'Approve').click();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(errors).toHaveLength(1);
    expect(errors[0]!.command).toBe('approveToolCall');
    // The callback must NOT fire on adapter failure.
    expect(approvedViaCallback).toEqual([]);
    // The optimistic resolution rolled back — the prompt is pending again.
    expect(container.querySelector('.chat-tool-approval-btn-approve')).not.toBeNull();

    unmount(instance);
  });

  test('deny rolls back on a synchronously-throwing adapter command', async () => {
    const errors: Array<{ command: string; error: unknown }> = [];
    const adapter = {
      sendMessage: async () => {},
      denyToolCall: () => {
        throw new Error('not connected');
      },
    } satisfies ChatAdapter;
    const { container, instance } = mountChat({
      id: 'chat-deny-sync-throw',
      conversation: actionRequiredConversation(),
      adapter,
      onadaptererror: (event: { command: string; error: unknown }) => errors.push(event),
    });

    approvalButton(container, 'Reject').click();
    await Promise.resolve();

    expect(errors).toHaveLength(1);
    expect(errors[0]!.command).toBe('denyToolCall');
    // Rolled back — Reject button is still present (prompt pending).
    expect(container.querySelector('.chat-tool-approval-btn-deny')).not.toBeNull();

    unmount(instance);
  });

  test('approve routes to the callback when no adapter method is supplied', () => {
    const approved: string[] = [];
    const { container, instance } = mountChat({
      id: 'chat-approve-callback',
      conversation: actionRequiredConversation(),
      onapprove: (callId: string) => approved.push(callId),
    });

    approvalButton(container, 'Approve').click();
    expect(approved).toEqual(['call-1']);

    unmount(instance);
  });

  test('the approval buttons are disabled when NEITHER an adapter method NOR a callback can handle it', () => {
    const { container, instance } = mountChat({
      id: 'chat-approve-no-handler',
      conversation: actionRequiredConversation(),
    });

    expect(approvalButton(container, 'Approve').disabled).toBe(true);
    expect(approvalButton(container, 'Reject').disabled).toBe(true);

    unmount(instance);
  });
});

describe('Chat — suggested replies (C5) are a last-turn affordance', () => {
  function suggestionMessage(id: string, position: number, labels: string[]): Message {
    return {
      id,
      role: 'assistant',
      content: `reply ${id}`,
      position,
      createdAt: `2026-06-02T00:0${position}:00.000Z`,
      metadata: { 'cinder:suggestions': labels },
      hidden: false,
    };
  }

  test('only the LAST message renders suggestion chips, even when earlier ones carry the metadata', () => {
    // Two assistant turns both carry cinder:suggestions metadata. Suggestions are
    // a per-turn affordance — only the latest turn should show chips, not every
    // historical message that still carries the metadata. (Cursor Bugbot.)
    const conversation = conversationFromMessages('chat-suggestions', [
      suggestionMessage('older', 0, ['Stale one', 'Stale two']),
      suggestionMessage('latest', 1, ['Fresh one', 'Fresh two']),
    ]);
    const { container, instance } = mountChat({ id: 'chat-suggestions', conversation });

    const toolbars = container.querySelectorAll('[role="toolbar"][aria-label="Suggested replies"]');
    expect(toolbars).toHaveLength(1);

    const chipText = Array.from(toolbars[0]!.querySelectorAll('[data-cinder-suggestion]')).map(
      (chip) => chip.textContent?.trim(),
    );
    expect(chipText).toEqual(['Fresh one', 'Fresh two']);
    // The stale earlier-turn suggestions must NOT render.
    expect(container.textContent).not.toContain('Stale one');

    unmount(instance);
  });
});
