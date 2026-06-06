<script lang="ts">
  import type { Snippet } from 'svelte';

  let { children }: { children?: Snippet } = $props();
</script>

<thead>
  {#if children !== undefined}
    {@render children()}
  {/if}
</thead>
