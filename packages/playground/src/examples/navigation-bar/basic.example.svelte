<script lang="ts" module>
  export const title = 'Basic navigation bar';
  export const description = 'Brand, nav items, and an action in the trailing slot.';
</script>

<script lang="ts">
  import { Button, NavigationBar, NavigationItem } from '../../../../components/src/index.ts';

  let active = $state('home');
  let mobileMenuOpen = $state(false);
</script>

<NavigationBar bind:mobileMenuOpen>
  {#snippet brand()}
    <strong>Acme</strong>
  {/snippet}
  {#snippet menuToggle(attrs)}
    <button type="button" {...attrs} aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}>
      ☰
    </button>
  {/snippet}
  {#snippet items({ variant })}
    <NavigationItem {variant} onclick={() => (active = 'home')} active={active === 'home'}>
      Home
    </NavigationItem>
    <NavigationItem {variant} onclick={() => (active = 'docs')} active={active === 'docs'}>
      Docs
    </NavigationItem>
    <NavigationItem {variant} onclick={() => (active = 'blog')} active={active === 'blog'}>
      Blog
    </NavigationItem>
  {/snippet}
  {#snippet actions()}
    <Button variant="primary" size="sm" label="Sign up" />
  {/snippet}
</NavigationBar>
