/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';
import type { ConversationSummary } from './conversation-summary.ts';

setupHappyDom();

const { render, fireEvent, cleanup } = await import('@testing-library/svelte');
const { default: ChatConversationList } = await import('./chat-conversation-list.svelte');

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

function normalizedText(element: Element): string {
  return element.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

function summary(
  overrides: Partial<ConversationSummary> & Pick<ConversationSummary, 'id'>,
): ConversationSummary {
  const { id, ...summaryOverrides } = overrides;
  return {
    id,
    title: summaryOverrides.title ?? id,
    status: summaryOverrides.status ?? 'active',
    messageCount: summaryOverrides.messageCount ?? 1,
    unreadCount: summaryOverrides.unreadCount ?? 0,
    createdAt: summaryOverrides.createdAt ?? '2026-06-01T00:00:00.000Z',
    updatedAt: summaryOverrides.updatedAt ?? '2026-06-01T00:00:00.000Z',
    participantNames: summaryOverrides.participantNames ?? [],
    ...summaryOverrides,
  };
}

describe('ChatConversationList', () => {
  test('renders nav/list semantics sorted by latest message time', () => {
    const { container } = render(ChatConversationList, {
      props: {
        activeConversationId: 'newer',
        conversations: [
          summary({
            id: 'older',
            title: 'Older',
            lastMessageText: 'Older preview',
            lastMessageAt: '2026-06-01T00:01:00.000Z',
          }),
          summary({
            id: 'newer',
            title: 'Newer',
            lastMessageText: 'Newer preview',
            lastMessageAt: '2026-06-01T00:02:00.000Z',
            unreadCount: 2,
          }),
        ],
      },
    });

    const nav = container.querySelector('nav');
    expect(nav?.getAttribute('aria-label')).toBe('Conversations');
    const buttons = [...container.querySelectorAll<HTMLButtonElement>('li > button')];
    expect(buttons.map((button) => normalizedText(button))).toEqual([
      'Newer Newer preview 2 , 2 unread messages',
      'Older Older preview',
    ]);
    expect(buttons[0]?.getAttribute('aria-pressed')).toBe('true');
    expect(buttons[0]?.hasAttribute('data-cinder-conversation-selected')).toBe(true);
  });

  test('calls onselectconversation with the selected id', async () => {
    const selected: string[] = [];
    const { container } = render(ChatConversationList, {
      props: {
        conversations: [summary({ id: 'alpha', title: 'Alpha' })],
        onselectconversation: (id: string) => selected.push(id),
      },
    });

    await fireEvent.click(container.querySelector('button')!);
    expect(selected).toEqual(['alpha']);
  });

  test('renders a custom empty state when no conversations are available', () => {
    const { container } = render(ChatConversationList, {
      props: {
        conversations: [],
        ariaLabel: 'Support conversations',
        emptyText: 'Nothing here yet',
        class: 'custom-list',
      },
    });

    const nav = container.querySelector('nav');
    expect(nav?.getAttribute('aria-label')).toBe('Support conversations');
    expect(nav?.classList.contains('custom-list')).toBe(true);
    expect(container.querySelector('[role="status"]')?.textContent).toBe('Nothing here yet');
  });

  test('falls back to message count previews and caps large unread badges', () => {
    const longPreview = `${'Long preview '.repeat(12)}tail`;
    const { container } = render(ChatConversationList, {
      props: {
        conversations: [
          summary({ id: 'count-only', messageCount: 4, updatedAt: '2026-06-01T00:02:00.000Z' }),
          summary({
            id: 'busy',
            title: 'Busy',
            lastMessageText: longPreview,
            lastMessageAt: '2026-06-01T00:03:00.000Z',
            unreadCount: 120,
          }),
        ],
      },
    });

    const buttons = [...container.querySelectorAll<HTMLButtonElement>('li > button')];
    expect(normalizedText(buttons[0]!)).toContain('99+ , 120 unread messages');
    expect(normalizedText(buttons[0]!)).toContain(`${longPreview.slice(0, 93)}...`);
    expect(normalizedText(buttons[1]!)).toContain('4 messages');
  });
});
