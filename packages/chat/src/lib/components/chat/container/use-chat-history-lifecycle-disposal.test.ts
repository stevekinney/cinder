import { expect, test } from 'bun:test';
import type { ChatAdapter } from '../adapter/chat-adapter.ts';
import type { Message } from '../conversation-model.ts';
import { useChatHistoryLifecycle } from './use-chat-history-lifecycle.svelte.ts';

function message(id: string, position: number): Message {
  return {
    id,
    role: 'user',
    content: id,
    position,
    createdAt: '2026-06-01T12:00:00.000Z',
    metadata: {},
    hidden: false,
  };
}

function createFixture() {
  const viewport = document.createElement('div');
  let messages: Message[] = [message('current', 0)];
  let resolveLoad: ((result: { hasMore: boolean }) => void) | undefined;
  let releaseRestore: (() => void) | undefined;
  const restore = new Promise<void>((resolve) => {
    releaseRestore = resolve;
  });
  let lifecycle: ReturnType<typeof useChatHistoryLifecycle>;
  const adapter: ChatAdapter = {
    sendMessage: async () => {},
    loadOlderMessages: async () =>
      new Promise<{ hasMore: boolean }>((resolve) => {
        resolveLoad = resolve;
      }),
  };
  lifecycle = useChatHistoryLifecycle({
    getConversationId: () => 'conversation',
    getMessages: () => messages,
    getAdapter: () => adapter,
    getOnLoadHistory: () => undefined,
    getShowHistoryTrigger: () => true,
    getIsVirtualized: () => false,
    getViewport: () => viewport,
    getScrollOffset: () => 0,
    getScrollSize: () => 400,
    getFirstVisibleMessage: () => null,
    getRenderedMessage: () => null,
    finishUserScrollGuard: () => true,
    resetUserScrolling: () => {},
    restorePendingHistoryScroll: async () => {
      await restore;
      lifecycle.setPending(null);
      return true;
    },
    correctAnchorAfterSettle: async () => {},
    flushSync: () => {},
    tick: async () => {},
  });
  return {
    lifecycle,
    setMessages(value: Message[]) {
      messages = value;
    },
    get resolveLoad() {
      return resolveLoad;
    },
    get releaseRestore() {
      return releaseRestore;
    },
  };
}

test('disposal fences restoration before old anchor completion can publish', async () => {
  const fixture = createFixture();
  const loading = fixture.lifecycle.loadHistory();
  fixture.setMessages([message('older', 0), message('current', 1)]);
  fixture.resolveLoad?.({ hasMore: false });
  await Promise.resolve();
  fixture.lifecycle.dispose();
  fixture.releaseRestore?.();
  await loading;

  expect(fixture.lifecycle.adapterHasMore).toBeUndefined();
  expect(fixture.lifecycle.pending).toBeNull();
});
