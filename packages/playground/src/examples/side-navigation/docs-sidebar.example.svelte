<script lang="ts" module>
  export const title = 'Docs sidebar';
  export const description =
    'Documentation sidebar with grouped navigation sections. The active item receives aria-current="page".' +
    ' Composed inside Sidebar so the column collapses to a drawer below the ~767px viewport breakpoint —' +
    ' resize your browser window to see the mobile drawer behavior.';
</script>

<script lang="ts">
  import { Button } from '@lostgradient/cinder/button';
  import { SideNavigation } from '@lostgradient/cinder/side-navigation';
  import { Sidebar } from '@lostgradient/cinder/sidebar';

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
    style="display: flex; min-height: 28rem; border: 1px solid var(--cinder-border); border-radius: 0.5rem; overflow: hidden;"
  >
    <Sidebar bind:collapsed label="Documentation">
      {#snippet brand()}
        <strong style="font-size: 0.875rem;">Cinder Docs</strong>
      {/snippet}

      {#snippet navigation()}
        <SideNavigation ariaLabel="Documentation sections">
          <SideNavigation.Group label="Getting Started">
            <SideNavigation.Item href="#introduction" active>Introduction</SideNavigation.Item>
            <SideNavigation.Item href="#installation">Installation</SideNavigation.Item>
            <SideNavigation.Item href="#quick-start">Quick start</SideNavigation.Item>
          </SideNavigation.Group>
          <SideNavigation.Group label="Components">
            <SideNavigation.Item href="#button">Button</SideNavigation.Item>
            <SideNavigation.Item href="#form-section">FormSection</SideNavigation.Item>
            <SideNavigation.Item href="#side-navigation">SideNavigation</SideNavigation.Item>
          </SideNavigation.Group>
          <SideNavigation.Group label="API Reference">
            <SideNavigation.Item href="#props">Props</SideNavigation.Item>
            <SideNavigation.Item href="#types">Types</SideNavigation.Item>
            <SideNavigation.Item href="#css-variables">CSS variables</SideNavigation.Item>
          </SideNavigation.Group>
        </SideNavigation>
      {/snippet}
    </Sidebar>

    <main style="flex: 1; padding: 1.5rem;">
      <p style="margin: 0; color: var(--cinder-text-muted); font-size: var(--cinder-text-sm);">
        Main content area. Resize the browser viewport below ~767px to see the navigation collapse
        into a mobile drawer.
      </p>
    </main>
  </div>
</div>
