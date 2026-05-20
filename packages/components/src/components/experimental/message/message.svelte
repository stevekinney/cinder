<script lang="ts" module>
  export type { MessageProps, MessageRole } from './message.types.ts';
</script>

<script lang="ts">
  import type { MessageProps, MessageRole } from './message.types.ts';
  import { cn } from '../../../utilities/class-names.ts';

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
