<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status stable
   * @purpose Chat-style bubble that renders a role label, optional timestamp, and arbitrary body content for transcript or run-stream views.
   * @tag chat
   * @tag message
   * @tag conversation
   * @useWhen Composing a transcript of user, assistant, and system turns outside the full chat suite.
   * @useWhen Rendering AI agent runs, support threads, or audit logs where each entry has a speaker and a body.
   * @avoidWhen Building a complete conversation surface with composer and scroll affordances — reach for the chat suite instead.
   * @avoidWhen Communicating a single non-conversational notice — callout is more appropriate.
   * @related chat, callout
   */
  import type { MessageRole } from './message.types.ts';

  export type { MessageProps, MessageRole } from './message.types.ts';

  // Pure constant — hoisted to module scope so it is allocated once per module
  // evaluation rather than on every component instantiation.
  const defaultNames: Record<MessageRole, string> = {
    user: 'You',
    assistant: 'Assistant',
    system: 'System',
  };
</script>

<script lang="ts">
  import type { MessageProps } from './message.types.ts';
  import { cn } from '../../utilities/class-names.ts';

  let {
    role,
    datetime,
    timestamp,
    name,
    class: className,
    children,
    ...rest
  }: MessageProps = $props();

  const visibleName = $derived(name ?? defaultNames[role]);
</script>

<article {...rest} data-cinder-role={role} class={cn('cinder-message', className)}>
  <header class="cinder-message__header">
    <span class="cinder-message__name">{visibleName}</span>
    {#if datetime}
      <time class="cinder-message__time" {datetime}>{timestamp ?? datetime}</time>
    {/if}
  </header>
  <!-- children is required by MessageProps; optional-chain guards against dynamic
       JS consumers or future relaxation of the type contract. -->
  {#if children}
    <div class="cinder-message__body">
      {@render children()}
    </div>
  {/if}
</article>
