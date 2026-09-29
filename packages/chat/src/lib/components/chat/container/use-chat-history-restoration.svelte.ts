import type { VirtualItem } from '../../../_internal/virtual-item.ts';
import type { Message } from '../conversation-model.ts';
import { pinHistoryAnchorVirtualItem } from './history-scroll-anchor.ts';
import { useChatHistoryAnchorRecapture } from './use-chat-history-anchor-recapture.svelte.ts';
import type { PendingHistoryScroll } from './use-chat-history-lifecycle.svelte.ts';
import { useChatHistoryRestorationDom } from './use-chat-history-restoration-dom.svelte.ts';
import { useChatHistoryRestorationInput } from './use-chat-history-restoration-input.svelte.ts';
import { useChatHistorySettleCorrection } from './use-chat-history-settle-correction.svelte.ts';
import type { ChatRenderRow } from './use-chat-message-groups.svelte.ts';
type Virtualizer = {
  readonly scrollOffset: number;
  readonly scrollPaddingStart: number;
  readonly scrollSize: number;
  scrollToOffset(offset: number, options?: { behavior?: ScrollBehavior | 'instant' }): void;
};
type Lifecycle = {
  readonly pending: PendingHistoryScroll | null;
  readonly announcement: string;
  isRequestActive(requestId: number): boolean;
  setPending(value: PendingHistoryScroll | null): void;
  setAnnouncement(value: string): void;
  finishDeferredAdapterHistoryLoading(requestId: number): void;
  captureHistoryScroll(requestId: number): void;
  historyTranscriptChanged(pending: PendingHistoryScroll): boolean;
};
type HistoryRestorationOptions = {
  getConversationId: () => string;
  getMessages: () => Message[];
  getIsVirtualized: () => boolean;
  getViewport: () => HTMLElement | null;
  getVirtualizer: () => Virtualizer;
  getLifecycle: () => Lifecycle;
  getRenderedMessage: (messageId: string) => HTMLElement | null;
  getHistoryTrigger: () => { focus(options?: FocusOptions): void } | null;
  getShowHistoryTrigger: () => boolean;
  canRestoreTriggerFocus: () => boolean;
  tick: () => Promise<void>;
};
export function useChatHistoryRestoration(options: HistoryRestorationOptions) {
  const dom = useChatHistoryRestorationDom({
    getViewport: options.getViewport,
    getRenderedMessage: options.getRenderedMessage,
    getHistoryTrigger: options.getHistoryTrigger,
    getShowHistoryTrigger: options.getShowHistoryTrigger,
    canRestoreTriggerFocus: options.canRestoreTriggerFocus,
    tick: options.tick,
  });
  let isStabilizing = $state(false);
  let stabilizationGeneration = 0;
  let deferredStabilization: PendingHistoryScroll | null = null;
  let isUserScrolling = false;
  let restorationScrollPending = false;
  let userScrollObserved = false;
  let deferredTriggerFocus = $state<
    { conversationId: string; pending: PendingHistoryScroll } | undefined
  >();
  let anchorMessageId = $state<string | null>(null);
  let anchorViewportOffset = $state<number | null>(null);
  let anchorRestoredScrollTop: number | null = null;
  let restoredNonVirtualPending: PendingHistoryScroll | null = null;

  const anchorRecapture = useChatHistoryAnchorRecapture({
    getPending: () => options.getLifecycle().pending,
    historyTranscriptChanged: (pending) => options.getLifecycle().historyTranscriptChanged(pending),
    isRequestActive: (requestId) => options.getLifecycle().isRequestActive(requestId),
    captureHistoryScroll: (requestId) => options.getLifecycle().captureHistoryScroll(requestId),
  });

  const input = useChatHistoryRestorationInput({
    clearAnchorAfterScroll,
    getRestorationScrollPending: () => restorationScrollPending,
    clearRestorationScrollPending: () => {
      restorationScrollPending = false;
    },
    getIsUserScrolling: () => isUserScrolling,
    setIsUserScrolling: (value) => {
      isUserScrolling = value;
    },
    getUserScrollObserved: () => userScrollObserved,
    setUserScrollObserved: (value) => {
      userScrollObserved = value;
    },
    clearDeferredStabilization: () => {
      deferredStabilization = null;
    },
    getPending: () => options.getLifecycle().pending,
    isRestorationActive: () => isStabilizing || deferredTriggerFocus !== undefined,
    isRequestActive: (requestId) => options.getLifecycle().isRequestActive(requestId),
    cancelStabilization,
    scheduleRecapture: anchorRecapture.schedule,
    recapture: anchorRecapture.recapture,
    onUserScrollReset: () => {
      const pending = deferredStabilization;
      deferredStabilization = null;
      if (pending !== null) void stabilize(pending);
    },
  });

  const settleCorrection = useChatHistorySettleCorrection({
    getViewport: options.getViewport,
    getIsVirtualized: options.getIsVirtualized,
    getRestoredPending: () => restoredNonVirtualPending,
    isRequestActive: (requestId) => options.getLifecycle().isRequestActive(requestId),
    getUserScrollObserved: () => userScrollObserved,
    getIsUserScrolling: () => isUserScrolling,
    tick: options.tick,
    measureCorrection: dom.measureCorrection,
  });

  function clearAnchor(): void {
    anchorMessageId = null;
    anchorViewportOffset = null;
    anchorRestoredScrollTop = null;
  }

  function setAnchor(pending: PendingHistoryScroll): void {
    anchorMessageId = pending.previousFirstMessageId;
    anchorViewportOffset = pending.previousFirstMessageViewportOffset;
    anchorRestoredScrollTop = null;
  }

  function clearAnchorAfterScroll(scrollTop: number): void {
    if (
      anchorMessageId !== null &&
      anchorRestoredScrollTop !== null &&
      Math.abs(scrollTop - anchorRestoredScrollTop) > 2
    ) {
      clearAnchor();
    }
  }

  function shouldDeferStabilization(): boolean {
    return isUserScrolling && !userScrollObserved;
  }

  function stabilizationIsCurrent(generation: number, conversationId: string): boolean {
    return (
      options.getViewport() !== null &&
      generation === stabilizationGeneration &&
      conversationId === options.getConversationId()
    );
  }

  function applyRestorePosition(pending: PendingHistoryScroll, viewport: HTMLElement): void {
    if (options.getIsVirtualized()) {
      setAnchor(pending);
      const virtualizer = options.getVirtualizer();
      const delta = virtualizer.scrollSize - pending.previousTotalSize;
      virtualizer.scrollToOffset(pending.previousScrollTop + delta, { behavior: 'instant' });
      anchorRestoredScrollTop = viewport.scrollTop || virtualizer.scrollOffset;
      return;
    }
    clearAnchor();
    restoredNonVirtualPending = pending;
    const correction = dom.measureCorrection(pending);
    const target =
      correction === null
        ? pending.previousScrollTop + (viewport.scrollHeight - pending.previousScrollHeight)
        : viewport.scrollTop + correction;
    restorationScrollPending = true;
    viewport.scrollTo({ top: target, behavior: 'instant' });
  }

  async function stabilize(pending: PendingHistoryScroll): Promise<void> {
    if (shouldDeferStabilization()) {
      deferredStabilization = pending;
      return;
    }
    deferredStabilization = null;
    const userScrolled = userScrollObserved;
    resetUserScrolling();
    if (userScrolled) {
      restoredNonVirtualPending = null;
      return;
    }

    const generation = ++stabilizationGeneration;
    const conversationId = options.getConversationId();
    isStabilizing = true;
    try {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        await dom.waitForLayoutFrame();
        if (!stabilizationIsCurrent(generation, conversationId)) return;
        const correction = dom.measureCorrection(pending);
        if (correction === null) return;
        if (Math.abs(correction) < 1) continue;
        const viewport = options.getViewport();
        viewport?.scrollTo({ top: viewport.scrollTop + correction, behavior: 'instant' });
      }
    } finally {
      if (generation === stabilizationGeneration) isStabilizing = false;
    }
  }

  function restoreHistoryScroll(pending: PendingHistoryScroll): boolean {
    const viewport = options.getViewport();
    const lifecycle = options.getLifecycle();
    const messages = options.getMessages();
    if (!viewport || !lifecycle.isRequestActive(pending.requestId)) return false;
    const currentFirstMessageId = messages[0]?.id ?? null;
    if (
      messages.length <= pending.previousCount ||
      currentFirstMessageId === pending.previousFirstTranscriptMessageId
    ) {
      return false;
    }

    const prependedCount = messages.length - pending.previousCount;
    lifecycle.setPending(null);
    lifecycle.finishDeferredAdapterHistoryLoading(pending.requestId);
    applyRestorePosition(pending, viewport);

    const announcement =
      prependedCount === 1
        ? '1 earlier message loaded.'
        : `${prependedCount} earlier messages loaded.`;
    lifecycle.setAnnouncement(announcement);
    const announcementRequestId = pending.requestId;
    setTimeout(() => {
      if (
        lifecycle.isRequestActive(announcementRequestId) &&
        options.getLifecycle().announcement === announcement
      ) {
        lifecycle.setAnnouncement('');
      }
    }, 1000);
    if (pending.focusHistoryTriggerAfterRestore) {
      deferredTriggerFocus = { conversationId: options.getConversationId(), pending };
    } else {
      dom.scheduleFocusAfterRestore(pending, false, () =>
        lifecycle.isRequestActive(pending.requestId),
      );
    }
    return true;
  }

  async function restorePendingHistoryScroll(pending: PendingHistoryScroll): Promise<boolean> {
    await dom.waitForLayoutFrame();
    const lifecycle = options.getLifecycle();
    if (lifecycle.pending !== pending || !lifecycle.isRequestActive(pending.requestId)) {
      return false;
    }
    const restored = restoreHistoryScroll(pending);
    if (restored && !options.getIsVirtualized()) await stabilize(pending);
    return restored;
  }

  function cancelStabilization(): void {
    stabilizationGeneration += 1;
    isStabilizing = false;
    deferredStabilization = null;
    deferredTriggerFocus = undefined;
  }

  function resetUserScrolling(): void {
    input.cancelUserScrollReset();
    deferredStabilization = null;
    restorationScrollPending = false;
    isUserScrolling = false;
    userScrollObserved = false;
  }

  function invalidate(): void {
    options.getLifecycle().setPending(null);
    restoredNonVirtualPending = null;
    anchorRecapture.cancel();
    cancelStabilization();
    resetUserScrolling();
    clearAnchor();
  }

  return {
    restorePendingHistoryScroll,
    restoreHistoryScroll,
    stabilize,
    correctAfterSettle: settleCorrection.correct,
    invalidate,
    cancelStabilization,
    resetUserScrolling,
    handleUserInput: input.handleUserInput,
    historyAnchorScrollAttachment: input.attachment,
    clearAnchor,
    clearAnchorAfterScroll,
    waitForLayoutFrame: dom.waitForLayoutFrame,
    pinHistoryAnchorVirtualItem: (row: ChatRenderRow, virtualItem: VirtualItem) =>
      pinHistoryAnchorVirtualItem(
        row,
        virtualItem,
        anchorMessageId,
        anchorViewportOffset,
        options.getViewport()?.scrollTop ?? options.getVirtualizer().scrollOffset,
        options.getVirtualizer().scrollPaddingStart,
      ),
    focusAfterRestore: dom.focusAfterRestore,
    get historyAnchorMessageId() {
      return anchorMessageId;
    },
    get historyAnchorViewportOffset() {
      return anchorViewportOffset;
    },
    get isRestoringNonVirtualHistory() {
      return (
        !options.getIsVirtualized() && (options.getLifecycle().pending !== null || isStabilizing)
      );
    },
    get deferredTriggerFocus() {
      return deferredTriggerFocus;
    },
    clearDeferredTriggerFocus: () => (deferredTriggerFocus = undefined),
    clearRestoredPending(): void {
      restoredNonVirtualPending = null;
    },
    dispose(): void {
      invalidate();
      input.cancelUserScrollReset();
    },
  };
}
