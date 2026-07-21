<script lang="ts" module>
  export const title = 'App-owned mobile trigger';
  export const description =
    'Use the exported Sidebar mobile media query when a top bar owns the drawer trigger outside the Sidebar.';
</script>

<script lang="ts">
  import { Button } from '@lostgradient/cinder/button';
  import { NavigationItem } from '@lostgradient/cinder/navigation-item';
  import { SideNavigation } from '@lostgradient/cinder/side-navigation';
  import { SideNavigationItem } from '@lostgradient/cinder/side-navigation-item';
  import { SIDEBAR_MOBILE_MEDIA_QUERY, Sidebar } from '@lostgradient/cinder/sidebar';
  import { MediaQuery } from 'svelte/reactivity';

  let { mountIdPrefix }: { mountIdPrefix?: string } = $props();

  const uid = $props.id();
  const mobile = new MediaQuery(SIDEBAR_MOBILE_MEDIA_QUERY, false);
  const sidebarId = $derived(`${mountIdPrefix ?? uid}-workspace-sidebar`);
  let collapsed = $state(true);

  const triggerLabel = $derived(
    mobile.current
      ? collapsed
        ? 'Open workspace navigation'
        : 'Close workspace navigation'
      : collapsed
        ? 'Expand workspace navigation'
        : 'Collapse workspace navigation',
  );
</script>

<div
  style="display: flex; min-height: 24rem; border: 1px solid #e5e7eb; border-radius: 0.5rem; overflow: hidden;"
>
  <Sidebar id={sidebarId} bind:collapsed label="Workspace">
    {#snippet navigation()}
      <SideNavigation ariaLabel="Workspace sections">
        <SideNavigationItem href="#dashboard">Dashboard</SideNavigationItem>
        <SideNavigationItem href="#projects" active>Projects</SideNavigationItem>
        <SideNavigationItem href="#settings">Settings</SideNavigationItem>
      </SideNavigation>
    {/snippet}

    {#snippet footer()}
      <NavigationItem variant="vertical" href="#account">Account</NavigationItem>
    {/snippet}
  </Sidebar>

  <main style="flex: 1; display: flex; flex-direction: column; min-inline-size: 0;">
    <div
      style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; border-bottom: 1px solid #e5e7eb;"
    >
      <Button
        label={triggerLabel}
        aria-controls={sidebarId}
        aria-expanded={!collapsed}
        onclick={() => (collapsed = !collapsed)}
      />
      <strong>Workspace</strong>
    </div>

    <div style="padding: 1rem;">
      <p style="margin: 0;">
        The trigger lives in app chrome, while Sidebar owns the drawer state and breakpoint.
      </p>
    </div>
  </main>
</div>
