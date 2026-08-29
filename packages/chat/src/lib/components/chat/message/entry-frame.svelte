<script lang="ts">
  import type { Snippet } from 'svelte';
  import { ChevronDown } from 'lucide-svelte';

  let {
    id,
    label,
    labelClass,
    status,
    triggerClass,
    busy = false,
    open = $bindable(false),
    disabled = false,
    onToggle,
    children,
  }: {
    id: string;
    label: string;
    labelClass?: string | undefined;
    status?: string | undefined;
    triggerClass?: string | undefined;
    busy?: boolean;
    open?: boolean;
    disabled?: boolean;
    onToggle?: ((open: boolean) => void) | undefined;
    children: Snippet;
  } = $props();
</script>

<div class="chat-entry-frame" data-cinder-expanded={open ? '' : undefined}>
  <button
    id={`${id}-header`}
    type="button"
    class={`chat-entry-frame__trigger${triggerClass ? ` ${triggerClass}` : ''}`}
    aria-label={`${open ? 'Collapse' : 'Expand'} ${label}${status ? `, ${status}` : busy ? ', In progress' : ''}`}
    aria-expanded={open}
    aria-controls={open ? `${id}-panel` : undefined}
    {disabled}
    onclick={() => {
      const nextOpen = !open;
      open = nextOpen;
      onToggle?.(nextOpen);
    }}
  >
    {#if busy}<span class="chat-entry-frame__busy" aria-hidden="true"></span>{/if}
    <span class={`chat-entry-frame__label${labelClass ? ` ${labelClass}` : ''}`}>{label}</span>
    {#if status}<span class="chat-entry-frame__status">{status}</span>{/if}
    <ChevronDown class="chat-entry-frame__chevron" aria-hidden="true" />
  </button>
  {#if open}
    <div
      id={`${id}-panel`}
      role="region"
      aria-labelledby={`${id}-header`}
      class="chat-entry-frame__panel"
    >
      <div class="chat-entry-frame__panel-inner">{@render children()}</div>
    </div>
  {/if}
</div>

<style>
  .chat-entry-frame {
    inline-size: 100%;
    overflow: hidden;
    border: 1px solid var(--_chat-entry-frame-border-color, var(--cinder-border-muted));
    border-radius: var(--cinder-radius-md);
    background: var(--cinder-surface);
  }

  .chat-entry-frame__trigger {
    display: flex;
    align-items: center;
    inline-size: 100%;
    min-block-size: var(--cinder-touch-target-min);
    padding: var(--cinder-space-2) var(--cinder-space-3);
    border: 0;
    background: transparent;
    color: inherit;
    text-align: start;
    cursor: pointer;
  }

  .chat-entry-frame__label {
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--_cinder-chat-text-sm, var(--cinder-text-sm));
    font-weight: var(--cinder-font-medium);
  }

  .chat-entry-frame__status {
    margin-inline-start: auto;
    color: var(--cinder-text-subtle);
    font-size: var(--_cinder-chat-text-xs, var(--cinder-text-xs));
  }

  .chat-entry-frame__busy {
    display: inline-block;
    flex: 0 0 auto;
    inline-size: 0.5rem;
    block-size: 0.5rem;
    margin-inline-end: var(--cinder-space-2);
    border-radius: 50%;
    background: var(--cinder-border);
  }

  .chat-entry-frame__chevron {
    inline-size: 1rem;
    block-size: 1rem;
    margin-inline-start: var(--cinder-space-2);
    transition: transform var(--cinder-duration-fast) var(--cinder-ease-out);
  }

  .chat-entry-frame[data-cinder-expanded] .chat-entry-frame__chevron {
    transform: rotate(180deg);
  }

  .chat-entry-frame__panel-inner {
    max-block-size: 16rem;
    overflow: auto;
    padding: var(--cinder-space-3);
    border-block-start: 1px solid var(--cinder-border-muted);
  }
</style>
