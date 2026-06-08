<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    children,
    onclick,
    'aria-label': ariaLabel,
  }: { children?: Snippet; onclick?: () => void; 'aria-label'?: string } = $props();
</script>

<button type="button" aria-label={ariaLabel} {onclick}>
  {#if children !== undefined}
    {@render children()}
  {/if}
</button>
