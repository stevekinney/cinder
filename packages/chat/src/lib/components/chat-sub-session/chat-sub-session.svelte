<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status stable
   * @purpose Renders a reduced nested conversation transcript inside a parent chat turn.
   * @tag chat
   * @tag transcript
   * @useWhen A tool or delegated session needs to expose its child transcript inline.
   * @avoidWhen The child conversation should be a separate full-size Chat surface.
   * @related chat
   */
  import type { ChatSubSessionProps } from './chat-sub-session.types.ts';
  export type { ChatSubSessionProps };
</script>

<script lang="ts">
  import { getMessages, pairToolCallsWithResults } from '../chat/utilities/index.ts';
  import ChatMessage from '../chat/message/chat-message.svelte';

  let {
    conversation,
    live = false,
    label = 'Nested session transcript',
    row,
  }: ChatSubSessionProps = $props();
  const messages = $derived(getMessages(conversation));
  const instanceId = $props.id();
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
    {#each messages as message (`${instanceId}:${message.id}`)}
      {#if row}
        {@render row(message)}
      {:else if message.role !== 'tool-result' || !message.toolResult || !pairedToolResults.has(message.toolResult)}
        <ChatMessage
          {message}
          id={`${instanceId}-${message.id}`}
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
