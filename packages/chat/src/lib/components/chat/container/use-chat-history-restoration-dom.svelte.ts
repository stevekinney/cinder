import type { PendingHistoryScroll } from './use-chat-history-lifecycle.svelte.ts';

type HistoryRestorationDomOptions = {
  getViewport: () => HTMLElement | null;
  getRenderedMessage: (messageId: string) => HTMLElement | null;
  getHistoryTrigger: () => { focus(options?: FocusOptions): void } | null;
  getShowHistoryTrigger: () => boolean;
  canRestoreTriggerFocus: () => boolean;
  tick: () => Promise<void>;
};

export function useChatHistoryRestorationDom(options: HistoryRestorationDomOptions) {
  async function waitForLayoutFrame(): Promise<void> {
    await options.tick();
    if (typeof requestAnimationFrame !== 'function') return;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }

  function measureCorrection(pending: PendingHistoryScroll): number | null {
    const viewport = options.getViewport();
    if (!viewport || pending.previousFirstMessageId === null) return null;
    const anchor = options.getRenderedMessage(pending.previousFirstMessageId);
    if (!anchor) return null;
    const anchorRect = anchor.getBoundingClientRect();
    const viewportRect = viewport.getBoundingClientRect();
    const hasLayoutBox =
      anchorRect.top !== 0 ||
      anchorRect.bottom !== 0 ||
      viewportRect.top !== 0 ||
      viewportRect.bottom !== 0;
    if (!hasLayoutBox) return null;
    return anchorRect.top - viewportRect.top - pending.previousFirstMessageViewportOffset;
  }

  function focusAfterRestore(pending: PendingHistoryScroll, focusTrigger: boolean): void {
    const viewport = options.getViewport();
    if (!viewport) return;
    const trigger = options.getHistoryTrigger();
    if (focusTrigger && options.getShowHistoryTrigger() && trigger) {
      trigger.focus({ preventScroll: true });
      return;
    }
    const anchor = pending.previousFirstMessageId
      ? viewport.querySelector<HTMLElement>(
          `#message-${CSS.escape(pending.previousFirstMessageId)}`,
        )
      : null;
    (anchor ?? viewport.querySelector<HTMLElement>('.chat-message'))?.focus({
      preventScroll: true,
    });
  }

  function scheduleFocusAfterRestore(
    pending: PendingHistoryScroll,
    focusTrigger: boolean,
    requestIsActive: () => boolean,
  ): void {
    void options.tick().then(() => {
      if (requestIsActive() && options.canRestoreTriggerFocus()) {
        focusAfterRestore(pending, focusTrigger);
      }
      return undefined;
    });
  }

  return { waitForLayoutFrame, measureCorrection, focusAfterRestore, scheduleFocusAfterRestore };
}
