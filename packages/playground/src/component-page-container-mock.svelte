<script lang="ts">
  import type { Snippet } from 'svelte';

  let { children }: { children?: Snippet } = $props();
</script>

<div>
  {#if children !== undefined}
    {@render children()}
  {/if}
</div>
