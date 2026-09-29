import { tick } from 'svelte';
import { preloadMarkdownPipeline } from '../message/markdown-pipeline.ts';
import type { UseChatScrollStateReturn } from './use-chat-scroll-state.svelte.ts';

type StreamingScrollState = Pick<UseChatScrollStateReturn, 'atBottom' | 'recomputeFromViewport'>;
type StreamingVirtualizer = {
  measureElementNode(node: HTMLElement | null): void;
  scrollToOffset(offset: number, options?: { behavior?: ScrollBehavior | 'instant' }): void;
  readonly scrollSize: number;
};

export type ChatStreamingStateOptions = {
  getIsVirtualized: () => boolean;
  getViewport: () => HTMLElement | null;
  getEditing: () => boolean;
  getScrollState: () => StreamingScrollState;
  getVirtualizer: () => StreamingVirtualizer;
};

/** Owns the imperative stream buffer and its frame-batched rendering work. */
export function useChatStreamingState(options: ChatStreamingStateOptions) {
  let streamingContent = $state('');
  let streamingMessageId = $state<string | null>(null);
  let streamingRowElement = $state<HTMLElement | null>(null);
  let tokenBuffer: string[] = [];
  let streamingScrollRaf: number | undefined;

  function cancelPendingFrame(): void {
    if (streamingScrollRaf === undefined) return;
    cancelAnimationFrame(streamingScrollRaf);
    streamingScrollRaf = undefined;
  }

  function beginStreaming(messageId: string): void {
    void preloadMarkdownPipeline();
    cancelPendingFrame();
    streamingMessageId = messageId;
    streamingContent = '';
    tokenBuffer = [];
  }

  function pushToken(token: string): void {
    tokenBuffer.push(token);
    if (streamingScrollRaf !== undefined) return;

    streamingScrollRaf = requestAnimationFrame(() => {
      streamingScrollRaf = undefined;
      const autoScrollSuppressed = options.getEditing();
      streamingContent = tokenBuffer.join('');
      void tick().then(async () => {
        const row = streamingRowElement;
        if (row) {
          options.getVirtualizer().measureElementNode(row);
          if (options.getIsVirtualized()) await tick();
        }
        if (autoScrollSuppressed) {
          options.getScrollState().recomputeFromViewport(options.getViewport());
        }
        return undefined;
      });
      const viewport = options.getViewport();
      const scrollState = options.getScrollState();
      if (!scrollState.atBottom || !viewport || autoScrollSuppressed) return;
      if (options.getIsVirtualized()) {
        options.getVirtualizer().scrollToOffset(options.getVirtualizer().scrollSize, {
          behavior: 'instant',
        });
      } else {
        viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'instant' });
      }
    });
  }

  function endStreaming(): void {
    cancelPendingFrame();
    streamingMessageId = null;
    streamingContent = '';
    tokenBuffer = [];
  }

  return {
    get content(): string {
      return streamingContent;
    },
    get messageId(): string | null {
      return streamingMessageId;
    },
    setStreamingRowElement(element: HTMLElement | null): void {
      streamingRowElement = element;
    },
    clearStreamingRowElement(element: HTMLElement): void {
      if (streamingRowElement === element) streamingRowElement = null;
    },
    beginStreaming,
    pushToken,
    endStreaming,
  };
}
