<script lang="ts" module>
  import type { ChatSubSessionProps } from './chat-sub-session.types.ts';
  export type { ChatSubSessionProps };
</script>

<script lang="ts">
  import { getMessages, pairToolCallsWithResults } from './utilities/index.ts';
  import ChatMessage from './message/chat-message.svelte';

  let {
    conversation,
    live = false,
    label = 'Nested session transcript',
    row,
  }: ChatSubSessionProps = $props();
  const messages = $derived(getMessages(conversation));
  const toolCallPairs = $derived(pairToolCallsWithResults(messages));
  const toolCallPairsByCallId = $derived.by(() => {
    const pairsByCallId = new Map<string, typeof toolCallPairs>();
    for (const pair of toolCallPairs) {
      const pairs = pairsByCallId.get(pair.call.id);
      if (pairs) pairs.push(pair);
      else pairsByCallId.set(pair.call.id, [pair]);
    }
    return pairsByCallId;
  });
  const pairedToolResults = $derived(
    new Set(toolCallPairs.flatMap((pair) => (pair.result ? [pair.result] : []))),
  );
</script>

<section class="chat-sub-session" class:chat-sub-session-live={live}>
  <div
    class="chat-sub-session-viewport"
    role="log"
    aria-label={label}
    aria-live={live ? 'polite' : 'off'}
  >
    {#each messages as message (message.id)}
      {#if row}
        {@render row(message)}
      {:else if message.role !== 'tool-result' || !message.toolResult || !pairedToolResults.has(message.toolResult)}
        <ChatMessage
          {message}
          toolCallPairs={message.toolCall
            ? (toolCallPairsByCallId.get(message.toolCall.id) ?? [])
            : []}
          showDefaultActions={false}
          tabindex={-1}
        />
      {/if}
    {/each}
  </div>
</section>

<style>
  .chat-sub-session {
    --cinder-chat-font-size: 0.8125rem;
    max-block-size: 7.75rem;
    overflow: hidden;
    position: relative;
    font-size: var(--_cinder-chat-text-base, 0.8125rem);
    border-inline-start: 2px solid var(--cinder-border-muted);
    background: var(--cinder-surface-inset);
  }

  .chat-sub-session-viewport {
    max-block-size: inherit;
    overflow: auto;
    padding: var(--cinder-space-2) var(--cinder-space-3);
  }

  .chat-sub-session-live :global(.chat-message) {
    animation: chat-sub-session-live 1.2s ease-in-out infinite alternate;
  }

  @media (prefers-reduced-motion: reduce) {
    .chat-sub-session-live :global(.chat-message) {
      animation: none;
    }
  }

  @keyframes chat-sub-session-live {
    from {
      opacity: 0.8;
    }
    to {
      opacity: 1;
    }
  }
</style>
