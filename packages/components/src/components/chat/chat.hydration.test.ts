/// <reference lib="dom" />
/** Full server-render-and-hydrate regression coverage for the public Chat tree. */
import { afterAll, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';
import { renderThenHydrate } from '../../test/hydrate.ts';
import type { ConversationHistory } from './conversation-model.ts';

setupHappyDom();

class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

class TestIntersectionObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

const originalResizeObserver = globalThis.ResizeObserver;
const originalIntersectionObserver = globalThis.IntersectionObserver;
globalThis.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver;
globalThis.IntersectionObserver =
  TestIntersectionObserver as unknown as typeof IntersectionObserver;

afterAll(() => {
  globalThis.ResizeObserver = originalResizeObserver;
  globalThis.IntersectionObserver = originalIntersectionObserver;
});

const { default: Chat } = await import('./chat.svelte');
const sourcePath = new URL('./chat.svelte', import.meta.url).pathname;

const emptyConversation: ConversationHistory = {
  schemaVersion: 4,
  id: 'empty-hydration-conversation',
  status: 'active',
  metadata: {},
  ids: [],
  messages: {},
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('Chat hydration', () => {
  test('hydrates an empty conversation without changing the server-rendered surface', async () => {
    const result = await renderThenHydrate(Chat, sourcePath, {
      id: 'stable-empty-chat',
      conversation: emptyConversation,
      virtualized: true,
    });

    try {
      const hydrationWarnings = result.warnings.filter((warning) =>
        warning.toLowerCase().includes('hydration'),
      );
      expect(hydrationWarnings).toEqual([]);

      expect(result.ssrHtml).toContain('No messages yet');
      expect(result.container.querySelector('.chat-empty')?.textContent).toContain(
        'No messages yet',
      );
      expect(result.container.querySelector('#stable-empty-chat-input-editor')).not.toBeNull();
      expect(result.container.querySelector('#stable-empty-chat-status')?.textContent).toContain(
        '0 messages in conversation',
      );

      const timeline = result.container.querySelector('#stable-empty-chat-timeline');
      expect(timeline?.getAttribute('data-cinder-virtualized')).toBeNull();
      expect(result.container.querySelector('[aria-live="assertive"]')).not.toBeNull();
      expect(result.container.querySelectorAll('[aria-live="polite"]').length).toBeGreaterThan(0);
    } finally {
      result.cleanup();
    }
  });
});
