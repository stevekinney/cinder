<script>
  import ButtonGroup from './button-group.svelte';

  let { children, ...forwardedProps } = $props();
</script>

<ButtonGroup {...forwardedProps}>{@render children?.()}</ButtonGroup>
