<script lang="ts" module>
  export const title = 'Basic navigation bar';
  export const description =
    'Brand, link and button navigation items, disabled state, and an action in the trailing slot.';
</script>

<script lang="ts">
  import { Button } from '@lostgradient/cinder/button';
  import { NavigationBar } from '@lostgradient/cinder/navigation-bar';
  import { NavigationItem } from '@lostgradient/cinder/navigation-item';
  let active = $state('home');
  let mobileMenuOpen = $state(false);
</script>

<NavigationBar bind:mobileMenuOpen menuTogglePlacement="before-brand">
  {#snippet brand()}
    <strong>Acme</strong>
  {/snippet}
  {#snippet menuToggle(attrs)}
    <button type="button" {...attrs} aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}>
      <span aria-hidden="true">☰</span>
    </button>
  {/snippet}
  {#snippet items({ variant })}
    <NavigationItem {variant} onclick={() => (active = 'home')} active={active === 'home'}>
      Home
    </NavigationItem>
    <NavigationItem {variant} onclick={() => (active = 'docs')} active={active === 'docs'}>
      Docs
    </NavigationItem>
    <NavigationItem {variant} href="#blog" active={active === 'blog'}>Blog</NavigationItem>
    <NavigationItem {variant} onclick={() => (active = 'billing')} disabled>Billing</NavigationItem>
  {/snippet}
  {#snippet actions()}
    <Button variant="primary" size="sm" label="Sign up" />
  {/snippet}
</NavigationBar>
