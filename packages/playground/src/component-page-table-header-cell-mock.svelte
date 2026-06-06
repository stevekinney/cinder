<script lang="ts">
  import type { Snippet } from 'svelte';

  let { children }: { children?: Snippet } = $props();
</script>

<th>
  {#if children !== undefined}
    {@render children()}
  {/if}
</th>
