<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    title,
    description,
    children,
  }: { title?: string; description?: string; children?: Snippet } = $props();
</script>

<section>
  {#if title !== undefined}
    <h3>{title}</h3>
  {/if}
  {#if description !== undefined}
    <p>{description}</p>
  {/if}
  {#if children !== undefined}
    {@render children()}
  {/if}
</section>
