import type { PendingHistoryScroll } from './use-chat-history-lifecycle.svelte.ts';

type HistorySettleCorrectionOptions = {
  getViewport: () => HTMLElement | null;
  getIsVirtualized: () => boolean;
  getRestoredPending: () => PendingHistoryScroll | null;
  isRequestActive(requestId: number): boolean;
  getUserScrollObserved: () => boolean;
  getIsUserScrolling: () => boolean;
  tick: () => Promise<void>;
  measureCorrection(pending: PendingHistoryScroll): number | null;
};

export function useChatHistorySettleCorrection(options: HistorySettleCorrectionOptions) {
  async function correct(requestId: number): Promise<void> {
    const restored = options.getRestoredPending();
    const viewport = options.getViewport();
    if (viewport === null || !canStartCorrection(restored, viewport, requestId)) return;
    const scrollTopAtFlip = viewport.scrollTop;
    await options.tick();
    if (!canFinishCorrection(restored, viewport, requestId, scrollTopAtFlip)) return;
    const correction = options.measureCorrection(restored);
    if (correction !== null && Math.abs(correction) >= 1) {
      viewport.scrollTo({ top: viewport.scrollTop + correction, behavior: 'instant' });
    }
  }

  function canStartCorrection(
    restored: PendingHistoryScroll | null,
    viewport: HTMLElement | null,
    requestId: number,
  ): restored is PendingHistoryScroll {
    return (
      viewport !== null &&
      !options.getIsVirtualized() &&
      restored !== null &&
      restored.requestId === requestId &&
      options.isRequestActive(requestId) &&
      !options.getUserScrollObserved() &&
      !options.getIsUserScrolling()
    );
  }

  function canFinishCorrection(
    restored: PendingHistoryScroll,
    viewport: HTMLElement,
    requestId: number,
    scrollTopAtFlip: number,
  ): boolean {
    return (
      options.getViewport() === viewport &&
      options.getRestoredPending() === restored &&
      options.isRequestActive(requestId) &&
      Math.abs(viewport.scrollTop - scrollTopAtFlip) <= 1
    );
  }

  return { correct };
}
