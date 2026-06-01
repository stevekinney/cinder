<script lang="ts">
  import NavigationItem from './navigation-item.svelte';

  type FixtureProps = {
    active?: boolean;
  };

  let { active = false }: FixtureProps = $props();
</script>

<nav aria-label="Fixture navigation" class="navigation-item-fixture">
  <NavigationItem href="/dashboard" {active}>Dashboard</NavigationItem>
  <NavigationItem href="/activity">Activity</NavigationItem>
</nav>

<style>
  .navigation-item-fixture {
    display: flex;
    gap: 0.5rem;
  }
</style>
