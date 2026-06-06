<script lang="ts">
  import type { Snippet } from 'svelte';

  let { children }: { children?: Snippet } = $props();
</script>

<span>
  {#if children !== undefined}
    {@render children()}
  {/if}
</span>
