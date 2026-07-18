<script lang="ts" module>
  import type { HTMLAttributes } from 'svelte/elements';

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

  // Whether truncation is active (used by parent to show ellipsis indicator)
  const isTruncated = $derived(!streaming && !expanded && effectiveContent.length > threshold);
</script>

<div
  class={classNames('message-content', streaming && 'message-content-streaming', className)}
  {...rest}
>
  {#if displayContent}
    <MarkdownPreview content={displayContent} />
  {/if}
  {#if streaming && streamingTail}
    <span class="message-content-tail">{streamingTail}</span>
  {/if}
  {#if streaming}
    <span class="message-content-cursor" aria-hidden="true"></span>
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
    font-size: var(--cinder-text-sm);
  }

  /* Streaming tail: raw text that hasn't been through markdown rendering yet */
  .message-content-tail {
    white-space: pre-wrap;
    word-break: break-word;
  }

  /* Blinking cursor during streaming */
  .message-content-cursor {
    display: inline-block;
    width: 2px;
    height: 1.1em;
    background: var(--cinder-text);
    vertical-align: text-bottom;
    margin-inline-start: 1px;
    animation: cursor-blink 1s step-end infinite;
  }

  @keyframes cursor-blink {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .message-content-cursor {
      animation: none;
      opacity: 1;
    }
  }
</style>
