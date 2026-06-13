<script lang="ts">
  import type { Snippet } from 'svelte';

  let { children, text = '' }: { children?: Snippet; text?: string } = $props();
</script>

<span data-tooltip={text}
  >{#if children !== undefined}{@render children()}{/if}</span
>
