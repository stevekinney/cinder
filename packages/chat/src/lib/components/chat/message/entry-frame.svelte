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

<div
  class={`chat-entry-frame${labelClass ? ` ${labelClass}` : ''}`}
  data-cinder-expanded={open ? '' : undefined}
>
  <button
    id={`${id}-header`}
    type="button"
    class={`chat-entry-frame__trigger${triggerClass ? ` ${triggerClass}` : ''}`}
    aria-label={`${open ? 'Collapse' : 'Expand'} ${label}`}
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
    <span class="chat-entry-frame__label">{label}</span>
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
