<script lang="ts">
  import Button from '../button/button.svelte';
  import type { Snippet } from 'svelte';
  let {
    expanded = false,
    controls,
    children,
  }: { expanded?: boolean; controls: string; children: Snippet } = $props();
</script>

<Button variant="ghost" aria-expanded={expanded} aria-controls={controls}
  >{@render children()}</Button
>
