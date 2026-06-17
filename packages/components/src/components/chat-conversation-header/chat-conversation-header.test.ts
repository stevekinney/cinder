/// <reference lib="dom" />
import { afterAll, afterEach, describe, expect, test } from 'bun:test';
import { createRawSnippet } from 'svelte';

import { setupHappyDom } from '../../test/happy-dom.ts';
import type { ConversationSummary } from '../chat-conversation-list/conversation-summary.ts';
import type { ConversationHistory, Message } from '../chat/conversation-model.ts';

setupHappyDom();

class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
const originalResizeObserver = globalThis.ResizeObserver;
globalThis.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver;

afterAll(() => {
  globalThis.ResizeObserver = originalResizeObserver;
});

const { render, cleanup } = await import('@testing-library/svelte');
const { default: ChatConversationHeader } = await import('./chat-conversation-header.svelte');

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

function normalizedText(element: Element): string {
  return element.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

function conversation(overrides: Partial<ConversationHistory> = {}): ConversationHistory {
  const message: Message = {
    id: 'm1',
    role: 'assistant',
    content: 'Ready',
    position: 0,
    createdAt: '2026-06-01T00:01:00.000Z',
    metadata: {},
    hidden: false,
  };
  const base: ConversationHistory = {
    schemaVersion: 4,
    id: 'conversation-header',
    title: 'Launch support',
    status: 'active',
    metadata: { _participantNames: ['Ada', 'Grace', 'Lin'] },
    ids: ['m1'],
    messages: { m1: message },
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:01:00.000Z',
  };
  return { ...base, ...overrides };
}

function actionSnippet() {
  return createRawSnippet<[ConversationSummary]>((summary) => ({
    render: () => `<button type="button" data-summary-id="${summary().id}">Pin</button>`,
    setup: () => {},
  }));
}

describe('ChatConversationHeader', () => {
  test('renders a configurable heading and derived metadata', () => {
    const { container } = render(ChatConversationHeader, {
      props: {
        conversation: conversation(),
        headingLevel: 3,
        showExportActions: false,
      },
    });

    expect(container.querySelector('header')).not.toBeNull();
    expect(container.querySelector('h3')?.textContent).toBe('Launch support');
    const text = normalizedText(container);
    expect(text).toContain('1 message');
    expect(text).toContain('active');
    expect(text).toContain('Ada, Grace +1');
  });

  test('renders export actions in the header action area by default', () => {
    const { container } = render(ChatConversationHeader, {
      props: {
        conversation: conversation(),
      },
    });

    expect(container.querySelector('.cinder-chat-conversation-header__actions')).not.toBeNull();
    expect(container.querySelector('[aria-label="Export conversation"]')).not.toBeNull();
  });

  test('omits the action area when export actions and custom actions are absent', () => {
    const { container } = render(ChatConversationHeader, {
      props: {
        conversation: conversation({
          metadata: { _participantNames: ['Ada', 'Grace'] },
          ids: ['m1', 'm2'],
          messages: {
            ...conversation().messages,
            m2: {
              ...conversation().messages['m1']!,
              id: 'm2',
              position: 1,
              content: 'Second message',
            },
          },
        }),
        headingLevel: 4,
        showExportActions: false,
        class: 'custom-header',
      },
    });

    expect(container.querySelector('h4')?.textContent).toBe('Launch support');
    expect(container.querySelector('header')?.classList.contains('custom-header')).toBe(true);
    expect(normalizedText(container)).toContain('2 messages');
    expect(normalizedText(container)).toContain('Ada, Grace');
    expect(container.querySelector('.cinder-chat-conversation-header__actions')).toBeNull();
  });

  test('omits participant metadata when the derived summary has no participants', () => {
    const { container } = render(ChatConversationHeader, {
      props: {
        conversation: conversation({
          metadata: {},
        }),
        showExportActions: false,
      },
    });

    expect(normalizedText(container)).toBe('Launch support 1 message · active');
    expect(
      container.querySelector('.cinder-chat-conversation-header__meta span[title]'),
    ).toBeNull();
  });

  test('renders custom actions with the derived summary when export actions are disabled', () => {
    const { container } = render(ChatConversationHeader, {
      props: {
        conversation: conversation(),
        showExportActions: false,
        actions: actionSnippet(),
      },
    });

    const action = container.querySelector<HTMLButtonElement>('[data-summary-id]');
    expect(action?.dataset['summaryId']).toBe('conversation-header');
    expect(action?.textContent).toBe('Pin');
    expect(container.querySelector('[aria-label="Export conversation"]')).toBeNull();
  });
});
