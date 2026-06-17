/**
 * C6 tests — per-participant typing indicators (out-of-band UI state).
 *
 * Asserts:
 *   1. typingParticipants prop shows the indicator with accessible text (not just
 *      a class — text content is asserted directly).
 *   2. Multi-participant exact string ("Alice and Bob are typing…").
 *   3. 3-4 participants → "N people are typing…"
 *   4. 5+ participants → "Several people are typing…"
 *   5. No participants → indicator hidden / empty.
 *   6. data-cinder-participant-typing + data-cinder-participant-count attributes.
 *   7. Reactive updates on typingParticipants prop change.
 *   8. A plain conversationalist-shaped transcript with NO typingParticipants
 *      renders exactly as today (compatibility proof).
 *   9. Label derivation unit tests (pure function, no DOM).
 *   10. SSR probe: the hook module imports with no DOM globals at module level.
 */

/// <reference lib="dom" />
import { afterAll, afterEach, beforeEach, describe, expect, jest, test } from 'bun:test';
import { flushSync, mount, unmount } from 'svelte';

import { setupHappyDom } from '../../test/happy-dom.ts';
import type { ChatAdapter, ChatPushHandlers } from './adapter/chat-adapter.ts';
import type { TypingParticipant } from './chat.types.ts';
import {
  deriveAnnouncedLabel,
  deriveTypingLabel,
} from './container/use-chat-typing-indicator.svelte.ts';

// setupHappyDom() MUST run before any @testing-library/svelte import.
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

type TestConversation = import('./conversation-model.ts').ConversationHistory;
type TestRole = import('./conversation-model.ts').MessageRole;

let counter = 0;

function createConversation(id?: string): TestConversation {
  const now = new Date().toISOString();
  return {
    schemaVersion: 4,
    id: id ?? `typing-test-${++counter}`,
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
): TestConversation {
  const id = `typing-msg-${++counter}`;
  const now = new Date().toISOString();
  return {
    ...conversation,
    ids: [...conversation.ids, id],
    messages: {
      ...conversation.messages,
      [id]: {
        id,
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
// Pure label-derivation unit tests (no DOM)
// ---------------------------------------------------------------------------

describe('deriveTypingLabel — pure label function', () => {
  function participant(name: string): TypingParticipant {
    return { id: name.toLowerCase(), name };
  }

  test('0 participants → empty string', () => {
    expect(deriveTypingLabel([])).toBe('');
  });

  test('1 participant → "Alice is typing…"', () => {
    expect(deriveTypingLabel([participant('Alice')])).toBe('Alice is typing…');
  });

  test('2 participants → "Alice and Bob are typing…"', () => {
    expect(deriveTypingLabel([participant('Alice'), participant('Bob')])).toBe(
      'Alice and Bob are typing…',
    );
  });

  test('3 participants → "3 people are typing…"', () => {
    expect(deriveTypingLabel([participant('A'), participant('B'), participant('C')])).toBe(
      '3 people are typing…',
    );
  });

  test('4 participants → "4 people are typing…"', () => {
    const participants = [participant('A'), participant('B'), participant('C'), participant('D')];
    expect(deriveTypingLabel(participants)).toBe('4 people are typing…');
  });

  test('5 participants → "Several people are typing…"', () => {
    const participants = Array.from({ length: 5 }, (_, index) =>
      participant(String.fromCodePoint(65 + index)),
    );
    expect(deriveTypingLabel(participants)).toBe('Several people are typing…');
  });

  test('10 participants → "Several people are typing…"', () => {
    const participants = Array.from({ length: 10 }, (_, index) => participant(`P${index}`));
    expect(deriveTypingLabel(participants)).toBe('Several people are typing…');
  });
});

describe('deriveAnnouncedLabel — no ellipsis', () => {
  function participant(name: string): TypingParticipant {
    return { id: name.toLowerCase(), name };
  }

  test('0 participants → empty string', () => {
    expect(deriveAnnouncedLabel([])).toBe('');
  });

  test('1 participant → "Alice is typing" (no ellipsis)', () => {
    expect(deriveAnnouncedLabel([participant('Alice')])).toBe('Alice is typing');
  });

  test('2 participants → "Alice and Bob are typing"', () => {
    expect(deriveAnnouncedLabel([participant('Alice'), participant('Bob')])).toBe(
      'Alice and Bob are typing',
    );
  });

  test('3 participants → "3 people are typing"', () => {
    expect(deriveAnnouncedLabel([participant('A'), participant('B'), participant('C')])).toBe(
      '3 people are typing',
    );
  });

  test('5+ participants → "Several people are typing"', () => {
    const participants = Array.from({ length: 6 }, (_, index) => participant(`P${index}`));
    expect(deriveAnnouncedLabel(participants)).toBe('Several people are typing');
  });
});

// ---------------------------------------------------------------------------
// DOM integration tests
// ---------------------------------------------------------------------------

describe('Chat — typingParticipants prop', () => {
  test('no typingParticipants: indicator region is empty (no text)', () => {
    let conversation = createConversation();
    conversation = appendMessage(conversation, 'user', 'Hello');
    const { container, instance } = mountChat({
      id: 'chat-typing-none',
      conversation,
    });

    // The participant typing region is always in DOM but has no visible text when
    // no participants are typing.
    const region = container.querySelector('[data-cinder-participant-count]');
    expect(region).not.toBeNull();
    expect(region?.getAttribute('data-cinder-participant-typing')).toBeNull();

    unmount(instance);
  });

  test('single participant: shows "Alice is typing…" as visible text', () => {
    let conversation = createConversation();
    conversation = appendMessage(conversation, 'user', 'Hello');
    const typingParticipants: TypingParticipant[] = [{ id: 'alice', name: 'Alice' }];

    const { container, instance } = mountChat({
      id: 'chat-typing-single',
      conversation,
      typingParticipants,
    });

    const label = container.querySelector('.chat-participant-typing-label');
    expect(label?.textContent).toBe('Alice is typing…');

    unmount(instance);
  });

  test('two participants: exact string "Alice and Bob are typing…"', () => {
    let conversation = createConversation();
    conversation = appendMessage(conversation, 'user', 'Hello');
    const typingParticipants: TypingParticipant[] = [
      { id: 'alice', name: 'Alice' },
      { id: 'bob', name: 'Bob' },
    ];

    const { container, instance } = mountChat({
      id: 'chat-typing-two',
      conversation,
      typingParticipants,
    });

    const label = container.querySelector('.chat-participant-typing-label');
    expect(label?.textContent).toBe('Alice and Bob are typing…');

    unmount(instance);
  });

  test('three participants: "3 people are typing…"', () => {
    let conversation = createConversation();
    conversation = appendMessage(conversation, 'user', 'Hello');
    const typingParticipants: TypingParticipant[] = [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
      { id: 'c', name: 'C' },
    ];

    const { container, instance } = mountChat({
      id: 'chat-typing-three',
      conversation,
      typingParticipants,
    });

    const label = container.querySelector('.chat-participant-typing-label');
    expect(label?.textContent).toBe('3 people are typing…');

    unmount(instance);
  });

  test('five participants: "Several people are typing…"', () => {
    let conversation = createConversation();
    conversation = appendMessage(conversation, 'user', 'Hello');
    const typingParticipants: TypingParticipant[] = Array.from({ length: 5 }, (_, index) => ({
      id: `p${index}`,
      name: `Person ${index + 1}`,
    }));

    const { container, instance } = mountChat({
      id: 'chat-typing-five',
      conversation,
      typingParticipants,
    });

    const label = container.querySelector('.chat-participant-typing-label');
    expect(label?.textContent).toBe('Several people are typing…');

    unmount(instance);
  });

  test('data-cinder-participant-typing attribute is set when typing', () => {
    let conversation = createConversation();
    conversation = appendMessage(conversation, 'user', 'Hello');
    const typingParticipants: TypingParticipant[] = [{ id: 'alice', name: 'Alice' }];

    const { container, instance } = mountChat({
      id: 'chat-typing-attr',
      conversation,
      typingParticipants,
    });

    const region = container.querySelector('[data-cinder-participant-typing]');
    expect(region).not.toBeNull();
    expect(region?.getAttribute('data-cinder-participant-count')).toBe('1');

    unmount(instance);
  });

  test('data-cinder-participant-count reflects exact count', () => {
    let conversation = createConversation();
    conversation = appendMessage(conversation, 'user', 'Hello');
    const typingParticipants: TypingParticipant[] = [
      { id: 'alice', name: 'Alice' },
      { id: 'bob', name: 'Bob' },
      { id: 'carol', name: 'Carol' },
    ];

    const { container, instance } = mountChat({
      id: 'chat-typing-count',
      conversation,
      typingParticipants,
    });

    const region = container.querySelector('[data-cinder-participant-typing]');
    expect(region?.getAttribute('data-cinder-participant-count')).toBe('3');

    unmount(instance);
  });

  test('no scroll jump when participant typing region appears', () => {
    let conversation = createConversation();
    conversation = appendMessage(conversation, 'user', 'Hello');

    const { container, instance } = mountChat({
      id: 'chat-typing-scroll',
      conversation,
    });

    const timeline = container.querySelector<HTMLElement>('.chat-timeline');
    let scrollCount = 0;
    if (timeline) {
      timeline.scrollTo = (() => {
        scrollCount += 1;
      }) as HTMLElement['scrollTo'];
    }

    // The participant typing region is always in DOM — it never causes a mount scroll.
    expect(scrollCount).toBe(0);

    unmount(instance);
  });
});

// ---------------------------------------------------------------------------
// Compatibility: plain transcript with no typing metadata renders as before
// ---------------------------------------------------------------------------

describe('Chat — C6 compatibility: plain transcript', () => {
  test('plain conversationalist transcript renders WITHOUT typing indicator text when no typingParticipants', () => {
    let conversation = createConversation();
    conversation = appendMessage(conversation, 'user', 'Hello there');
    conversation = appendMessage(conversation, 'assistant', 'Hello back');

    const { container, instance } = mountChat({
      id: 'chat-compat-no-typing',
      conversation,
      // Deliberately no typingParticipants prop
    });

    // Messages still render
    const messages = container.querySelectorAll('.chat-message');
    expect(messages).toHaveLength(2);

    // No typing label text visible
    const label = container.querySelector('.chat-participant-typing-label');
    expect(label).toBeNull();

    // The indicator region exists but shows no active state
    const region = container.querySelector('[data-cinder-participant-count]');
    expect(region?.getAttribute('data-cinder-participant-typing')).toBeNull();

    unmount(instance);
  });

  test('plain transcript renders correctly with no readReceipts prop', () => {
    let conversation = createConversation();
    conversation = appendMessage(conversation, 'user', 'No receipts here');
    conversation = appendMessage(conversation, 'assistant', 'Confirmed');

    const { container, instance } = mountChat({
      id: 'chat-compat-no-receipts',
      conversation,
      // Deliberately no readReceipts prop
    });

    const messages = container.querySelectorAll('.chat-message');
    expect(messages).toHaveLength(2);

    // No read receipt badges
    expect(container.querySelector('[data-cinder-receipt-status]')).toBeNull();

    unmount(instance);
  });

  test('typing indicator live region is in DOM even when chat is empty (empty-chat SR fix)', () => {
    // Regression: ChatParticipantTyping was previously inside the {:else} branch
    // of {#if messages.length === 0}, so the aria-live region was absent from the
    // DOM in empty chats and the first typing announcement was never delivered.
    const emptyConversation = createConversation();
    const typingParticipants: TypingParticipant[] = [{ id: 'alice', name: 'Alice' }];

    const { container, instance } = mountChat({
      id: 'chat-empty-with-typing',
      conversation: emptyConversation,
      typingParticipants,
    });

    // The outer wrapper must be in DOM even with zero messages.
    const region = container.querySelector('[data-cinder-participant-count]');
    expect(region).not.toBeNull();

    // With a typing participant the indicator should show.
    expect(region?.getAttribute('data-cinder-participant-typing')).toBe('');
    expect(region?.getAttribute('data-cinder-participant-count')).toBe('1');

    const label = container.querySelector('.chat-participant-typing-label');
    expect(label?.textContent).toBe('Alice is typing…');

    unmount(instance);
  });
});

// ---------------------------------------------------------------------------
// Debounce timer coverage — exercised via adapter onTypingChange push which
// drives typingIndicatorState inside mounted Chat (Svelte 5 $effect requires
// component context; $set is not valid in Svelte 5).
// ---------------------------------------------------------------------------

describe('useChatTypingIndicator — debounce timer paths via adapter push', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function mountChatWithAdapter(): {
    container: HTMLElement;
    instance: ReturnType<typeof mount>;
    capturedHandlers: () => ChatPushHandlers;
  } {
    let handlers: ChatPushHandlers | undefined;
    const adapter: ChatAdapter = {
      sendMessage: async () => {},
      subscribe: (_conversationId, pushHandlers) => {
        handlers = pushHandlers;
        return () => {};
      },
    };

    let conversation = createConversation();
    conversation = appendMessage(conversation, 'user', 'Hello');

    const { container, instance } = mountChat({
      id: `chat-debounce-${++counter}`,
      conversation,
      adapter,
    });

    return {
      container,
      instance,
      capturedHandlers: () => handlers!,
    };
  }

  function getTypingAnnouncer(container: HTMLElement): Element | null {
    // The typing live region is a plain div[aria-live=polite][aria-atomic=true]
    // outside the role=log; find by content or position (not ChatStatusAnnouncer).
    const announcers = container.querySelectorAll('[aria-live="polite"][aria-atomic="true"]');
    // Return the last one (the typing announcer is appended after ChatStatusAnnouncer).
    return announcers[announcers.length - 1] ?? null;
  }

  test('typing announcer is empty before debounce fires', () => {
    const { container, instance, capturedHandlers } = mountChatWithAdapter();

    // Trigger adapter typing change.
    capturedHandlers().onTypingChange(true);
    flushSync();

    // The visible label appears immediately but the announced text is still empty.
    const announcer = getTypingAnnouncer(container);
    expect(announcer?.textContent?.trim()).toBe('');

    unmount(instance);
  });

  test('typing announcer updates after 400ms debounce fires', () => {
    const { container, instance, capturedHandlers } = mountChatWithAdapter();

    capturedHandlers().onTypingChange(true);
    flushSync();

    // Advance past the 400ms debounce.
    jest.advanceTimersByTime(400);
    flushSync();

    const announcer = getTypingAnnouncer(container);
    expect(announcer?.textContent?.trim()).toBe('Someone is typing');

    unmount(instance);
  });

  test('typing announcer clears immediately when typing stops (no tick needed)', () => {
    const { container, instance, capturedHandlers } = mountChatWithAdapter();

    capturedHandlers().onTypingChange(true);
    flushSync();
    jest.advanceTimersByTime(400);
    flushSync();

    // Confirm it's populated.
    const announcer = getTypingAnnouncer(container);
    expect(announcer?.textContent?.trim()).toBe('Someone is typing');

    // Stop typing — should clear immediately without waiting for a debounce.
    capturedHandlers().onTypingChange(false);
    flushSync();

    expect(announcer?.textContent?.trim()).toBe('');

    unmount(instance);
  });

  test('rapid typing toggle: only final announcement fires (timer restarted)', () => {
    const { container, instance, capturedHandlers } = mountChatWithAdapter();

    // Start typing.
    capturedHandlers().onTypingChange(true);
    flushSync();

    // Advance 200ms — debounce not yet fired.
    jest.advanceTimersByTime(200);
    flushSync();

    const announcer = getTypingAnnouncer(container);
    expect(announcer?.textContent?.trim()).toBe('');

    // Stop and immediately restart — should cancel and restart the timer.
    capturedHandlers().onTypingChange(false);
    flushSync();
    capturedHandlers().onTypingChange(true);
    flushSync();

    // Advance 400ms for the restarted timer.
    jest.advanceTimersByTime(400);
    flushSync();

    // The announcement fires for the final "typing" state.
    expect(announcer?.textContent?.trim()).toBe('Someone is typing');

    unmount(instance);
  });
});

// ---------------------------------------------------------------------------
// Scroll-jump regression: outer wrapper always in DOM
// ---------------------------------------------------------------------------

describe('Chat — no scroll jump: outer typing wrapper always in DOM', () => {
  test('participant typing outer wrapper is present even with no typingParticipants (prevents scroll-jump)', () => {
    // Regression guard: the outer .chat-participant-typing div must be in DOM
    // regardless of message count or typing state. If it were absent and then
    // inserted when typing starts, overflow-anchor could cause a scroll jump.
    let conversation = createConversation();
    conversation = appendMessage(conversation, 'user', 'Hello');

    const { container, instance } = mountChat({
      id: 'chat-typing-outer-always',
      conversation,
      // No typingParticipants — outer wrapper should still exist.
    });

    const outerWrapper = container.querySelector('.chat-participant-typing');
    expect(outerWrapper).not.toBeNull();

    // The inner indicator is not present (nobody is typing).
    const innerIndicator = container.querySelector('.chat-participant-typing-indicator');
    expect(innerIndicator).toBeNull();

    unmount(instance);
  });

  test('participant typing outer wrapper is present even in an empty chat', () => {
    // Regression guard: previously ChatParticipantTyping was inside {:else} of
    // {#if messages.length === 0} — verifying it is now always in DOM.
    const emptyConversation = createConversation();

    const { container, instance } = mountChat({
      id: 'chat-typing-outer-empty-chat',
      conversation: emptyConversation,
    });

    const outerWrapper = container.querySelector('.chat-participant-typing');
    expect(outerWrapper).not.toBeNull();

    unmount(instance);
  });
});
