<script lang="ts" module>
  export const title = 'Button navigation item';
  export const description = 'Renders a button element when onclick is provided instead of href.';
</script>

<script lang="ts">
  import { NavigationItem } from '../../../../components/src/index.ts';

  let active = $state('dashboard');
</script>

<nav style="display: flex; gap: 0.5rem;">
  <NavigationItem onclick={() => (active = 'dashboard')} active={active === 'dashboard'}>
    Dashboard
  </NavigationItem>
  <NavigationItem onclick={() => (active = 'settings')} active={active === 'settings'}>
    Settings
  </NavigationItem>
  <NavigationItem onclick={() => (active = 'billing')} active={active === 'billing'}>
    Billing
  </NavigationItem>
</nav>
