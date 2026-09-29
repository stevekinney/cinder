import type { PendingHistoryScroll } from './use-chat-history-lifecycle.svelte.ts';

type HistoryAnchorRecaptureOptions = {
  getPending: () => PendingHistoryScroll | null;
  historyTranscriptChanged(pending: PendingHistoryScroll): boolean;
  isRequestActive(requestId: number): boolean;
  captureHistoryScroll(requestId: number): void;
};

export function useChatHistoryAnchorRecapture(options: HistoryAnchorRecaptureOptions) {
  let recaptureRaf: number | undefined;

  function cancel(): void {
    if (recaptureRaf === undefined) return;
    cancelAnimationFrame(recaptureRaf);
    recaptureRaf = undefined;
  }

  function recapture(pending: PendingHistoryScroll | null): void {
    if (
      pending === null ||
      options.getPending() !== pending ||
      options.historyTranscriptChanged(pending) ||
      !options.isRequestActive(pending.requestId)
    ) {
      return;
    }
    options.captureHistoryScroll(pending.requestId);
  }

  function schedule(): void {
    const pending = options.getPending();
    if (pending === null) return;
    cancel();
    recaptureRaf = requestAnimationFrame(() => {
      recaptureRaf = undefined;
      recapture(pending);
    });
  }

  return { cancel, recapture, schedule };
}
