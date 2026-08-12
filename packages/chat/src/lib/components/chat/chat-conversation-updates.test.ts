/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';
import type { ConversationHistory, Message, MessageRole } from './conversation-model.ts';

setupHappyDom();

const { render, waitFor, cleanup } = await import('@testing-library/svelte');
const { default: Fixture } = await import('./chat-conversation-updates-fixture.svelte');

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

function conversationOf(count: number): ConversationHistory {
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
    id: 'conversation-updates',
    status: 'active',
    metadata: {},
    ids,
    messages,
    createdAt: now,
    updatedAt: now,
  };
}

function withHidden(count: number, hiddenId: string): ConversationHistory {
  const base = conversationOf(count);
  return {
    ...base,
    messages: { ...base.messages, [hiddenId]: { ...base.messages[hiddenId]!, hidden: true } },
  };
}

type FixtureInstance = { setConversation: (next: ConversationHistory) => void };

function renderFixture(initial: ConversationHistory) {
  const { container, component } = render(Fixture, { props: { initial } });
  const rowCount = () => container.querySelectorAll('.chat-message').length;
  return {
    container,
    rowCount,
    setConversation: (component as unknown as FixtureInstance).setConversation,
  };
}

// A keyed `{#each}` whose body starts with a conditional stops reconciling after
// its first render (Svelte 5.56.4), and `renderChatRow` opens with one. The
// transcript froze: messages added to `conversation` never appeared and removed
// ones never left, while `messages` and `renderRows` both held the right values
// the whole time. See the static row list in `container/chat.svelte`.
describe('Chat tracks conversation changes after the first render', () => {
  test('renders messages appended to the conversation', async () => {
    const { rowCount, setConversation } = renderFixture(conversationOf(3));
    await waitFor(() => expect(rowCount()).toBe(3));

    setConversation(conversationOf(6));

    await waitFor(() => expect(rowCount()).toBe(6));
  });

  test('drops messages removed from the conversation', async () => {
    const { rowCount, setConversation } = renderFixture(conversationOf(6));
    await waitFor(() => expect(rowCount()).toBe(6));

    setConversation(conversationOf(3));

    await waitFor(() => expect(rowCount()).toBe(3));
  });

  // `getMessages` filters on `!message.hidden`, so hiding is a removal as far as
  // the rendered list is concerned. This is the redaction path: leaving the row
  // on screen is the opposite of what hiding is for.
  // The focus backstop's rendered-set path, which #1286 made unreachable: a row
  // can now leave the DOM with no scroll at all, which is the case the
  // scroll-driven check cannot see.
  //
  // Unlike the three tests above, this one's negative case is NOT demonstrated.
  // Removing the effect, or just its `reclaimFocusIfRowDetached()` call, segfaults
  // the harness (RSS peaks around 11GB) instead of failing cleanly. That is not
  // the same as a test that passes either way — those get deleted — but it does
  // mean this asserts correct behavior without proof that it would catch the
  // regression. Treat it as a guard, not a pin.
  test('reclaims focus when the focused message is removed', async () => {
    const { container, rowCount, setConversation } = renderFixture(conversationOf(6));
    await waitFor(() => expect(rowCount()).toBe(6));

    const chatContainer = container.querySelector<HTMLElement>('.chat-container')!;
    const timeline = container.querySelector<HTMLElement>('.chat-timeline')!;
    const target = [...container.querySelectorAll<HTMLElement>('.chat-message')][4]!;
    target.focus();
    expect(document.activeElement).toBe(target);

    setConversation(conversationOf(3));
    await waitFor(() => expect(target.isConnected).toBe(false));

    // Focus must land back inside the chat, or the container-bound keydown
    // handler stops receiving anything and every shortcut dies.
    await waitFor(() => expect(document.activeElement).toBe(timeline));
    expect(chatContainer.contains(document.activeElement)).toBe(true);
  });

  test('drops a message that becomes hidden', async () => {
    const { container, rowCount, setConversation } = renderFixture(conversationOf(4));
    await waitFor(() => expect(rowCount()).toBe(4));
    expect(container.textContent).toContain('Message 2');

    setConversation(withHidden(4, 'message-2'));

    await waitFor(() => expect(rowCount()).toBe(3));
    expect(container.textContent).not.toContain('Message 2');
  });
});
