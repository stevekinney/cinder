<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    trigger = '',
    children,
    open = $bindable(false),
    ontoggle,
  }: {
    trigger?: string;
    children?: Snippet;
    open?: boolean;
    ontoggle?: (open: boolean) => void;
  } = $props();
</script>

<div>
  <button
    type="button"
    aria-expanded={open}
    onclick={() => {
      open = !open;
      ontoggle?.(open);
    }}>{trigger}</button
  >
  {#if open && children !== undefined}{@render children()}{/if}
</div>
