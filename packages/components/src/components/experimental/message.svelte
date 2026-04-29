<script lang="ts" module>
  import type { Snippet } from 'svelte';

  /**
   * EXPERIMENTAL — Message API may change between minor versions.
   *
   * Chat-style bubble with a role label and optional timestamp. Use to
   * compose AI agent transcripts, support-thread views, run streams.
   */
  export type MessageRole = 'user' | 'assistant' | 'system';

  export type MessageProps = {
    /** Role of the speaker — drives visual treatment. */
    role: MessageRole;
    /** Optional timestamp string rendered in the header. */
    time?: string;
    /** Optional speaker name override (defaults derived from role). */
    name?: string;
    /** Additional class names merged with `.cinder-message`. */
    class?: string;
    /** Message body content. */
    children: Snippet;
  };
</script>

<script lang="ts">
  import { cn } from '../../utilities/class-names.ts';

  let { role, time, name, class: className, children }: MessageProps = $props();

  const defaultNames: Record<MessageRole, string> = {
    user: 'You',
    assistant: 'Assistant',
    system: 'System',
  };

  const visibleName = $derived(name ?? defaultNames[role]);
</script>

<article class={cn('cinder-message', className)} data-cinder-role={role}>
  <header class="cinder-message__header">
    <span class="cinder-message__name">{visibleName}</span>
    {#if time}
      <time class="cinder-message__time" datetime={time}>{time}</time>
    {/if}
  </header>
  <div class="cinder-message__body">
    {@render children()}
  </div>
</article>
