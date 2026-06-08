<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    children,
    variant = 'neutral',
    size = 'md',
  }: { children?: Snippet; variant?: string; size?: string } = $props();
</script>

<span data-variant={variant} data-size={size}>
  {#if children !== undefined}
    {@render children()}
  {/if}
</span>
