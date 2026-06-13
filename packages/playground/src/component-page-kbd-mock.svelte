<script lang="ts">
  import type { Snippet } from 'svelte';

  let { label = '', children }: { label?: string; children?: Snippet } = $props();
</script>

<kbd
  >{#if children !== undefined}{@render children()}{:else}{label}{/if}</kbd
>
