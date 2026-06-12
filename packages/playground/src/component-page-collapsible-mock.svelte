<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    trigger = '',
    children,
    open = false,
    onToggle,
  }: {
    trigger?: string;
    children?: Snippet;
    open?: boolean;
    onToggle?: (open: boolean) => void;
  } = $props();
</script>

<div>
  <button
    type="button"
    aria-expanded={open}
    onclick={() => {
      open = !open;
      onToggle?.(open);
    }}>{trigger}</button
  >
  {#if open && children !== undefined}{@render children()}{/if}
</div>
