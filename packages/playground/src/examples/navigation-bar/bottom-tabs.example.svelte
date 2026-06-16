<script lang="ts" module>
  export const title = 'Bottom mobile tabs';
  export const description =
    'NavigationBar can render a bottom tab-bar composition while links keep aria-current semantics.';
</script>

<script lang="ts">
  import { NavigationBar } from '@lostgradient/cinder/navigation-bar';
  import { NavigationItem } from '@lostgradient/cinder/navigation-item';

  let active = $state('home');
</script>

<div style="max-width: 28rem; border: 1px solid var(--cinder-border-muted);">
  <main style="min-height: 10rem; padding: var(--cinder-space-4);">
    <strong>{active}</strong>
  </main>
  <NavigationBar placement="bottom" showLabels="active" navAriaLabel="Mobile primary navigation">
    {#snippet items({ variant })}
      <NavigationItem {variant} onclick={() => (active = 'home')} active={active === 'home'}>
        <span aria-hidden="true">H</span>
        <span data-cinder-navigation-label>Home</span>
      </NavigationItem>
      <NavigationItem {variant} onclick={() => (active = 'search')} active={active === 'search'}>
        <span aria-hidden="true">S</span>
        <span data-cinder-navigation-label>Search</span>
      </NavigationItem>
      <NavigationItem
        {variant}
        onclick={() => (active = 'settings')}
        active={active === 'settings'}
      >
        <span aria-hidden="true">G</span>
        <span data-cinder-navigation-label>Settings</span>
      </NavigationItem>
    {/snippet}
  </NavigationBar>
</div>
