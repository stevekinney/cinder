<script lang="ts">
  import type { Snippet } from 'svelte';
  import Collapsible from '@lostgradient/cinder/collapsible';

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
    leadingIcon,
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
    leadingIcon?: Snippet | undefined;
  } = $props();
</script>

<div class="chat-entry-frame-shell">
  <Collapsible
    bind:open
    trigger={label}
    {leadingIcon}
    idBase={id}
    class="chat-entry-frame"
    animated={false}
    triggerClass={`chat-entry-frame__trigger${triggerClass ? ` ${triggerClass}` : ''}`}
    labelClass={labelClass ?? ''}
    triggerAriaLabel={({ open: currentOpen }) =>
      `${currentOpen ? 'Collapse' : 'Expand'} ${label}${status ? `, ${status}` : busy ? ', In progress' : ''}`}
    {disabled}
    onToggle={(nextOpen) => onToggle?.(nextOpen)}
  >
    {@render children()}
  </Collapsible>
  {#if busy}<span class="chat-entry-frame__busy" aria-hidden="true"></span>{/if}
  {#if status}<span class="chat-entry-frame__status" aria-hidden="true">{status}</span>{/if}
</div>

<style>
  .chat-entry-frame-shell {
    position: relative;
  }

  .chat-entry-frame-shell :global(.chat-entry-frame) {
    inline-size: 100%;
    overflow: hidden;
    border: 1px solid var(--_chat-entry-frame-border-color, var(--cinder-border-muted));
    border-radius: var(--cinder-radius-md);
    background: var(--cinder-surface);
  }

  .chat-entry-frame-shell :global(.chat-entry-frame__trigger) {
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

  .chat-entry-frame-shell :global(.cinder-collapsible__label) {
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--_cinder-chat-text-sm, var(--cinder-text-sm));
    font-weight: var(--cinder-font-medium);
  }

  .chat-entry-frame__status {
    position: absolute;
    inset-block-start: calc(var(--cinder-touch-target-min) / 2);
    inset-inline-end: 2.5rem;
    transform: translateY(-50%);
    color: var(--cinder-text-subtle);
    font-size: var(--_cinder-chat-text-xs, var(--cinder-text-xs));
    pointer-events: none;
  }

  .chat-entry-frame__busy {
    position: absolute;
    inset-block-start: calc(var(--cinder-touch-target-min) / 2);
    inset-inline-start: var(--cinder-space-3);
    transform: translateY(-50%);
    display: inline-block;
    inline-size: 0.5rem;
    block-size: 0.5rem;
    border-radius: 50%;
    background: var(--cinder-border);
    pointer-events: none;
  }

  .chat-entry-frame-shell:has(.chat-entry-frame__busy) :global(.chat-entry-frame__trigger) {
    padding-inline-start: calc(var(--cinder-space-3) + 1rem);
  }

  .chat-entry-frame-shell:has(.chat-entry-frame__status) :global(.cinder-collapsible__label) {
    padding-inline-end: 6rem;
  }

  .chat-entry-frame-shell :global(.cinder-collapsible__chevron) {
    inline-size: 1rem;
    block-size: 1rem;
    margin-inline-start: var(--cinder-space-2);
    transition: transform var(--cinder-duration-fast) var(--cinder-ease-standard);
  }

  .chat-entry-frame-shell :global(.cinder-collapsible__panel-inner) {
    max-block-size: 16rem;
    overflow: auto;
    padding: var(--cinder-space-3);
    border-block-start: 1px solid var(--cinder-border-muted);
  }
</style>
