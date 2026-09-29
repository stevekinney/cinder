<script>
  import Card from './card.svelte';

  let { children, ...forwardedProps } = $props();
</script>

<Card {...forwardedProps}>{@render children?.()}</Card>
