<script lang="ts">
  import type { Snippet } from 'svelte';

  let { children }: { children?: Snippet } = $props();
</script>

<tr>
  {#if children !== undefined}
    {@render children()}
  {/if}
</tr>
