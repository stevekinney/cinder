<script lang="ts" module>
  export const title = 'Basic sidebar';
  export const description =
    'Layout-level sidebar with brand, navigation, and footer regions. Collapse toggles icon-only mode on desktop and closes the drawer on mobile.';
</script>

<script lang="ts">
  import { Button } from 'cinder/button';
  import { NavigationItem } from 'cinder/navigation-item';
  import { SideNavigation } from 'cinder/side-navigation';
  import { SideNavigationGroup } from 'cinder/side-navigation-group';
  import { SideNavigationItem } from 'cinder/side-navigation-item';
  import { Sidebar } from 'cinder/sidebar';
  let collapsed = $state(false);
</script>

<div style="display: flex; flex-direction: column; gap: 1rem;">
  <div>
    <Button
      label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      onclick={() => (collapsed = !collapsed)}
    />
  </div>

  <div
    style="display: flex; min-height: 24rem; border: 1px solid #e5e7eb; border-radius: 0.5rem; overflow: hidden;"
  >
    <Sidebar bind:collapsed ariaLabel="Workspace">
      {#snippet brand()}
        <strong style="font-size: 0.875rem;">Cinder</strong>
      {/snippet}

      {#snippet navigation()}
        <SideNavigation ariaLabel="Workspace sections">
          {#snippet children()}
            <SideNavigationItem href="#dashboard">
              {#snippet children()}Dashboard{/snippet}
            </SideNavigationItem>
            <SideNavigationItem href="#projects" active>
              {#snippet children()}Projects{/snippet}
            </SideNavigationItem>
            <SideNavigationGroup label="Settings">
              {#snippet children()}
                <SideNavigationItem href="#general">
                  {#snippet children()}General{/snippet}
                </SideNavigationItem>
                <SideNavigationItem href="#billing">
                  {#snippet children()}Billing{/snippet}
                </SideNavigationItem>
              {/snippet}
            </SideNavigationGroup>
          {/snippet}
        </SideNavigation>
      {/snippet}

      {#snippet footer()}
        <NavigationItem href="#account">
          {#snippet children()}Account{/snippet}
        </NavigationItem>
      {/snippet}
    </Sidebar>

    <main style="flex: 1; padding: 1rem;">
      <p>Main content area.</p>
      <p>Resize the viewport below ~767px to see the mobile drawer behavior.</p>
    </main>
  </div>
</div>
