<script lang="ts" module>
  import type { HTMLAttributes } from 'svelte/elements';
  import type { MarkdownNodeOverride } from './chat-message-parts.ts';

  export type MessageContentProps = Omit<HTMLAttributes<HTMLDivElement>, 'class'> & {
    /** Raw markdown/text content to render */
    content: string;
    /** Whether content is fully expanded */
    expanded?: boolean;
    /** Character threshold for truncation */
    threshold?: number;
    /** Whether this message is currently streaming */
    streaming?: boolean;
    /** Override content for streaming (partial token buffer) */
    overrideContent?: string | undefined;
    /** Additional CSS class */
    class?: string;
    /** Optional renderer seam for fenced code, table, and Mermaid nodes. */
    markdownNode?: MarkdownNodeOverride | undefined;
  };
</script>

<script lang="ts">
  import { classNames } from '../../../utilities/class-names.ts';
  import MarkdownPreview from './markdown-preview.svelte';

  let {
    content,
    expanded = true,
    threshold = 500,
    streaming = false,
    overrideContent,
    class: className,
    markdownNode,
    ...rest
  }: MessageContentProps = $props();

  /**
   * Find a truncation boundary by scanning backward from the threshold
   * for a paragraph break (\n\n). Falls back to the last single newline,
   * then to the threshold itself. This newline-based heuristic helps reduce
   * the chance of truncating in the middle of Markdown structures (like
   * code fences, tables, or links), but does not guarantee well-formed HTML.
   */
  function findSafeBoundary(text: string, limit: number): number {
    // Look for the last paragraph break before the limit
    const paragraphBreak = text.lastIndexOf('\n\n', limit);
    if (paragraphBreak > 0) return paragraphBreak;

    // Fall back to the last line break
    const lineBreak = text.lastIndexOf('\n', limit);
    if (lineBreak > 0) return lineBreak;

    // Last resort: use the limit directly
    return limit;
  }

  function splitStreamingContent(text: string): { rendered: string; tail: string } {
    const codeFenceCount = (text.match(/```/g) ?? []).length;
    if (codeFenceCount % 2 !== 0) {
      const lastFenceIndex = text.lastIndexOf('```');
      return {
        rendered: text.slice(0, lastFenceIndex),
        tail: text.slice(lastFenceIndex),
      };
    }

    const boundary = findSafeBoundary(text, text.length);
    return {
      rendered: text.slice(0, boundary),
      tail: text.slice(boundary),
    };
  }

  // The effective content: use override when streaming, otherwise the message content
  const effectiveContent = $derived(overrideContent ?? content);

  // Streaming mode: split content into rendered markdown and raw tail
  const streamingSplit = $derived.by(() => {
    if (!streaming) return null;
    return splitStreamingContent(effectiveContent);
  });

  // Compute display content based on expanded state (non-streaming only)
  const displayContent = $derived.by(() => {
    if (streaming) {
      return streamingSplit?.rendered ?? '';
    }
    if (expanded || effectiveContent.length <= threshold) {
      return effectiveContent;
    }
    const boundary = findSafeBoundary(effectiveContent, threshold);
    return effectiveContent.slice(0, boundary);
  });

  // The raw tail text during streaming (displayed with pre-wrap + cursor)
  const streamingTail = $derived(streaming ? (streamingSplit?.tail ?? '') : '');
  const hasStreamingProgress = $derived(streaming && effectiveContent.trim().length > 0);

  // Whether truncation is active (used by parent to show ellipsis indicator)
  const isTruncated = $derived(!streaming && !expanded && effectiveContent.length > threshold);
</script>

<div
  class={classNames('message-content', streaming && 'message-content-streaming', className)}
  {...rest}
>
  {#if displayContent}
    <MarkdownPreview content={displayContent} {markdownNode} />
  {/if}
  {#if streaming && streamingTail}
    <span class="message-content-tail">{streamingTail}</span>
  {/if}
  {#if hasStreamingProgress}
    <span class="chat-message-streaming-progress" aria-hidden="true">
      <span class="chat-message-streaming-dot"></span>
      <span class="chat-message-streaming-dot"></span>
      <span class="chat-message-streaming-dot"></span>
    </span>
  {/if}
  {#if isTruncated}
    <span class="message-content-ellipsis" aria-hidden="true">...</span>
  {/if}
</div>

<style>
  .message-content {
    /* Typography inherited from MarkdownPreview component */
    display: block;
  }

  .message-content-ellipsis {
    display: block;
    margin-top: var(--cinder-space-1);
    color: var(--cinder-text-muted);
    font-size: var(--_cinder-chat-text-sm, var(--cinder-text-sm));
  }

  /* Streaming tail: raw text that hasn't been through markdown rendering yet */
  .message-content-tail {
    white-space: pre-wrap;
    word-break: break-word;
  }

  .message-content-streaming :global(.message-content-preview),
  .message-content-streaming .message-content-tail {
    color: transparent;
    background: linear-gradient(
      100deg,
      var(--cinder-text-muted) 0%,
      var(--cinder-text-default) 45%,
      var(--cinder-text-muted) 60%,
      var(--cinder-text-default) 100%
    );
    background-size: 240% 100%;
    background-clip: text;
    -webkit-background-clip: text;
    animation: cinder-chat-live-text-shimmer 1.8s steps(48, end) infinite;
  }

  @media (hover: hover) {
    .message-content-streaming:hover :global(.message-content-preview),
    .message-content-streaming:hover .message-content-tail {
      color: var(--cinder-text-default);
      background: none;
      animation: none;
    }
  }

  @keyframes cinder-chat-live-text-shimmer {
    to {
      background-position: -240% 0;
    }
  }

  .chat-message-streaming-progress {
    display: inline-flex;
    align-items: center;
    gap: 0.1875rem;
    margin-inline-start: var(--cinder-space-1);
    vertical-align: middle;
  }

  .chat-message-streaming-dot {
    inline-size: 0.3125rem;
    block-size: 0.3125rem;
    border-radius: var(--cinder-radius-full);
    background: currentColor;
    opacity: 0.55;
    animation: cinder-chat-streaming-dot 1.2s ease-in-out infinite;
  }

  .chat-message-streaming-dot:nth-child(2) {
    animation-delay: 0.15s;
  }

  .chat-message-streaming-dot:nth-child(3) {
    animation-delay: 0.3s;
  }

  @keyframes cinder-chat-streaming-dot {
    0%,
    80%,
    100% {
      transform: translateY(0);
      opacity: 0.45;
    }
    40% {
      transform: translateY(-0.125rem);
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .message-content-streaming :global(.message-content-preview),
    .message-content-streaming .message-content-tail {
      color: var(--cinder-text-default);
      background: none;
      animation: none;
    }

    .chat-message-streaming-dot {
      animation: none;
      opacity: 0.75;
    }
  }

  @media (forced-colors: active) {
    .message-content-streaming :global(.message-content-preview),
    .message-content-streaming .message-content-tail {
      color: CanvasText;
      background: none;
      animation: none;
    }
  }
</style>
