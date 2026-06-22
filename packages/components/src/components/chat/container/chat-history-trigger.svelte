<script lang="ts" module>
  export type ChatHistoryTriggerProps = {
    /** Whether the history request is in flight. */
    loading?: boolean;
    /** Button label while idle. */
    label?: string;
    /** Button label while loading. */
    loadingLabel?: string;
    /** Called when the user requests older messages. */
    onload?: () => void;
  };
</script>

<script lang="ts">
  import type { Attachment } from 'svelte/attachments';

  let {
    loading = false,
    label = 'Load earlier messages',
    loadingLabel = 'Loading earlier messages',
    onload,
  }: ChatHistoryTriggerProps = $props();

  let buttonElement: HTMLButtonElement | null = null;

  const buttonAttachment: Attachment<HTMLButtonElement> = (node) => {
    buttonElement = node;

    return () => {
      if (buttonElement === node) {
        buttonElement = null;
      }
    };
  };

  export function focus(options?: FocusOptions): void {
    buttonElement?.focus(options);
  }
</script>

<div class="chat-history-trigger" data-cinder-history-trigger>
  <button
    {@attach buttonAttachment}
    type="button"
    class="chat-history-trigger-button"
    disabled={loading}
    aria-busy={loading ? 'true' : undefined}
    onclick={() => onload?.()}
  >
    {loading ? loadingLabel : label}
  </button>
  {#if loading}
    <span class="sr-only" role="status">{loadingLabel}</span>
  {/if}
</div>

<style>
  .chat-history-trigger {
    display: flex;
    justify-content: center;
    padding-block: var(--cinder-space-2);
  }

  .chat-history-trigger-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 2.25rem;
    padding: var(--cinder-space-1-5) var(--cinder-space-3);
    font-size: var(--cinder-text-sm);
    font-weight: var(--cinder-font-medium);
    color: var(--cinder-text);
    background: var(--cinder-surface-raised);
    border: 1px solid var(--cinder-border);
    border-radius: var(--cinder-radius-md);
    cursor: pointer;
  }

  .chat-history-trigger-button:disabled {
    cursor: progress;
    opacity: 0.7;
  }

  @media (hover: hover) {
    .chat-history-trigger-button:not(:disabled):hover {
      background: var(--cinder-surface-hover);
      border-color: var(--cinder-accent);
    }
  }

  .chat-history-trigger-button:focus-visible {
    outline: var(--cinder-ring-width) solid transparent;
    box-shadow: var(--_cinder-focus-ring-shadow);
  }

  @media (forced-colors: active) {
    .chat-history-trigger-button:focus-visible {
      outline: var(--cinder-ring-width) solid ButtonText;
      outline-offset: 3px;
      box-shadow: none;
    }
  }

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
