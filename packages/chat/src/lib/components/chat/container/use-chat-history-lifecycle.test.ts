import { describe, expect, test } from 'bun:test';
import type { ChatAdapter } from '../adapter/chat-adapter.ts';
import type { Message } from '../conversation-model.ts';
import {
  useChatHistoryLifecycle,
  type PendingHistoryScroll,
} from './use-chat-history-lifecycle.svelte.ts';

function noop(): void {}

function createViewport(): HTMLElement {
  const viewport = document.createElement('div');
  Object.defineProperty(viewport, 'scrollHeight', { configurable: true, value: 400 });
  Object.defineProperty(viewport, 'scrollTo', {
    configurable: true,
    value: () => {},
  });
  return viewport;
}
function createAdapter(loadOlderMessages: ChatAdapter['loadOlderMessages']): ChatAdapter {
  const adapter: ChatAdapter = { sendMessage: async () => {} };
  if (loadOlderMessages) adapter.loadOlderMessages = loadOlderMessages;
  return adapter;
}
function message(id: string, content: string, position: number): Message {
  return {
    id,
    role: 'user',
    content,
    position,
    createdAt: '2026-06-01T12:00:00.000Z',
    metadata: {},
    hidden: false,
  };
}
function createLifecycleFixture() {
  const viewport = createViewport();
  let messages: Message[] = [message('current', 'Current', 0)];
  let adapter: ChatAdapter | undefined;
  let onLoadHistory: (() => void | Promise<void>) | undefined;
  let virtualized = false;
  let tickGate: Promise<void> | undefined;
  let restoreGate: Promise<void> | undefined;
  let conversationId = 'conversation';
  let flushSyncCallback = noop;
  let restored: PendingHistoryScroll[] = [];
  const errors: { command: 'loadOlderMessages'; error: unknown }[] = [];
  let lifecycle: ReturnType<typeof useChatHistoryLifecycle>;
  lifecycle = useChatHistoryLifecycle({
    getConversationId: () => conversationId,
    getMessages: () => messages,
    getAdapter: () => adapter,
    getOnLoadHistory: () => onLoadHistory,
    getShowHistoryTrigger: () => true,
    getIsVirtualized: () => virtualized,
    getViewport: () => viewport,
    getScrollOffset: () => 0,
    getScrollSize: () => 400,
    getFirstVisibleMessage: () => null,
    getRenderedMessage: () => null,
    finishUserScrollGuard: () => true,
    resetUserScrolling: () => {},
    restorePendingHistoryScroll: async (pending) => {
      restored.push(pending);
      await restoreGate;
      lifecycle.setPending(null);
      return true;
    },
    correctAnchorAfterSettle: async () => {},
    onAdapterError: (event) => errors.push(event),
    flushSync: () => flushSyncCallback(),
    tick: async () => {
      await tickGate;
    },
  });
  return {
    state: lifecycle,
    setAdapter(value: ChatAdapter | undefined) {
      adapter = value;
    },
    setMessages(value: Message[]) {
      messages = value;
    },
    setOnLoadHistory(value: (() => void | Promise<void>) | undefined) {
      onLoadHistory = value;
    },
    setVirtualized(value: boolean) {
      virtualized = value;
    },
    setTickGate(value: Promise<void> | undefined) {
      tickGate = value;
    },
    setRestoreGate(value: Promise<void> | undefined) {
      restoreGate = value;
    },
    setConversationId(value: string) {
      conversationId = value;
    },
    setFlushSync(value: () => void) {
      flushSyncCallback = value;
    },
    restored,
    errors,
  };
}

function expectDisposed(fixture: ReturnType<typeof createLifecycleFixture>): void {
  expect(fixture.state.adapterHasMore).toBeUndefined();
  expect(fixture.state.pending).toBeNull();
}
describe('chat history lifecycle owner', () => {
  test('fences adapter loading state and restores after a transcript prepend', async () => {
    let resolveLoad: ((result: { hasMore: boolean }) => void) | undefined;
    const fixture = createLifecycleFixture();
    fixture.setAdapter(
      createAdapter(
        () =>
          new Promise((resolve) => {
            resolveLoad = resolve;
          }),
      ),
    );

    const loading = fixture.state.loadHistory();
    expect(fixture.state.isLoading).toBe(true);
    fixture.setMessages([message('older', 'Older', 0), message('current', 'Current', 1)]);
    resolveLoad?.({ hasMore: false });
    await loading;

    expect(fixture.state.isLoading).toBe(false);
    expect(fixture.state.adapterHasMore).toBe(false);
    expect(fixture.restored).toHaveLength(1);
    expect(fixture.state.pending).toBeNull();
  });

  test('uses the callback loader when no adapter history method exists', async () => {
    const fixture = createLifecycleFixture();
    let loadCount = 0;
    fixture.setOnLoadHistory(async () => {
      loadCount += 1;
      fixture.setMessages([message('older', 'Older', 0), message('current', 'Current', 1)]);
    });

    await fixture.state.loadHistory();

    expect(loadCount).toBe(1);
    expect(fixture.state.isLoading).toBe(false);
    expect(fixture.restored).toHaveLength(1);
  });

  test('reports adapter failures and clears the pending snapshot', async () => {
    const failure = new Error('history failed');
    const fixture = createLifecycleFixture();
    fixture.setAdapter(createAdapter(async () => Promise.reject(failure)));

    await fixture.state.loadHistory();

    expect(fixture.errors).toEqual([{ command: 'loadOlderMessages', error: failure }]);
    expect(fixture.state.isLoading).toBe(false);
    expect(fixture.state.pending).toBeNull();
  });

  test('waits for the Svelte tick before completing an unchanged virtualized load', async () => {
    let resolveLoad: ((result: { hasMore: boolean }) => void) | undefined;
    let resolveTick: (() => void) | undefined;
    const tick = new Promise<void>((resolve) => {
      resolveTick = resolve;
    });
    const fixture = createLifecycleFixture();
    fixture.setVirtualized(true);
    fixture.setTickGate(tick);
    fixture.setAdapter(
      createAdapter(
        () =>
          new Promise((resolve) => {
            resolveLoad = resolve;
          }),
      ),
    );

    const loading = fixture.state.loadHistory();
    resolveLoad?.({ hasMore: false });
    await Promise.resolve();
    expect(fixture.state.isLoading).toBe(true);
    expect(fixture.state.pending).not.toBeNull();

    resolveTick?.();
    await loading;
    expect(fixture.state.isLoading).toBe(false);
    expect(fixture.state.adapterHasMore).toBe(false);
    expect(fixture.state.pending).toBeNull();
  });

  test('finishes an unchanged virtualized load after its pending snapshot is cleared', async () => {
    let resolveLoad: ((result: { hasMore: boolean }) => void) | undefined;
    const fixture = createLifecycleFixture();
    fixture.setVirtualized(true);
    fixture.setAdapter(
      createAdapter(
        () =>
          new Promise((resolve) => {
            resolveLoad = resolve;
          }),
      ),
    );

    const loading = fixture.state.loadHistory();
    fixture.state.setPending(null);
    resolveLoad?.({ hasMore: true });
    await loading;

    expect(fixture.state.isLoading).toBe(false);
    expect(fixture.state.adapterHasMore).toBe(true);
  });

  test('disposal fences a late adapter completion without publishing state', async () => {
    let resolveLoad: ((result: { hasMore: boolean }) => void) | undefined;
    const fixture = createLifecycleFixture();
    fixture.setAdapter(
      createAdapter(
        () =>
          new Promise((resolve) => {
            resolveLoad = resolve;
          }),
      ),
    );

    const loading = fixture.state.loadHistory();
    fixture.state.dispose();
    resolveLoad?.({ hasMore: false });
    await loading;

    expect(fixture.state.isLoading).toBe(false);
    expect(fixture.state.adapterHasMore).toBeUndefined();
    expect(fixture.errors).toHaveLength(0);
    // COR-196: disposal after entry (loadHistory has already started) and
    // before release (the adapter promise resolves later) must not publish
    // through the scroll-restoration callback either.
    expect(fixture.restored).toHaveLength(0);
  });

  test('active callback failures retain their rejection semantics', async () => {
    const failure = new Error('callback failed');
    const fixture = createLifecycleFixture();
    fixture.setOnLoadHistory(async () => {
      throw failure;
    });

    let caught: unknown;
    try {
      await fixture.state.loadHistory();
    } catch (error) {
      caught = error;
    }

    expect(caught).toBe(failure);
    expect(fixture.state.isLoading).toBe(false);
  });

  test('does not publish old exhaustion after restoration yields to a new request', async () => {
    let resolveLoad: ((result: { hasMore: boolean }) => void) | undefined;
    let releaseRestore: (() => void) | undefined;
    const restore = new Promise<void>((resolve) => {
      releaseRestore = resolve;
    });
    const fixture = createLifecycleFixture();
    fixture.setRestoreGate(restore);
    fixture.setAdapter(
      createAdapter(
        () =>
          new Promise((resolve) => {
            resolveLoad = resolve;
          }),
      ),
    );
    const loading = fixture.state.loadHistory();
    fixture.setMessages([message('older', 'Older', 0), message('current', 'Current', 1)]);
    resolveLoad?.({ hasMore: false });
    await Promise.resolve();
    fixture.setConversationId('new-conversation');
    fixture.setAdapter(createAdapter(async () => ({ hasMore: true })));
    fixture.state.invalidate();
    releaseRestore?.();
    await loading;

    expect(fixture.state.adapterHasMore).toBeUndefined();
    expect(fixture.state.isLoading).toBe(false);
  });

  test('disposal fences a virtualized completion paused at tick', async () => {
    let resolveLoad: ((result: { hasMore: boolean }) => void) | undefined;
    let releaseTick: (() => void) | undefined;
    const tick = new Promise<void>((resolve) => {
      releaseTick = resolve;
    });
    const fixture = createLifecycleFixture();
    fixture.setVirtualized(true);
    fixture.setTickGate(tick);
    fixture.setAdapter(
      createAdapter(
        () =>
          new Promise((resolve) => {
            resolveLoad = resolve;
          }),
      ),
    );
    const loading = fixture.state.loadHistory();
    resolveLoad?.({ hasMore: false });
    await Promise.resolve();
    fixture.state.dispose();
    releaseTick?.();
    await loading;

    expectDisposed(fixture);
    // COR-196: disposal here lands mid-flight, after the adapter has already
    // resolved (entry) but before the deferred tick releases (release) — no
    // scroll-restoration callback should fire for it either.
    expect(fixture.restored).toHaveLength(0);
  });
});
