import { tick, untrack } from 'svelte';
import type { Message } from '../conversation-model.ts';
import { isAtBottom as checkIsAtBottom } from './scroll-utilities.ts';
import type { useChatHistoryLifecycle } from './use-chat-history-lifecycle.svelte.ts';
import type { useChatHistoryRestoration } from './use-chat-history-restoration.svelte.ts';
import type { UseChatScrollStateReturn } from './use-chat-scroll-state.svelte.ts';
import type { ChatVirtualizer } from './use-chat-virtualizer.svelte.ts';

type AutoScrollState = Pick<
  UseChatScrollStateReturn,
  'atBottom' | 'isUserScrolling' | 'recomputeFromViewport'
>;
type AutoScrollVirtualizer = Pick<ChatVirtualizer, 'scrollSize' | 'scrollToOffset'>;
type AutoScrollHistoryLifecycle = Pick<ReturnType<typeof useChatHistoryLifecycle>, 'pending'>;
type AutoScrollHistoryRestoration = Pick<
  ReturnType<typeof useChatHistoryRestoration>,
  'historyAnchorMessageId' | 'waitForLayoutFrame'
>;

export interface UseChatAutoScrollOptions {
  getViewport: () => HTMLElement | null;
  getMessages: () => Message[];
  getIsVirtualized: () => boolean;
  getBottomThreshold: () => number;
  getVirtualizationInitialHeight: () => number;
  getScrollState: () => AutoScrollState;
  getVirtualizer: () => AutoScrollVirtualizer;
  getHistoryLifecycle: () => AutoScrollHistoryLifecycle;
  getHistoryRestoration: () => AutoScrollHistoryRestoration;
  getIsEditing: () => boolean;
}

export interface UseChatAutoScrollReturn {
  resetPrependSuppression(): void;
}

type TranscriptGrowth = {
  currentCount: number;
  currentScrollExtent: number;
  previousVirtualExtent: number | null;
  isTranscriptGrowth: boolean;
  isHistoryPrepend: boolean;
  isTranscriptAppend: boolean;
};

export function useChatAutoScroll(options: UseChatAutoScrollOptions): UseChatAutoScrollReturn {
  let previousMessageCount = untrack(() => options.getMessages().length);
  let previousFirstMessageId = untrack(() => options.getMessages()[0]?.id);
  let previousLastMessageId = untrack(() => options.getMessages().at(-1)?.id);
  let previousVirtualExtent: number | null = null;
  let prependSuppressed = false;

  const resetPrependSuppression = (): void => {
    prependSuppressed = false;
  };

  const captureTranscriptGrowth = (
    viewport: HTMLElement,
    virtualized: boolean,
    virtualizer: AutoScrollVirtualizer,
  ): TranscriptGrowth => {
    const messages = options.getMessages();
    const currentCount = messages.length;
    const isTranscriptGrowth = currentCount > previousMessageCount;
    previousMessageCount = currentCount;
    const currentFirstMessageId = messages[0]?.id;
    const currentLastMessageId = messages.at(-1)?.id;
    const isHistoryPrepend =
      isTranscriptGrowth &&
      currentFirstMessageId !== previousFirstMessageId &&
      currentLastMessageId === previousLastMessageId;
    previousFirstMessageId = currentFirstMessageId;
    previousLastMessageId = currentLastMessageId;
    const isTranscriptAppend = isTranscriptGrowth && !isHistoryPrepend;
    if (isTranscriptAppend) prependSuppressed = false;
    const currentScrollExtent = virtualized ? virtualizer.scrollSize : viewport.scrollHeight;
    const previousExtent = previousVirtualExtent;
    previousVirtualExtent = virtualized ? currentScrollExtent : null;
    return {
      currentCount,
      currentScrollExtent,
      previousVirtualExtent: previousExtent,
      isTranscriptGrowth,
      isHistoryPrepend,
      isTranscriptAppend,
    };
  };

  const correctVirtualizedViewport = (viewport: HTMLElement): void => {
    const virtualizer = options.getVirtualizer();
    const maximumOffset = Math.max(
      0,
      virtualizer.scrollSize - (viewport.clientHeight || options.getVirtualizationInitialHeight()),
    );
    if (Math.abs((viewport.scrollTop || 0) - maximumOffset) <= 1) return;
    virtualizer.scrollToOffset(virtualizer.scrollSize, { behavior: 'instant' });
  };

  const applyBottomCorrection = (): void => {
    const viewport = options.getViewport();
    if (!viewport) return;
    if (
      options.getHistoryLifecycle().pending ||
      options.getHistoryRestoration().historyAnchorMessageId !== null
    ) {
      return;
    }
    if (options.getIsEditing()) {
      options.getScrollState().recomputeFromViewport(viewport);
      return;
    }
    if (options.getScrollState().isUserScrolling) return;
    if (options.getIsVirtualized()) {
      correctVirtualizedViewport(viewport);
      return;
    }
    viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'instant' });
  };

  const scheduleBottomCorrection = (isTranscriptAppend: boolean): (() => void) => {
    let cancelled = false;
    const waitForBottomTarget = isTranscriptAppend
      ? options.getHistoryRestoration().waitForLayoutFrame()
      : tick();
    void waitForBottomTarget.then(() => {
      if (cancelled) return undefined;
      applyBottomCorrection();
      return undefined;
    });
    return () => {
      cancelled = true;
    };
  };

  const shouldAcceptPrepend = (
    viewport: HTMLElement,
    growth: TranscriptGrowth,
    virtualized: boolean,
  ): boolean => {
    if (!growth.isHistoryPrepend) return true;
    const extent =
      virtualized && growth.previousVirtualExtent !== null
        ? growth.previousVirtualExtent
        : growth.currentScrollExtent;
    const genuinelyAtBottom = checkIsAtBottom(
      {
        scrollTop: viewport.scrollTop,
        scrollHeight: extent,
        clientHeight: viewport.clientHeight,
      },
      options.getBottomThreshold(),
    );
    prependSuppressed = !genuinelyAtBottom;
    return genuinelyAtBottom;
  };

  const hasActiveHistoryAnchor = (): boolean =>
    untrack(
      () =>
        options.getHistoryLifecycle().pending !== null ||
        options.getHistoryRestoration().historyAnchorMessageId !== null,
    );

  const shouldSkipCorrection = (
    viewport: HTMLElement,
    growth: TranscriptGrowth,
    virtualized: boolean,
    scrollState: AutoScrollState,
  ): boolean =>
    scrollState.isUserScrolling ||
    !shouldAcceptPrepend(viewport, growth, virtualized) ||
    hasActiveHistoryAnchor() ||
    (!growth.isTranscriptGrowth && prependSuppressed);

  $effect.pre(() => {
    const viewport = options.getViewport();
    if (!viewport) return undefined;
    const virtualized = options.getIsVirtualized();
    const virtualizer = options.getVirtualizer();
    const growth = captureTranscriptGrowth(viewport, virtualized, virtualizer);
    const scrollState = options.getScrollState();
    const atBottom = untrack(() => scrollState.atBottom);
    if (shouldSkipCorrection(viewport, growth, virtualized, scrollState)) return undefined;

    const activeEditNeedsScrollRecompute =
      growth.isTranscriptAppend && untrack(() => options.getIsEditing());
    if ((atBottom || activeEditNeedsScrollRecompute) && growth.currentCount > 0)
      return scheduleBottomCorrection(growth.isTranscriptAppend);

    return undefined;
  });

  return { resetPrependSuppression };
}
