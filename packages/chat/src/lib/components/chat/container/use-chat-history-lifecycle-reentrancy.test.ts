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
  let anchorGate: Promise<void> | undefined;
  let resolveAnchorCompleted: (() => void) | undefined;
  const anchorCompleted = new Promise<void>((resolve) => {
    resolveAnchorCompleted = resolve;
  });
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
    correctAnchorAfterSettle: async () => {
      await anchorGate;
      resolveAnchorCompleted?.();
    },
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
    setAnchorGate(value: Promise<void> | undefined) {
      anchorGate = value;
    },
    setConversationId(value: string) {
      conversationId = value;
    },
    setFlushSync(value: () => void) {
      flushSyncCallback = value;
    },
    restored,
    errors,
    anchorCompleted,
  };
}

describe('chat history lifecycle reentrancy', () => {
  test('adapter catch cannot clear replacement state during flush reentrancy', async () => {
    let rejectOld: ((error: Error) => void) | undefined;
    let resolveNew: ((result: { hasMore: boolean }) => void) | undefined;
    let replacementLoading: Promise<void> | undefined;
    let flushes = 0;
    const oldError = new Error('old adapter failure');
    const fixture = createLifecycleFixture();
    fixture.setAdapter(
      createAdapter(
        () =>
          new Promise((_resolve, reject) => {
            rejectOld = reject;
          }),
      ),
    );
    fixture.setFlushSync(() => {
      flushes += 1;
      if (flushes !== 2) return;
      fixture.setConversationId('replacement');
      fixture.setAdapter(
        createAdapter(
          () =>
            new Promise((resolve) => {
              resolveNew = resolve;
            }),
        ),
      );
      fixture.state.invalidate();
      replacementLoading = fixture.state.loadHistory();
    });

    const oldLoading = fixture.state.loadHistory();
    rejectOld?.(oldError);
    await oldLoading;

    expect(fixture.errors).toHaveLength(0);
    expect(fixture.state.isLoading).toBe(true);
    expect(fixture.state.pending).not.toBeNull();
    resolveNew?.({ hasMore: true });
    expect(replacementLoading).toBeDefined();
    await replacementLoading;
  });

  test('callback catch cannot clear replacement state during flush reentrancy', async () => {
    let rejectOld: ((error: Error) => void) | undefined;
    let resolveNew: (() => void) | undefined;
    let replacementLoading: Promise<void> | undefined;
    let flushes = 0;
    const oldError = new Error('old callback failure');
    const fixture = createLifecycleFixture();
    fixture.setOnLoadHistory(
      async () =>
        await new Promise<void>((_resolve, reject) => {
          rejectOld = reject;
        }),
    );
    fixture.setFlushSync(() => {
      flushes += 1;
      if (flushes !== 2) return;
      fixture.setConversationId('replacement');
      fixture.setOnLoadHistory(
        async () =>
          await new Promise<void>((resolve) => {
            resolveNew = resolve;
          }),
      );
      fixture.state.invalidate();
      replacementLoading = fixture.state.loadHistory();
    });

    const oldLoading = fixture.state.loadHistory();
    rejectOld?.(oldError);
    let caught: unknown;
    try {
      await oldLoading;
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeUndefined();
    expect(fixture.state.isLoading).toBe(true);
    expect(fixture.state.pending).not.toBeNull();
    resolveNew?.();
    expect(replacementLoading).toBeDefined();
    await replacementLoading;
  });

  test('observes an adapter rejection after the initial flush transfers ownership', async () => {
    let rejectOld: ((error: Error) => void) | undefined;
    let settleReplacement: ((result: { hasMore: boolean }) => void) | undefined;
    let replacementLoading: Promise<void> | undefined;
    let transferred = false;
    let ownerSettled = false;
    const oldError = new Error('stale adapter failure');
    const fixture = createLifecycleFixture();
    fixture.setAdapter(
      createAdapter(
        () =>
          new Promise((_resolve, reject) => {
            rejectOld = reject;
          }),
      ),
    );
    fixture.setFlushSync(() => {
      if (transferred) return;
      transferred = true;
      fixture.setConversationId('replacement');
      fixture.setAdapter(
        createAdapter(
          () =>
            new Promise((resolve) => {
              settleReplacement = resolve;
            }),
        ),
      );
      fixture.state.invalidate();
      replacementLoading = fixture.state.loadHistory();
    });

    const oldLoading = fixture.state.loadHistory().then(() => {
      ownerSettled = true;
      return undefined;
    });
    await Promise.resolve();
    expect(ownerSettled).toBe(false);
    rejectOld?.(oldError);
    await oldLoading;

    expect(fixture.errors).toHaveLength(0);
    expect(fixture.state.isLoading).toBe(true);
    settleReplacement?.({ hasMore: true });
    expect(replacementLoading).toBeDefined();
    await replacementLoading;
  });

  test('observes a callback rejection after the initial flush transfers ownership', async () => {
    let rejectOld: ((error: Error) => void) | undefined;
    let settleReplacement: (() => void) | undefined;
    let replacementLoading: Promise<void> | undefined;
    let transferred = false;
    let ownerSettled = false;
    const oldError = new Error('stale callback failure');
    const fixture = createLifecycleFixture();
    fixture.setOnLoadHistory(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectOld = reject;
        }),
    );
    fixture.setFlushSync(() => {
      if (transferred) return;
      transferred = true;
      fixture.setConversationId('replacement');
      fixture.setOnLoadHistory(
        () =>
          new Promise<void>((resolve) => {
            settleReplacement = resolve;
          }),
      );
      fixture.state.invalidate();
      replacementLoading = fixture.state.loadHistory();
    });

    const oldLoading = fixture.state.loadHistory().then(() => {
      ownerSettled = true;
      return undefined;
    });
    await Promise.resolve();
    expect(ownerSettled).toBe(false);
    rejectOld?.(oldError);
    await oldLoading;

    expect(fixture.state.isLoading).toBe(true);
    expect(fixture.state.pending).not.toBeNull();
    settleReplacement?.();
    expect(replacementLoading).toBeDefined();
    await replacementLoading;
  });
});
