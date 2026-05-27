<script lang="ts">
  import SideNavigationGroup from './side-navigation-group.svelte';
  import SideNavigationItem from '../side-navigation-item/side-navigation-item.svelte';

  // Test-only harness: renders real SideNavigationItem children inside a
  // SideNavigationGroup so the Svelte context bridge under test is exercised.
  // Each item's active state is driven by props so tests can rerender to
  // toggle them.
  let {
    firstActive = false,
    secondActive = false,
    showSecond = true,
    nestedActive = false,
    showNested = false,
  }: {
    firstActive?: boolean;
    secondActive?: boolean;
    showSecond?: boolean;
    nestedActive?: boolean;
    showNested?: boolean;
  } = $props();
</script>

<ul>
  <SideNavigationGroup label="Settings">
    <SideNavigationItem href="/one" active={firstActive}>One</SideNavigationItem>
    {#if showSecond}
      <SideNavigationItem href="/two" active={secondActive}>Two</SideNavigationItem>
    {/if}
    {#if showNested}
      <SideNavigationGroup label="Nested">
        <SideNavigationItem href="/nested" active={nestedActive}>Nested</SideNavigationItem>
      </SideNavigationGroup>
    {/if}
  </SideNavigationGroup>
</ul>
