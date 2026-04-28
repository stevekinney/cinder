<script lang="ts" module>
  export const title = 'Basic navigation bar';
  export const description = 'Brand, nav items, and an action in the trailing slot.';
</script>

<script lang="ts">
  import { Button, NavigationBar, NavigationItem } from '../../../../src/index.ts';

  let active = $state('home');
</script>

<NavigationBar>
  {#snippet brand()}
    <strong style="font-size: 1.1rem;">Acme</strong>
  {/snippet}
  {#snippet items()}
    <NavigationItem onClick={() => (active = 'home')} active={active === 'home'}>
      Home
    </NavigationItem>
    <NavigationItem onClick={() => (active = 'docs')} active={active === 'docs'}>
      Docs
    </NavigationItem>
    <NavigationItem onClick={() => (active = 'blog')} active={active === 'blog'}>
      Blog
    </NavigationItem>
  {/snippet}
  {#snippet actions()}
    <Button variant="primary" size="sm" label="Sign up" />
  {/snippet}
</NavigationBar>
