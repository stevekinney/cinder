import { describe, expect, test } from 'bun:test';
import type { ChatAdapter } from '../adapter/chat-adapter.ts';
import { useChatHistoryLifecycle } from './use-chat-history-lifecycle.svelte.ts';

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
function createLifecycleFixture() {
  const viewport = createViewport();
  let adapter: ChatAdapter | undefined;
  let onLoadHistory: (() => void | Promise<void>) | undefined;
  let anchorGate: Promise<void> | undefined;
  let resolveAnchorCompleted: (() => void) | undefined;
  const anchorCompleted = new Promise<void>((resolve) => {
    resolveAnchorCompleted = resolve;
  });
  let anchorSettles = 0;
  let flushSyncCallback = noop;
  const errors: { command: 'loadOlderMessages'; error: unknown }[] = [];
  let adapterErrorHandler: (event: { command: 'loadOlderMessages'; error: unknown }) => void = (
    event,
  ) => {
    errors.push(event);
  };
  let lifecycle: ReturnType<typeof useChatHistoryLifecycle>;
  lifecycle = useChatHistoryLifecycle({
    getConversationId: () => 'conversation',
    getMessages: () => [],
    getAdapter: () => adapter,
    getOnLoadHistory: () => onLoadHistory,
    getShowHistoryTrigger: () => true,
    getIsVirtualized: () => false,
    getViewport: () => viewport,
    getScrollOffset: () => 0,
    getScrollSize: () => 400,
    getFirstVisibleMessage: () => null,
    getRenderedMessage: () => null,
    finishUserScrollGuard: () => true,
    resetUserScrolling: () => {},
    restorePendingHistoryScroll: async () => true,
    correctAnchorAfterSettle: async () => {
      await anchorGate;
      anchorSettles += 1;
      resolveAnchorCompleted?.();
    },
    onAdapterError: (event) => adapterErrorHandler(event),
    flushSync: () => flushSyncCallback(),
    tick: async () => {},
  });
  return {
    state: lifecycle,
    setAdapter(value: ChatAdapter | undefined) {
      adapter = value;
    },
    setOnLoadHistory(value: (() => void | Promise<void>) | undefined) {
      onLoadHistory = value;
    },
    setAnchorGate(value: Promise<void> | undefined) {
      anchorGate = value;
    },
    setFlushSync(value: () => void) {
      flushSyncCallback = value;
    },
    setAdapterErrorHandler(
      value: (event: { command: 'loadOlderMessages'; error: unknown }) => void,
    ) {
      adapterErrorHandler = value;
    },
    errors,
    anchorCompleted,
    get anchorSettles() {
      return anchorSettles;
    },
  };
}

describe('chat history lifecycle flush handling', () => {
  test('settles an adapter loader when the initial flush throws', async () => {
    let rejectLoader: ((error: Error) => void) | undefined;
    let releaseAnchor: (() => void) | undefined;
    let flushFailed = false;
    const flushError = new Error('flush failed');
    const loaderError = new Error('loader failed');
    const anchorGate = new Promise<void>((resolve) => {
      releaseAnchor = resolve;
    });
    const fixture = createLifecycleFixture();
    fixture.setAnchorGate(anchorGate);
    fixture.setAdapter(
      createAdapter(
        () =>
          new Promise((_resolve, reject) => {
            rejectLoader = reject;
          }),
      ),
    );
    fixture.setFlushSync(() => {
      if (flushFailed) return;
      flushFailed = true;
      throw flushError;
    });

    const loading = fixture.state.loadHistory();
    rejectLoader?.(loaderError);
    releaseAnchor?.();
    await fixture.anchorCompleted;
    await loading;

    expect(fixture.errors).toEqual([{ command: 'loadOlderMessages', error: flushError }]);
  });

  test('settles a callback loader when the initial flush throws', async () => {
    let rejectLoader: ((error: Error) => void) | undefined;
    let releaseAnchor: (() => void) | undefined;
    let flushFailed = false;
    const flushError = new Error('callback flush failed');
    const loaderError = new Error('callback loader failed');
    const anchorGate = new Promise<void>((resolve) => {
      releaseAnchor = resolve;
    });
    const fixture = createLifecycleFixture();
    fixture.setAnchorGate(anchorGate);
    fixture.setOnLoadHistory(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectLoader = reject;
        }),
    );
    fixture.setFlushSync(() => {
      if (flushFailed) return;
      flushFailed = true;
      throw flushError;
    });

    let caught: unknown;
    const loading = fixture.state.loadHistory();
    rejectLoader?.(loaderError);
    releaseAnchor?.();
    await fixture.anchorCompleted;
    try {
      await loading;
    } catch (error) {
      caught = error;
    }

    expect(caught).toBe(flushError);
  });

  test('clears adapter state when the catch flush throws', async () => {
    let rejectLoader: ((error: Error) => void) | undefined;
    let loaderRejected = false;
    const loaderError = new Error('adapter loader failed');
    const flushError = new Error('adapter catch flush failed');
    const fixture = createLifecycleFixture();
    fixture.setAdapter(
      createAdapter(
        () =>
          new Promise((_resolve, reject) => {
            rejectLoader = reject;
          }),
      ),
    );
    fixture.setFlushSync(() => {
      if (loaderRejected) throw flushError;
    });

    let caught: unknown;
    const loading = fixture.state.loadHistory();
    loaderRejected = true;
    rejectLoader?.(loaderError);
    try {
      await loading;
    } catch (error) {
      caught = error;
    }

    expect(caught).toBe(flushError);
    expect(fixture.state.isLoading).toBe(false);
    expect(fixture.state.pending).toBeNull();
  });

  test('clears callback state when the catch flush throws', async () => {
    let rejectLoader: ((error: Error) => void) | undefined;
    let loaderRejected = false;
    const loaderError = new Error('callback loader failed');
    const flushError = new Error('callback catch flush failed');
    const fixture = createLifecycleFixture();
    fixture.setOnLoadHistory(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectLoader = reject;
        }),
    );
    fixture.setFlushSync(() => {
      if (loaderRejected) throw flushError;
    });

    let caught: unknown;
    const loading = fixture.state.loadHistory();
    loaderRejected = true;
    rejectLoader?.(loaderError);
    try {
      await loading;
    } catch (error) {
      caught = error;
    }

    expect(caught).toBe(flushError);
    expect(fixture.state.isLoading).toBe(false);
    expect(fixture.state.pending).toBeNull();
  });

  test('preserves adapter exhaustion and settles the failure anchor once', async () => {
    const failure = new Error('second history failed');
    const fixture = createLifecycleFixture();
    fixture.setAdapter(createAdapter(async () => ({ hasMore: false })));

    await fixture.state.loadHistory();
    expect(fixture.state.adapterHasMore).toBe(false);
    expect(fixture.anchorSettles).toBe(1);

    fixture.setAdapter(createAdapter(async () => Promise.reject(failure)));
    await fixture.state.loadHistory();

    expect(fixture.state.adapterHasMore).toBe(false);
    expect(fixture.anchorSettles).toBe(2);
  });

  test('settles loading when the adapter error reporter throws', async () => {
    const loaderError = new Error('adapter loader failed');
    const reportError = new Error('adapter reporter failed');
    const fixture = createLifecycleFixture();
    fixture.setAdapter(createAdapter(async () => Promise.reject(loaderError)));
    fixture.setAdapterErrorHandler(() => {
      throw reportError;
    });

    let caught: unknown;
    try {
      await fixture.state.loadHistory();
    } catch (error) {
      caught = error;
    }

    expect(caught).toBe(reportError);
    expect(fixture.state.isLoading).toBe(false);
    expect(fixture.state.pending).toBeNull();
  });

  test('settles a callback anchor once when catch flush cleanup throws', async () => {
    const loaderError = new Error('callback loader failed');
    const flushError = new Error('callback catch flush failed');
    const fixture = createLifecycleFixture();
    fixture.setOnLoadHistory(async () => {
      throw loaderError;
    });
    fixture.setFlushSync(() => {
      throw flushError;
    });

    let caught: unknown;
    try {
      await fixture.state.loadHistory();
    } catch (error) {
      caught = error;
    }

    expect(caught).toBe(flushError);
    expect(fixture.anchorSettles).toBe(1);
    expect(fixture.state.isLoading).toBe(false);
  });
});
