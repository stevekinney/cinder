/**
 * Tests for the Chat `messagePart` and `row` snippet overrides (C1 spine).
 *
 * Both overrides use inversion of control: the consumer's snippet receives the
 * subject (a part or a message) AND a `renderDefault` snippet it can call to
 * render the built-in. These tests prove:
 *   - `messagePart` replaces an individual body part's rendering, and can
 *     delegate back to the built-in for parts it does not handle.
 *   - `row` replaces/wraps an entire message row, and can delegate back to the
 *     built-in row.
 *   - With neither override, the built-ins render (no behavior change).
 */

/// <reference lib="dom" />
import { afterAll, afterEach, describe, expect, test } from 'bun:test';
import { createRawSnippet } from 'svelte';

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

const { render, cleanup } = await import('@testing-library/svelte');
const { default: Chat } = await import('./chat.svelte');
const { default: OverrideDelegationFixture } =
  await import('./chat-override-delegation-fixture.svelte');

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

let counter = 0;

function createConversation(): ConversationHistory {
  const now = '2026-06-02T00:00:00.000Z';
  return {
    schemaVersion: 4,
    id: `override-conversation-${++counter}`,
    status: 'active',
    metadata: {},
    ids: [],
    messages: {},
    createdAt: now,
    updatedAt: now,
  };
}

function append(
  conversation: ConversationHistory,
  role: MessageRole,
  content: string,
): ConversationHistory {
  const id = `override-message-${++counter}`;
  const now = '2026-06-02T00:00:00.000Z';
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

describe('Chat — messagePart override', () => {
  test('replaces the rendering of a body part', () => {
    let conversation = createConversation();
    conversation = append(conversation, 'assistant', 'original body');

    const messagePart = createRawSnippet(() => ({
      render: () => `<div class="part-override">CUSTOM PART</div>`,
      setup: () => {},
    }));

    const { container } = render(Chat, {
      props: { id: 'chat-part-override', conversation, messagePart: messagePart as never },
    });

    expect(container.querySelector('.part-override')).not.toBeNull();
    expect(container.textContent).toContain('CUSTOM PART');
    // The built-in markdown view did not also render — the override replaced it.
    expect(container.querySelector('.message-content')).toBeNull();
  });

  test('renders the built-in part when no override is supplied (no behavior change)', () => {
    let conversation = createConversation();
    conversation = append(conversation, 'assistant', 'plain body');

    const { container } = render(Chat, {
      props: { id: 'chat-no-override', conversation },
    });

    expect(container.querySelector('.message-content')).not.toBeNull();
    expect(container.querySelector('.part-override')).toBeNull();
  });
});

describe('Chat — row override', () => {
  test('replaces an entire message row', () => {
    let conversation = createConversation();
    conversation = append(conversation, 'user', 'hello there');

    const row = createRawSnippet((getMessage: () => Message) => ({
      render: () => `<div class="row-override">ROW for ${getMessage().role}</div>`,
      setup: () => {},
    }));

    const { container } = render(Chat, {
      props: { id: 'chat-row-override', conversation, row: row as never },
    });

    expect(container.querySelector('.row-override')).not.toBeNull();
    expect(container.textContent).toContain('ROW for user');
    // The built-in message bubble did not render — the row override replaced it.
    expect(container.querySelector('.chat-message')).toBeNull();
  });

  test('renders the built-in row when no override is supplied (no behavior change)', () => {
    let conversation = createConversation();
    conversation = append(conversation, 'user', 'hello there');

    const { container } = render(Chat, {
      props: { id: 'chat-no-row-override', conversation },
    });

    expect(container.querySelector('.chat-message')).not.toBeNull();
    expect(container.querySelector('.row-override')).toBeNull();
  });
});

describe('Chat — override inversion of control (delegate to renderDefault)', () => {
  test('row + messagePart overrides wrap and delegate to the built-ins', () => {
    let conversation = createConversation();
    conversation = append(conversation, 'assistant', 'delegated body');

    const { container } = render(OverrideDelegationFixture, {
      props: { conversation, delegate: true },
    });

    // The wrappers are present (overrides ran)…
    expect(container.querySelector('.row-wrapper')).not.toBeNull();
    expect(container.querySelector('.part-wrapper')).not.toBeNull();
    // …and the built-ins rendered INSIDE them (delegation worked).
    expect(container.querySelector('.row-wrapper .chat-message')).not.toBeNull();
    expect(container.querySelector('.part-wrapper .message-content')).not.toBeNull();
    expect(container.querySelector('.part-wrapper')?.getAttribute('data-part-type')).toBe(
      'markdown',
    );
  });

  test('row + messagePart overrides replace the built-ins when they choose not to delegate', () => {
    let conversation = createConversation();
    conversation = append(conversation, 'assistant', 'replaced body');

    const { container } = render(OverrideDelegationFixture, {
      props: { conversation, delegate: false },
    });

    expect(container.querySelector('.row-wrapper')).not.toBeNull();
    expect(container.querySelector('.row-replaced')).not.toBeNull();
    // The built-in row did not render (override replaced it).
    expect(container.querySelector('.chat-message')).toBeNull();
  });
});
