<script lang="ts">
  import SideNavigation from '@lostgradient/cinder/side-navigation';
  import SideNavigationItem from '@lostgradient/cinder/side-navigation-item';
  import Sidebar from '@lostgradient/cinder/sidebar';

  let hydrated = $state(false);

  $effect(() => {
    hydrated = true;
  });
</script>

<main data-dev-ssr-hydrated={hydrated}>
  <Sidebar label="Project navigation">
    {#snippet navigation()}
      <SideNavigation ariaLabel="Workflow selection" data-dev-ssr-sidebar-navigation>
        <SideNavigationItem href="/dev-ssr-navigation" active={true}>
          <span data-dev-ssr-side-navigation-item>basicOrderWorkflow</span>
        </SideNavigationItem>
      </SideNavigation>
    {/snippet}
  </Sidebar>
</main>
