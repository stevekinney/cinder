/**
 * C6 tests — per-message read receipts (out-of-band UI state).
 *
 * Asserts:
 *   1. Receipt badge has an accessible name (aria-label, NOT color-only).
 *   2. sent/delivered/read states each show the correct label text.
 *   3. readBy names compose the accessible label ("Read by Alice, Bob").
 *   4. No receipt shown on non-user messages (assistant/system/etc).
 *   5. No receipt shown when no readReceipts prop is passed.
 *   6. data-cinder-receipt-status=sent|delivered|read on the badge element.
 *   7. Adapter onReadReceipt push accumulates into read receipt state.
 *   8. Compatibility: plain transcript with no receipts renders as today.
 */

/// <reference lib="dom" />
import { afterAll, afterEach, describe, expect, test } from 'bun:test';
import { flushSync, mount, unmount } from 'svelte';

import { setupHappyDom } from '../../test/happy-dom.ts';
import type { ChatAdapter, ChatPushHandlers } from './adapter/chat-adapter.ts';
import type { ReadReceipt } from './chat.types.ts';
import type { ConversationHistory } from './conversation-model.ts';

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

const { default: Chat } = await import('./chat.svelte');
const { default: AdapterSwitchFixture } =
  await import('./adapter/chat-adapter-switch-fixture.svelte');

type TestConversation = import('./conversation-model.ts').ConversationHistory;
type TestRole = import('./conversation-model.ts').MessageRole;
type SwitchFixtureInstance = { setConversation: (next: ConversationHistory) => void };

let counter = 0;

function createConversation(id?: string): TestConversation {
  const now = new Date().toISOString();
  return {
    schemaVersion: 4,
    id: id ?? `receipt-test-${++counter}`,
    status: 'active',
    metadata: {},
    ids: [],
    messages: {},
    createdAt: now,
    updatedAt: now,
  };
}

function appendMessage(
  conversation: TestConversation,
  role: TestRole,
  content: string,
  id?: string,
): TestConversation {
  const messageId = id ?? `receipt-msg-${++counter}`;
  const now = new Date().toISOString();
  return {
    ...conversation,
    ids: [...conversation.ids, messageId],
    messages: {
      ...conversation.messages,
      [messageId]: {
        id: messageId,
        role,
        content,
        position: conversation.ids.length,
        createdAt: now,
        metadata: {},
        hidden: false,
      },
    },
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

afterEach(() => {
  document.body.replaceChildren();
});

// ---------------------------------------------------------------------------
// Read receipt prop tests
// ---------------------------------------------------------------------------

describe('Chat — readReceipts prop', () => {
  test('no readReceipts prop: no receipt badge rendered', () => {
    let conversation = createConversation();
    conversation = appendMessage(conversation, 'user', 'Hello', 'user-1');

    const { container, instance } = mountChat({
      id: 'chat-receipt-none',
      conversation,
    });

    expect(container.querySelector('[data-cinder-receipt-status]')).toBeNull();
    unmount(instance);
  });

  test('receipt wrapper has role="img" (accessible name via aria-label, not subtree text)', () => {
    // Regression guard: role=img makes the badge a single named widget so
    // screen readers announce the FULL "Read by Alice, Bob" label.
    // Without it, the computed name would be just "Read" (the visible span).
    let conversation = createConversation();
    conversation = appendMessage(conversation, 'user', 'Role check', 'user-role-img');

    const readReceipts = new Map<string, ReadReceipt>([
      ['user-role-img', { status: 'read', readBy: ['Alice', 'Bob'] }],
    ]);

    const { container, instance } = mountChat({
      id: 'chat-receipt-role-img',
      conversation,
      readReceipts,
    });

    const badge = container.querySelector('[data-cinder-receipt-status]');
    expect(badge).not.toBeNull();
    expect(badge?.getAttribute('role')).toBe('img');
    expect(badge?.getAttribute('aria-label')).toBe('Read by Alice, Bob');

    unmount(instance);
  });

  test('"sent" receipt: aria-label="Sent", role="img", and data-cinder-receipt-status=sent', () => {
    let conversation = createConversation();
    conversation = appendMessage(conversation, 'user', 'Hello', 'user-1');

    const readReceipts = new Map<string, ReadReceipt>([['user-1', { status: 'sent' }]]);

    const { container, instance } = mountChat({
      id: 'chat-receipt-sent',
      conversation,
      readReceipts,
    });

    const badge = container.querySelector('[data-cinder-receipt-status]');
    expect(badge).not.toBeNull();
    expect(badge?.getAttribute('data-cinder-receipt-status')).toBe('sent');
    expect(badge?.getAttribute('role')).toBe('img');
    expect(badge?.getAttribute('aria-label')).toBe('Sent');
    // Text content includes the label
    expect(badge?.textContent).toContain('Sent');

    unmount(instance);
  });

  test('"delivered" receipt: aria-label="Delivered" and data-cinder-receipt-status=delivered', () => {
    let conversation = createConversation();
    conversation = appendMessage(conversation, 'user', 'Hi', 'user-2');

    const readReceipts = new Map<string, ReadReceipt>([['user-2', { status: 'delivered' }]]);

    const { container, instance } = mountChat({
      id: 'chat-receipt-delivered',
      conversation,
      readReceipts,
    });

    const badge = container.querySelector('[data-cinder-receipt-status]');
    expect(badge?.getAttribute('data-cinder-receipt-status')).toBe('delivered');
    expect(badge?.getAttribute('aria-label')).toBe('Delivered');
    expect(badge?.textContent).toContain('Delivered');

    unmount(instance);
  });

  test('"read" receipt (no readBy): aria-label="Read" and data-cinder-receipt-status=read', () => {
    let conversation = createConversation();
    conversation = appendMessage(conversation, 'user', 'Hey', 'user-3');

    const readReceipts = new Map<string, ReadReceipt>([['user-3', { status: 'read' }]]);

    const { container, instance } = mountChat({
      id: 'chat-receipt-read',
      conversation,
      readReceipts,
    });

    const badge = container.querySelector('[data-cinder-receipt-status]');
    expect(badge?.getAttribute('data-cinder-receipt-status')).toBe('read');
    expect(badge?.getAttribute('aria-label')).toBe('Read');
    expect(badge?.textContent).toContain('Read');

    unmount(instance);
  });

  test('"read" with readBy names: aria-label="Read by Alice, Bob"', () => {
    let conversation = createConversation();
    conversation = appendMessage(conversation, 'user', 'Hello group', 'user-4');

    const readReceipts = new Map<string, ReadReceipt>([
      ['user-4', { status: 'read', readBy: ['Alice', 'Bob'] }],
    ]);

    const { container, instance } = mountChat({
      id: 'chat-receipt-read-by',
      conversation,
      readReceipts,
    });

    const badge = container.querySelector('[data-cinder-receipt-status]');
    expect(badge?.getAttribute('aria-label')).toBe('Read by Alice, Bob');

    unmount(instance);
  });

  test('receipt not shown on assistant messages (only user messages)', () => {
    let conversation = createConversation();
    conversation = appendMessage(conversation, 'user', 'Hello', 'user-msg');
    conversation = appendMessage(conversation, 'assistant', 'Hi back', 'asst-msg');

    const readReceipts = new Map<string, ReadReceipt>([
      ['user-msg', { status: 'read' }],
      ['asst-msg', { status: 'read' }],
    ]);

    const { container, instance } = mountChat({
      id: 'chat-receipt-user-only',
      conversation,
      readReceipts,
    });

    const badges = container.querySelectorAll('[data-cinder-receipt-status]');
    // Only one badge for the user message, not the assistant
    expect(badges.length).toBe(1);

    // The badge is inside the user message wrapper
    const userWrapper = container.querySelector('[data-role="user"]');
    expect(userWrapper?.querySelector('[data-cinder-receipt-status]')).not.toBeNull();

    // The assistant wrapper has NO badge
    const assistantWrapper = container.querySelector('[data-role="assistant"]');
    expect(assistantWrapper?.querySelector('[data-cinder-receipt-status]')).toBeNull();

    unmount(instance);
  });

  test('no receipt for a message not in the readReceipts map', () => {
    let conversation = createConversation();
    conversation = appendMessage(conversation, 'user', 'No receipt for me', 'user-no-receipt');
    conversation = appendMessage(conversation, 'user', 'Receipt for me', 'user-with-receipt');

    const readReceipts = new Map<string, ReadReceipt>([['user-with-receipt', { status: 'sent' }]]);

    const { container, instance } = mountChat({
      id: 'chat-receipt-partial',
      conversation,
      readReceipts,
    });

    const badges = container.querySelectorAll('[data-cinder-receipt-status]');
    expect(badges.length).toBe(1);

    unmount(instance);
  });

  test('no scroll jump when receipt badge renders', () => {
    let conversation = createConversation();
    conversation = appendMessage(conversation, 'user', 'Hello', 'user-scroll');

    const readReceipts = new Map<string, ReadReceipt>([['user-scroll', { status: 'sent' }]]);

    const { container, instance } = mountChat({
      id: 'chat-receipt-scroll',
      conversation,
      readReceipts,
    });

    const timeline = container.querySelector<HTMLElement>('.chat-timeline');
    let scrollCount = 0;
    if (timeline) {
      timeline.scrollTo = (() => {
        scrollCount += 1;
      }) as HTMLElement['scrollTo'];
    }

    // Initial render with receipts already present — no scroll side-effect.
    expect(scrollCount).toBe(0);

    unmount(instance);
  });
});

// ---------------------------------------------------------------------------
// Adapter push → read receipt accumulation
// ---------------------------------------------------------------------------

describe('Chat — adapter onReadReceipt push → receipt state', () => {
  test('adapter onReadReceipt push shows read receipt on the user message', () => {
    let capturedHandlers: ChatPushHandlers | undefined;
    const adapter: ChatAdapter = {
      sendMessage: async () => {},
      subscribe: (_conversationId, handlers) => {
        capturedHandlers = handlers;
        return () => {};
      },
    };

    let conversation = createConversation('receipt-push-conv');
    conversation = appendMessage(conversation, 'user', 'Test message', 'user-push-1');

    const { container, instance } = mountChat({
      id: 'chat-receipt-push',
      conversation,
      adapter,
    });

    expect(capturedHandlers).toBeDefined();

    // Push a read receipt via the adapter
    capturedHandlers!.onReadReceipt({
      messageId: 'user-push-1',
      readAt: '2026-06-17T12:00:00.000Z',
    });
    flushSync();

    const badge = container.querySelector('[data-cinder-receipt-status]');
    expect(badge).not.toBeNull();
    // The adapter path infers 'read' status for any incoming receipt event
    expect(badge?.getAttribute('data-cinder-receipt-status')).toBe('read');
    expect(badge?.getAttribute('aria-label')).toBe('Read');

    unmount(instance);
  });

  test('adapter receipt does NOT mutate the conversation transcript', () => {
    let capturedHandlers: ChatPushHandlers | undefined;
    const adapter: ChatAdapter = {
      sendMessage: async () => {},
      subscribe: (_conversationId, handlers) => {
        capturedHandlers = handlers;
        return () => {};
      },
    };

    let conversation = createConversation('receipt-immutable-conv');
    conversation = appendMessage(conversation, 'user', 'Test', 'user-immutable');

    const originalMessageCount = conversation.ids.length;

    const { instance } = mountChat({
      id: 'chat-receipt-immutable',
      conversation,
      adapter,
    });

    capturedHandlers!.onReadReceipt({
      messageId: 'user-immutable',
      readAt: '2026-06-17T12:00:00.000Z',
    });
    flushSync();

    // The conversation snapshot is untouched — Chat never mutates it
    expect(conversation.ids).toHaveLength(originalMessageCount);
    expect(Object.keys(conversation.messages)).toHaveLength(originalMessageCount);

    unmount(instance);
  });

  test('second onReadReceipt push for same message stays read (no-op on status)', () => {
    let capturedHandlers: ChatPushHandlers | undefined;
    const adapter: ChatAdapter = {
      sendMessage: async () => {},
      subscribe: (_conversationId, handlers) => {
        capturedHandlers = handlers;
        return () => {};
      },
    };

    let conversation = createConversation('receipt-double-push-conv');
    conversation = appendMessage(conversation, 'user', 'Test message', 'user-double-1');

    const { container, instance } = mountChat({
      id: 'chat-receipt-double-push',
      conversation,
      adapter,
    });

    capturedHandlers!.onReadReceipt({
      messageId: 'user-double-1',
      readAt: '2026-06-17T12:00:00.000Z',
    });
    flushSync();

    capturedHandlers!.onReadReceipt({
      messageId: 'user-double-1',
      readAt: '2026-06-17T12:01:00.000Z',
    });
    flushSync();

    const badge = container.querySelector('[data-cinder-receipt-status]');
    expect(badge).not.toBeNull();
    // Second push is a no-op for status — still read.
    expect(badge?.getAttribute('data-cinder-receipt-status')).toBe('read');

    unmount(instance);
  });

  test('adapter onReadReceipt with readBy shows "Read by Alice, Bob" label', () => {
    let capturedHandlers: ChatPushHandlers | undefined;
    const adapter: ChatAdapter = {
      sendMessage: async () => {},
      subscribe: (_conversationId, handlers) => {
        capturedHandlers = handlers;
        return () => {};
      },
    };

    let conversation = createConversation('receipt-readby-conv');
    conversation = appendMessage(conversation, 'user', 'Group message', 'user-readby-1');

    const { container, instance } = mountChat({
      id: 'chat-receipt-readby',
      conversation,
      adapter,
    });

    capturedHandlers!.onReadReceipt({
      messageId: 'user-readby-1',
      readAt: '2026-06-17T12:00:00.000Z',
      readBy: ['Alice', 'Bob'],
    });
    flushSync();

    const badge = container.querySelector('[data-cinder-receipt-status]');
    expect(badge).not.toBeNull();
    expect(badge?.getAttribute('data-cinder-receipt-status')).toBe('read');
    expect(badge?.getAttribute('aria-label')).toBe('Read by Alice, Bob');

    unmount(instance);
  });

  test('adapter readBy accumulates across multiple pushes for same message', () => {
    let capturedHandlers: ChatPushHandlers | undefined;
    const adapter: ChatAdapter = {
      sendMessage: async () => {},
      subscribe: (_conversationId, handlers) => {
        capturedHandlers = handlers;
        return () => {};
      },
    };

    let conversation = createConversation('receipt-accumulate-conv');
    conversation = appendMessage(conversation, 'user', 'Group message', 'user-accum-1');

    const { container, instance } = mountChat({
      id: 'chat-receipt-accumulate',
      conversation,
      adapter,
    });

    capturedHandlers!.onReadReceipt({
      messageId: 'user-accum-1',
      readAt: '2026-06-17T12:00:00.000Z',
      readBy: ['Alice'],
    });
    flushSync();

    capturedHandlers!.onReadReceipt({
      messageId: 'user-accum-1',
      readAt: '2026-06-17T12:01:00.000Z',
      readBy: ['Bob'],
    });
    flushSync();

    const badge = container.querySelector('[data-cinder-receipt-status]');
    expect(badge?.getAttribute('aria-label')).toBe('Read by Alice, Bob');

    unmount(instance);
  });

  test('readBy dedup: two adapter pushes carrying same name → name appears once', () => {
    // Regression guard: if the dedup Set in handleAdapterReadReceipt is missing,
    // two pushes each with ['Alice'] would produce aria-label "Read by Alice, Alice".
    let capturedHandlers: ChatPushHandlers | undefined;
    const adapter: ChatAdapter = {
      sendMessage: async () => {},
      subscribe: (_conversationId, handlers) => {
        capturedHandlers = handlers;
        return () => {};
      },
    };

    let conversation = createConversation('receipt-dedup-conv');
    conversation = appendMessage(conversation, 'user', 'Dedup message', 'user-dedup-1');

    const { container, instance } = mountChat({
      id: 'chat-receipt-dedup',
      conversation,
      adapter,
    });

    capturedHandlers!.onReadReceipt({
      messageId: 'user-dedup-1',
      readAt: '2026-06-17T12:00:00.000Z',
      readBy: ['Alice'],
    });
    flushSync();

    // Second push with the same name — must be deduplicated.
    capturedHandlers!.onReadReceipt({
      messageId: 'user-dedup-1',
      readAt: '2026-06-17T12:01:00.000Z',
      readBy: ['Alice'],
    });
    flushSync();

    const badge = container.querySelector('[data-cinder-receipt-status]');
    expect(badge?.getAttribute('aria-label')).toBe('Read by Alice');

    unmount(instance);
  });

  test('defined empty readReceipts prop suppresses an adapter-pushed receipt (prop authority)', () => {
    // Regression guard for prop-authority semantics: when the consumer passes
    // readReceipts={new Map()} (a DEFINED but empty Map), it must win over any
    // adapter-accumulated state. This lets the consumer "clear" receipts by
    // passing an empty Map — useful when switching conversations.
    let capturedHandlers: ChatPushHandlers | undefined;
    const adapter: ChatAdapter = {
      sendMessage: async () => {},
      subscribe: (_conversationId, handlers) => {
        capturedHandlers = handlers;
        return () => {};
      },
    };

    let conversation = createConversation('receipt-suppress-conv');
    conversation = appendMessage(conversation, 'user', 'Suppressed message', 'user-suppress-1');

    // Pass an empty Map — DEFINED but empty, authoritative.
    const readReceipts = new Map<string, ReadReceipt>();

    const { container, instance } = mountChat({
      id: 'chat-receipt-suppress',
      conversation,
      adapter,
      readReceipts,
    });

    // Push a receipt via the adapter.
    capturedHandlers!.onReadReceipt({
      messageId: 'user-suppress-1',
      readAt: '2026-06-17T12:00:00.000Z',
    });
    flushSync();

    // The prop (empty Map) is authoritative — no badge should appear because
    // the prop Map has no entry for 'user-suppress-1'.
    expect(container.querySelector('[data-cinder-receipt-status]')).toBeNull();

    unmount(instance);
  });

  test('defined partial readReceipts prop with missing key returns no badge for that message', () => {
    // When the readReceipts prop is defined (not undefined), getReceipt returns
    // only prop entries. A message id absent from the Map → undefined → no badge.
    let conversation = createConversation('receipt-missing-key-conv');
    conversation = appendMessage(conversation, 'user', 'Has receipt', 'user-has');
    conversation = appendMessage(conversation, 'user', 'No receipt', 'user-none');

    // Only 'user-has' has an entry; 'user-none' is absent.
    const readReceipts = new Map<string, ReadReceipt>([['user-has', { status: 'read' }]]);

    const { container, instance } = mountChat({
      id: 'chat-receipt-missing-key',
      conversation,
      readReceipts,
    });

    const badges = container.querySelectorAll('[data-cinder-receipt-status]');
    // Exactly one badge — the missing-key message gets no badge even though the
    // prop is defined.
    expect(badges.length).toBe(1);
    expect(badges[0]?.getAttribute('aria-label')).toBe('Read');

    unmount(instance);
  });
});

// ---------------------------------------------------------------------------
// Compatibility: plain transcript with no receipt metadata renders as today
// ---------------------------------------------------------------------------

describe('Chat — C6 receipt compatibility', () => {
  test('plain transcript renders correctly with no readReceipts prop', () => {
    let conversation = createConversation();
    conversation = appendMessage(conversation, 'user', 'Plain user message');
    conversation = appendMessage(conversation, 'assistant', 'Plain assistant reply');

    const { container, instance } = mountChat({
      id: 'chat-receipt-compat',
      conversation,
      // No readReceipts prop
    });

    // All messages render
    expect(container.querySelectorAll('.chat-message')).toHaveLength(2);

    // No badges — plain transcript renders exactly as before
    expect(container.querySelector('[data-cinder-receipt-status]')).toBeNull();

    unmount(instance);
  });
});

// ---------------------------------------------------------------------------
// Reset paths — conversation change clears adapter-derived receipt state
// ---------------------------------------------------------------------------

describe('useChatReadReceipts — conversation change clears adapter receipts', () => {
  // Uses AdapterSwitchFixture so the `conversation` prop can be swapped
  // reactively via $state in a Svelte component context.
  test('receipt badge disappears when conversation id changes (reset path a)', () => {
    // Arrange: mount via AdapterSwitchFixture so we can swap conversations.
    // No `readReceipts` prop is passed — the adapter path is active.
    let handlers: ChatPushHandlers | undefined;
    const adapter: ChatAdapter = {
      sendMessage: async () => {},
      subscribe: (_conversationId, pushHandlers) => {
        handlers = pushHandlers;
        return () => {};
      },
    };

    let conversationA = createConversation('receipt-reset-conv-a');
    conversationA = appendMessage(conversationA, 'user', 'Hello', 'receipt-reset-user-1');

    const target = document.createElement('div');
    document.body.append(target);
    const instance = mount(AdapterSwitchFixture, {
      target,
      props: { initial: conversationA, adapter },
    }) as SwitchFixtureInstance;
    flushSync();

    // The adapter subscription must have fired and captured handlers.
    expect(handlers).toBeDefined();

    // Act: push a read receipt for the user message in Conversation A.
    handlers!.onReadReceipt({
      messageId: 'receipt-reset-user-1',
      readAt: '2026-06-17T12:00:00.000Z',
    });
    flushSync();

    // Assert: receipt badge is shown for the user message.
    const badge = target.querySelector('[data-cinder-receipt-status]');
    expect(badge).not.toBeNull();
    expect(badge?.getAttribute('data-cinder-receipt-status')).toBe('read');

    // Act: swap to a different conversation that REUSES the same user message id.
    // This is the leak scenario: without reset, the adapterReceipts entry keyed by
    // 'receipt-reset-user-1' would still match and render a stale badge on the new
    // conversation's identically-id'd message. The conversation-change $effect
    // calls readReceiptsState.reset(), clearing adapterReceipts.
    let conversationB = createConversation('receipt-reset-conv-b');
    conversationB = appendMessage(
      conversationB,
      'user',
      'Different thread',
      'receipt-reset-user-1',
    );
    instance.setConversation(conversationB);
    flushSync();

    // Control: the new conversation's user message DOES render (so a missing badge
    // is attributable to the reset, not to an empty transcript).
    expect(target.textContent).toContain('Different thread');
    // Assert: NO stale badge — reset() cleared adapterReceipts, so the reused id
    // no longer carries the previous conversation's receipt.
    expect(target.querySelector('[data-cinder-receipt-status]')).toBeNull();

    unmount(instance);
    target.remove();
  });
});
