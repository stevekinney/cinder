<script>
  import NavigationItem from './navigation-item.svelte';

  let { mode } = $props();
</script>

{#if mode === 'link-aria-current'}
  <NavigationItem href="/home" active aria-current="location">Link</NavigationItem>
{:else if mode === 'button-aria-current'}
  <NavigationItem onclick={() => {}} active aria-current="location">Button</NavigationItem>
{:else if mode === 'undefined-href'}
  <NavigationItem href={undefined}>Undefined href</NavigationItem>
{:else if mode === 'button-type'}
  <NavigationItem onclick={() => {}} type="submit">Button</NavigationItem>
{/if}
