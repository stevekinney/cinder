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
import { flushSync, mount, unmount } from 'svelte';

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
const { default: AdapterSwitchFixture } = await import('./chat-adapter-switch-fixture.svelte');

type SwitchFixtureInstance = { setConversation: (next: ConversationHistory) => void };

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
      isStreaming: true,
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
