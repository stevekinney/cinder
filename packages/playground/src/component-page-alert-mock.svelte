<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    children,
    icon,
    variant = 'info',
  }: { children?: Snippet; icon?: Snippet; variant?: string } = $props();
</script>

<div role="alert" data-variant={variant}>
  {#if icon !== undefined}{@render icon()}{/if}
  {#if children !== undefined}{@render children()}{/if}
</div>
