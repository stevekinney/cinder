<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status alpha
   * @purpose Chat-style bubble that renders a role label, optional timestamp, and arbitrary body content for transcript or run-stream views.
   * @tag chat
   * @tag message
   * @tag conversation
   * @useWhen Composing a transcript of user, assistant, and system turns outside the full chat suite.
   * @useWhen Rendering AI agent runs, support threads, or audit logs where each entry has a speaker and a body.
   * @avoidWhen Building a complete conversation surface with composer and scroll affordances — reach for the chat suite instead.
   * @avoidWhen Communicating a single non-conversational notice — callout is more appropriate.
   * @avoidWhen Production-critical surfaces — this component is alpha and may change or be removed before promotion to beta.
   * @related chat, callout
   */
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
