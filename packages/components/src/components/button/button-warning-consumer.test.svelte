<script>
  import Button from './button.svelte';

  let { mode, label = '' } = $props();
</script>

{#if mode === 'icon-aria-label'}
  <Button iconOnly aria-label="Close" />
{:else if mode === 'icon-label'}
  <Button iconOnly label="Close" />
{:else if mode === 'unnamed-icon'}
  <Button iconOnly />
{:else if mode === 'aria-label-only'}
  <Button aria-label="Close" />
{:else if mode === 'changing-label'}
  <Button iconOnly {label}><svg aria-hidden="true"></svg></Button>
{/if}
