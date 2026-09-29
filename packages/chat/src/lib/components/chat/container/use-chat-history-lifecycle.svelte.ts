import type { ChatAdapter } from '../adapter/chat-adapter.ts';
import type { Message } from '../conversation-model.ts';
import { firstMessageViewportOffset } from './history-scroll-anchor.ts';
import { flushHistory, observeHistoryLoading } from './use-chat-history-loader.ts';

export type PendingHistoryScroll = {
  focusHistoryTriggerAfterRestore: boolean;
  requestId: number;
  previousFirstMessageId: string | null;
  previousFirstTranscriptMessageId: string | null;
  previousFirstMessageViewportOffset: number;
  previousCount: number;
  previousScrollTop: number;
  previousScrollHeight: number;
  previousTotalSize: number;
};

type HistoryLifecycleOptions = {
  getConversationId: () => string;
  getMessages: () => Message[];
  getAdapter: () => ChatAdapter | undefined;
  getOnLoadHistory: () => (() => void | Promise<void>) | undefined;
  getShowHistoryTrigger: () => boolean;
  getIsVirtualized: () => boolean;
  getViewport: () => HTMLElement | null;
  getScrollOffset: () => number;
  getScrollSize: () => number;
  getFirstVisibleMessage: () => { messageId: string; viewportOffset: number } | null;
  getRenderedMessage: (messageId: string) => HTMLElement | null;
  finishUserScrollGuard: () => boolean;
  resetUserScrolling: () => void;
  restorePendingHistoryScroll: (pending: PendingHistoryScroll) => Promise<boolean>;
  correctAnchorAfterSettle: (requestId: number) => Promise<void>;
  onAdapterError?: (event: { command: 'loadOlderMessages'; error: unknown }) => void;
  flushSync: () => void;
  tick: () => Promise<void>;
};

type ActiveHistoryRequest = {
  requestId: number;
  conversationId: string;
  adapter: ChatAdapter | undefined;
};

/** Owns history request fencing, pending snapshots, and loader completion state. */
export function useChatHistoryLifecycle(options: HistoryLifecycleOptions) {
  let isLoading = $state(false);
  let adapterHasMore = $state<boolean | undefined>(undefined);
  let announcement = $state('');
  let pending = $state<PendingHistoryScroll | null>(null);
  let deferredAdapterHasMore: boolean | null = null;
  let requestId = 0;
  let activeRequest: ActiveHistoryRequest | undefined;
  let disposed = false;

  function isRequestActive(request: number): boolean {
    const current = activeRequest;
    return (
      !disposed &&
      current?.requestId === request &&
      current.conversationId === options.getConversationId() &&
      current.adapter === options.getAdapter()
    );
  }

  function invalidate(): void {
    requestId += 1;
    activeRequest = undefined;
    isLoading = false;
    pending = null;
    deferredAdapterHasMore = null;
  }

  function dispose(): void {
    disposed = true;
    invalidate();
  }

  function captureHistoryScroll(nextRequestId: number): void {
    const existing = pending;
    const focusHistoryTriggerAfterRestore = existing?.focusHistoryTriggerAfterRestore ?? true;
    pending = buildPendingSnapshot(nextRequestId, focusHistoryTriggerAfterRestore);
  }

  function buildPendingSnapshot(
    nextRequestId: number,
    focusHistoryTriggerAfterRestore: boolean,
  ): PendingHistoryScroll {
    const viewport = options.getViewport();
    const messages = options.getMessages();
    const previousFirstTranscriptMessageId = messages[0]?.id ?? null;
    const visibleAnchor = options.getFirstVisibleMessage();
    const previousFirstMessageId = visibleAnchor?.messageId ?? previousFirstTranscriptMessageId;
    return {
      focusHistoryTriggerAfterRestore,
      requestId: nextRequestId,
      previousFirstMessageId,
      previousFirstTranscriptMessageId,
      previousFirstMessageViewportOffset: firstMessageViewportOffset(
        visibleAnchor,
        previousFirstMessageId,
        viewport,
        options.getRenderedMessage,
      ),
      previousCount: messages.length,
      previousScrollTop: viewport?.scrollTop ?? options.getScrollOffset(),
      previousScrollHeight: viewport?.scrollHeight ?? 0,
      previousTotalSize: options.getScrollSize(),
    };
  }

  function historyTranscriptChanged(snapshot: PendingHistoryScroll): boolean {
    const messages = options.getMessages();
    return (
      messages.length > snapshot.previousCount ||
      messages[0]?.id !== snapshot.previousFirstTranscriptMessageId
    );
  }

  function pendingFor(request: number): PendingHistoryScroll | null {
    return pending?.requestId === request ? pending : null;
  }

  function finishDeferredAdapterHistoryLoading(request: number): void {
    if (!isRequestActive(request) || deferredAdapterHasMore === null) return;
    adapterHasMore = deferredAdapterHasMore;
    deferredAdapterHasMore = null;
    isLoading = false;
  }

  async function settlePendingHistoryScroll(snapshot: PendingHistoryScroll): Promise<void> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      if (pending !== snapshot || !isRequestActive(snapshot.requestId)) return;
      if (await options.restorePendingHistoryScroll(snapshot)) return;
    }
    if (pending === snapshot && isRequestActive(snapshot.requestId)) {
      pending = null;
      finishDeferredAdapterHistoryLoading(snapshot.requestId);
    }
  }

  async function settleLoading(request: number): Promise<void> {
    if (!isRequestActive(request)) return;
    isLoading = false;
    await options.correctAnchorAfterSettle(request);
  }

  function handleHistoryError(currentRequest: number, report?: () => void): boolean {
    const flush = flushHistory(options.flushSync);
    if (!isRequestActive(currentRequest)) return false;
    pending = null;
    if (flush.failed) throw flush.error;
    report?.();
    return true;
  }

  async function loadFromAdapter(
    loadOlderMessages: NonNullable<ChatAdapter['loadOlderMessages']>,
    currentRequest: number,
  ): Promise<void> {
    let nextHasMore: boolean | undefined;
    try {
      const loading = loadOlderMessages(options.getConversationId());
      const flush = flushHistory(options.flushSync);
      const result = await observeHistoryLoading(loading, flush);
      if (flush.failed) throw flush.error;
      if (!isRequestActive(currentRequest)) return;
      options.flushSync();
      if (!isRequestActive(currentRequest)) return;
      nextHasMore = result.hasMore;
    } catch (error) {
      if (!isRequestActive(currentRequest)) return;
      try {
        const handled = handleHistoryError(currentRequest, () =>
          options.onAdapterError?.({ command: 'loadOlderMessages', error }),
        );
        if (!handled) return;
      } finally {
        await settleLoading(currentRequest);
      }
      return;
    }
    await finishAdapterLoad(currentRequest, nextHasMore);
  }

  async function finishAdapterLoad(
    currentRequest: number,
    nextHasMore: boolean | undefined,
  ): Promise<void> {
    if (!isRequestActive(currentRequest)) return;
    const currentPending = pendingFor(currentRequest);
    if (isUnchangedVirtualLoad(currentPending)) {
      await finishUnchangedVirtualLoad(currentRequest, nextHasMore);
      return;
    }
    await settleAdapterTranscript(currentPending);
    if (!isRequestActive(currentRequest)) return;
    adapterHasMore = nextHasMore;
    await settleLoading(currentRequest);
  }

  function isUnchangedVirtualLoad(snapshot: PendingHistoryScroll | null): boolean {
    return options.getIsVirtualized() && (snapshot === null || !historyTranscriptChanged(snapshot));
  }

  async function finishUnchangedVirtualLoad(
    currentRequest: number,
    nextHasMore: boolean | undefined,
  ): Promise<void> {
    if (!isRequestActive(currentRequest)) return;
    deferredAdapterHasMore = nextHasMore ?? null;
    await options.tick();
    if (!isRequestActive(currentRequest)) return;
    const currentPending = pendingFor(currentRequest);
    if (currentPending !== null && historyTranscriptChanged(currentPending)) {
      await settlePendingHistoryScroll(currentPending);
      return;
    }
    if (!isRequestActive(currentRequest)) return;
    pending = null;
    finishDeferredAdapterHistoryLoading(currentRequest);
  }

  async function settleAdapterTranscript(
    currentPending: PendingHistoryScroll | null,
  ): Promise<void> {
    if (currentPending === null) return;
    if (options.getIsVirtualized() || historyTranscriptChanged(currentPending)) {
      await settlePendingHistoryScroll(currentPending);
      return;
    }
    pending = null;
  }

  async function loadFromCallback(currentRequest: number): Promise<void> {
    try {
      const loading = options.getOnLoadHistory()?.();
      const flush = flushHistory(options.flushSync);
      await observeHistoryLoading(loading ?? Promise.resolve(), flush);
      if (flush.failed) throw flush.error;
      if (!isRequestActive(currentRequest)) return;
      options.flushSync();
      if (!isRequestActive(currentRequest)) return;
      const currentPending = pendingFor(currentRequest);
      if (currentPending !== null) await settlePendingHistoryScroll(currentPending);
    } catch (error) {
      if (!isRequestActive(currentRequest)) return;
      const handled = handleHistoryError(currentRequest);
      if (!handled) return;
      throw error;
    } finally {
      await settleLoading(currentRequest);
    }
  }

  async function loadHistory(): Promise<void> {
    if (disposed || isLoading || !options.getShowHistoryTrigger()) return;
    isLoading = true;
    options.resetUserScrolling();
    const viewport = options.getViewport();
    if (!options.finishUserScrollGuard() && viewport) {
      viewport.scrollTo({ top: viewport.scrollTop, behavior: 'instant' });
    }
    const currentRequest = ++requestId;
    activeRequest = {
      requestId: currentRequest,
      conversationId: options.getConversationId(),
      adapter: options.getAdapter(),
    };
    captureHistoryScroll(currentRequest);
    if (pending === null) {
      isLoading = false;
      activeRequest = undefined;
      return;
    }

    const adapter = options.getAdapter();
    const loadOlderMessages = adapter?.loadOlderMessages;
    if (loadOlderMessages) {
      await loadFromAdapter(loadOlderMessages, currentRequest);
      return;
    }
    await loadFromCallback(currentRequest);
  }

  return {
    get isLoading(): boolean {
      return isLoading;
    },
    get adapterHasMore(): boolean | undefined {
      return adapterHasMore;
    },
    get announcement(): string {
      return announcement;
    },
    get pending(): PendingHistoryScroll | null {
      return pending;
    },
    get requestId(): number {
      return requestId;
    },
    setAnnouncement(value: string): void {
      announcement = value;
    },
    setPending(value: PendingHistoryScroll | null): void {
      pending = value;
    },
    setAdapterHasMore(value: boolean | undefined): void {
      adapterHasMore = value;
    },
    setDeferredAdapterHasMore(value: boolean | null): void {
      deferredAdapterHasMore = value;
    },
    isRequestActive,
    invalidate,
    dispose,
    captureHistoryScroll,
    finishDeferredAdapterHistoryLoading,
    historyTranscriptChanged,
    pendingFor,
    settlePendingHistoryScroll,
    loadHistory,
  };
}
