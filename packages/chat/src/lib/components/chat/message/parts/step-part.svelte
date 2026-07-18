<script lang="ts" module>
  import type { StepMessagePart } from '../../utilities/types.ts';

  export type StepPartProps = {
    /** The step render part to display. */
    part: StepMessagePart;
  };
</script>

<script lang="ts">
  let { part }: StepPartProps = $props();

  // Map status to icon shape — shape carries meaning independently of color.
  // Aria-hidden icons; status is also communicated as visually-hidden text.
  const statusIcon: Record<StepMessagePart['status'], string> = {
    pending: '○',
    running: '◉',
    done: '●',
    error: '✕',
  };

  const statusLabel: Record<StepMessagePart['status'], string> = {
    pending: 'pending',
    running: 'in progress',
    done: 'complete',
    error: 'failed',
  };
</script>

<!--
  A single step in an ordered stepper. `aria-current="step"` marks the active
  (running) step. Status is communicated via an aria-hidden icon whose SHAPE
  (not just color) carries meaning, plus a visually-hidden status suffix.
-->
<li
  class="chat-step"
  data-cinder-step-status={part.status}
  aria-current={part.status === 'running' ? 'step' : undefined}
>
  <span class="chat-step-indicator" aria-hidden="true">
    {statusIcon[part.status]}
  </span>
  <span class="chat-step-body">
    <span class="chat-step-title">
      {part.title}
      <span class="sr-only"> — {statusLabel[part.status]}</span>
    </span>
    {#if part.content}
      <span class="chat-step-content">{part.content}</span>
    {/if}
  </span>
</li>

<style>
  .chat-step {
    --cinder-chat-step-indicator-color: var(--cinder-text-muted);
    --cinder-chat-step-indicator-color-running: var(--cinder-color-info-fg, var(--cinder-text));
    --cinder-chat-step-indicator-color-done: var(
      --cinder-color-success-fg,
      var(--cinder-text-muted)
    );
    --cinder-chat-step-indicator-color-error: var(
      --cinder-color-danger-fg,
      var(--cinder-text-muted)
    );

    display: flex;
    align-items: flex-start;
    gap: var(--cinder-space-2);
    padding-block: var(--cinder-space-1);
    list-style: none;
  }

  .chat-step-indicator {
    flex-shrink: 0;
    font-size: var(--cinder-text-sm);
    line-height: 1.5;
    color: var(--cinder-chat-step-indicator-color);
  }

  [data-cinder-step-status='running'] .chat-step-indicator {
    color: var(--cinder-chat-step-indicator-color-running);
  }

  [data-cinder-step-status='done'] .chat-step-indicator {
    color: var(--cinder-chat-step-indicator-color-done);
  }

  [data-cinder-step-status='error'] .chat-step-indicator {
    color: var(--cinder-chat-step-indicator-color-error);
  }

  .chat-step-body {
    display: flex;
    flex-direction: column;
    gap: var(--cinder-space-1);
    flex: 1;
    min-inline-size: 0;
  }

  .chat-step-title {
    font-size: var(--cinder-text-sm);
    font-weight: var(--cinder-font-medium);
    color: var(--cinder-text);
    line-height: 1.5;
  }

  [data-cinder-step-status='done'] .chat-step-title {
    color: var(--cinder-text-muted);
  }

  [data-cinder-step-status='error'] .chat-step-title {
    color: var(--cinder-color-danger-fg, var(--cinder-text));
  }

  .chat-step-content {
    font-size: var(--cinder-text-xs);
    color: var(--cinder-text-muted);
    line-height: var(--cinder-leading-normal, 1.5);
  }

  /* Screen reader only */
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
