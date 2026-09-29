/// <reference lib="dom" />
import { afterAll, afterEach, describe, expect, test } from 'bun:test';
import type { Component } from 'svelte';
import { flushSync, mount, unmount } from 'svelte';

import { setupHappyDom } from '@lostgradient/testing';
import type { ConversationHistory, Message } from '../conversation-model.ts';
import type { ChatAdapter, ChatPushHandlers } from './chat-adapter.ts';

setupHappyDom();

class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
class TestIntersectionObserver {
  readonly root = null;
  readonly rootMargin = '';
  readonly thresholds: readonly number[] = [];
  constructor(_callback: IntersectionObserverCallback, _options?: IntersectionObserverInit) {
    void _callback;
    void _options;
  }
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}
const resizeObserverDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'ResizeObserver');
const intersectionObserverDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  'IntersectionObserver',
);
globalThis.ResizeObserver = TestResizeObserver;
Object.defineProperty(globalThis, 'IntersectionObserver', {
  configurable: true,
  writable: true,
  value: TestIntersectionObserver,
});
afterAll(() => {
  if (resizeObserverDescriptor)
    Object.defineProperty(globalThis, 'ResizeObserver', resizeObserverDescriptor);
  else delete (globalThis as { ResizeObserver?: unknown }).ResizeObserver;
  if (intersectionObserverDescriptor)
    Object.defineProperty(globalThis, 'IntersectionObserver', intersectionObserverDescriptor);
  else delete (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver;
});

const { default: AdapterSwitchFixture } = await import('./chat-adapter-switch-fixture.svelte');
type Fixture =
  typeof AdapterSwitchFixture extends Component<any, infer Exports, any> ? Exports : never;
type MountedFixture = { instance: Fixture; target: HTMLElement };
let sequence = 0;
function streamingConversation(id: string): ConversationHistory {
  const now = new Date().toISOString();
  const userId = `message-${++sequence}`;
  const assistantId = `assistant-${++sequence}`;
  const user: Message = {
    id: userId,
    role: 'user',
    content: 'Hello',
    position: 0,
    createdAt: now,
    metadata: {},
    hidden: false,
  };
  const assistant: Message = {
    id: assistantId,
    role: 'assistant',
    content: '',
    position: 1,
    createdAt: now,
    metadata: {},
    hidden: false,
  };
  return {
    schemaVersion: 4,
    id,
    status: 'active',
    metadata: {},
    ids: [userId, assistantId],
    messages: { [userId]: user, [assistantId]: assistant },
    createdAt: now,
    updatedAt: now,
  };
}
function conversation(id: string): ConversationHistory {
  const now = new Date().toISOString();
  const messageId = `message-${++sequence}`;
  const message: Message = {
    id: messageId,
    role: 'user',
    content: 'Hello',
    position: 0,
    createdAt: now,
    metadata: {},
    hidden: false,
  };
  return {
    schemaVersion: 4,
    id,
    status: 'active',
    metadata: {},
    ids: [messageId],
    messages: { [messageId]: message },
    createdAt: now,
    updatedAt: now,
  };
}
function adapter(
  name: string,
  subscriptions: Array<{ name: string; handlers: ChatPushHandlers }>,
  events: string[],
): ChatAdapter {
  return {
    sendMessage: async () => {},
    subscribe: (conversationId, handlers) => {
      events.push(`subscribe:${name}:${conversationId}`);
      subscriptions.push({ name, handlers });
      return () => events.push(`teardown:${name}:${conversationId}`);
    },
  };
}
const mountedFixtures = new Set<Fixture>();
function mountFixture(
  initial: ConversationHistory,
  currentAdapter: ChatAdapter,
  onPushMessage: (message: Message) => void,
): MountedFixture {
  const target = document.createElement('div');
  document.body.append(target);
  const instance = mount(AdapterSwitchFixture, {
    target,
    props: { initial, adapter: currentAdapter, onPushMessage },
  });
  mountedFixtures.add(instance);
  return { instance, target };
}
afterEach(async () => {
  for (const instance of mountedFixtures) await unmount(instance);
  mountedFixtures.clear();
  document.body.replaceChildren();
});

describe('Chat adapter subscription replacement races', () => {
  test('tears down before replacement and fences every stale push handler', async () => {
    const events: string[] = [];
    const subscriptions: Array<{ name: string; handlers: ChatPushHandlers }> = [];
    const first = adapter('first', subscriptions, events);
    const second = adapter('second', subscriptions, events);
    const pushed: Message[] = [];
    const initial = streamingConversation('same-conversation');
    const view = mountFixture(initial, first, (message) => pushed.push(message));
    flushSync();
    const oldHandlers = subscriptions[0]!.handlers;
    const userId = initial.ids[0]!;
    const assistantId = initial.ids[1]!;
    view.instance.setAdapter(second);
    flushSync();

    expect(events).toEqual([
      'subscribe:first:same-conversation',
      'teardown:first:same-conversation',
      'subscribe:second:same-conversation',
    ]);
    const staleMessage = initial.messages[userId];
    if (!staleMessage) throw new Error('Missing stale message');
    const secondHandlers = subscriptions[1]!.handlers;
    const frames: FrameRequestCallback[] = [];
    const originalRaf = globalThis.requestAnimationFrame;
    const originalCancelRaf = globalThis.cancelAnimationFrame;
    globalThis.requestAnimationFrame = (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    };
    globalThis.cancelAnimationFrame = (handle: number) => {
      if (handle >= 1 && handle <= frames.length) frames[handle - 1] = () => {};
    };
    const flushFrames = (): void => {
      const pending = frames.splice(0);
      for (const frame of pending) frame(performance.now());
      flushSync();
    };
    try {
      secondHandlers.onStreamBegin(assistantId);
      secondHandlers.onTokenPush('live');
      flushFrames();
      const liveCursor = view.target.querySelector('.chat-message-streaming-progress');
      expect(liveCursor).not.toBeNull();
      expect(view.target.querySelector('.message-content-streaming')?.textContent).toContain(
        'live',
      );

      const liveText = view.target.querySelector('.message-content-streaming')?.textContent;

      oldHandlers.onStreamBegin(assistantId);
      flushSync();
      expect(view.target.querySelector('.message-content-streaming')?.textContent).toBe(liveText);
      oldHandlers.onTokenPush('stale');
      flushFrames();
      expect(view.target.querySelector('.message-content-streaming')?.textContent).toBe(liveText);
      oldHandlers.onStreamEnd();
      flushSync();
      expect(view.target.querySelector('.chat-message-streaming-progress')).not.toBeNull();

      oldHandlers.onMessage(staleMessage);
      oldHandlers.onTypingChange([{ id: 'adapter-alice', name: 'Alice' }]);
      oldHandlers.onReadReceipt({ messageId: userId, readAt: new Date().toISOString() });
      flushSync();
      expect(pushed).toHaveLength(0);
      expect(view.target.querySelector('.chat-participant-typing-label')).toBeNull();
      expect(view.target.querySelector('[data-cinder-receipt-status]')).toBeNull();

      view.instance.setConversation(conversation('next-conversation'));
      flushSync();
      secondHandlers.onMessage(staleMessage);
      expect(pushed).toHaveLength(0);
      const currentHandlers = subscriptions[2]!.handlers;
      await unmount(view.instance);
      mountedFixtures.delete(view.instance);
      currentHandlers.onMessage(staleMessage);
      expect(pushed).toHaveLength(0);
    } finally {
      globalThis.requestAnimationFrame = originalRaf;
      globalThis.cancelAnimationFrame = originalCancelRaf;
    }
  });
});
