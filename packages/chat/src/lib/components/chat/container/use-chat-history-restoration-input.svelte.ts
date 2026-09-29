import type { Attachment } from 'svelte/attachments';
import type { PendingHistoryScroll } from './use-chat-history-lifecycle.svelte.ts';

type HistoryRestorationInputOptions = {
  clearAnchorAfterScroll(scrollTop: number): void;
  getRestorationScrollPending(): boolean;
  clearRestorationScrollPending(): void;
  getIsUserScrolling(): boolean;
  getUserScrollObserved(): boolean;
  setIsUserScrolling(value: boolean): void;
  setUserScrollObserved(value: boolean): void;
  clearDeferredStabilization(): void;
  getPending(): PendingHistoryScroll | null;
  isRestorationActive(): boolean;
  isRequestActive(requestId: number): boolean;
  cancelStabilization(): void;
  scheduleRecapture(): void;
  recapture(pending: PendingHistoryScroll | null): void;
  onUserScrollReset(): void;
};

export function useChatHistoryRestorationInput(options: HistoryRestorationInputOptions) {
  let userScrollResetRaf: number | undefined;

  function cancelUserScrollReset(): void {
    if (userScrollResetRaf === undefined) return;
    cancelAnimationFrame(userScrollResetRaf);
    userScrollResetRaf = undefined;
  }

  function handleUserInput(): void {
    const pending = options.getPending();
    if (pending === null && !options.isRestorationActive()) {
      return;
    }
    options.setIsUserScrolling(true);
    options.setUserScrollObserved(false);
    cancelUserScrollReset();
    userScrollResetRaf = requestAnimationFrame(() => {
      userScrollResetRaf = requestAnimationFrame(() => {
        userScrollResetRaf = requestAnimationFrame(() => {
          userScrollResetRaf = undefined;
          options.setIsUserScrolling(false);
          options.onUserScrollReset();
        });
      });
    });
    options.cancelStabilization();
    const activePending = options.getPending();
    if (activePending !== null && options.isRequestActive(activePending.requestId)) {
      activePending.focusHistoryTriggerAfterRestore = false;
    }
  }

  const attachment: Attachment<HTMLElement> = (node) => {
    const handleScroll = () => {
      options.clearAnchorAfterScroll(node.scrollTop);
      const expected = options.getRestorationScrollPending();
      options.clearRestorationScrollPending();
      if (options.getIsUserScrolling() && !expected) {
        options.setUserScrollObserved(true);
        options.clearDeferredStabilization();
        cancelUserScrollReset();
      }
      if (
        options.getIsUserScrolling() &&
        options.getUserScrollObserved() &&
        options.getPending() === null
      ) {
        options.cancelStabilization();
      }
      options.scheduleRecapture();
    };
    const handleScrollEnd = () => {
      if (
        options.getIsUserScrolling() &&
        options.getUserScrollObserved() &&
        options.getPending() === null
      ) {
        options.cancelStabilization();
      }
      options.setIsUserScrolling(false);
      cancelUserScrollReset();
      options.recapture(options.getPending());
    };
    node.addEventListener('scroll', handleScroll, { passive: true });
    node.addEventListener('scrollend', handleScrollEnd);
    return () => {
      node.removeEventListener('scroll', handleScroll);
      node.removeEventListener('scrollend', handleScrollEnd);
    };
  };

  return { attachment, handleUserInput, cancelUserScrollReset };
}
