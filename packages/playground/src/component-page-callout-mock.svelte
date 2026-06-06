<script lang="ts">
  import type { Snippet } from 'svelte';

  let { title, children }: { title?: string; children?: Snippet } = $props();
</script>

<section role="alert">
  {#if title !== undefined}
    <h3>{title}</h3>
  {/if}
  {#if children !== undefined}
    {@render children()}
  {/if}
</section>
