<script lang="ts" module>
  export const title = 'Button navigation item';
  export const description = 'Renders a button element when onClick is provided instead of href.';
</script>

<script lang="ts">
  import { NavigationItem } from '../../../../components/src/index.ts';

  let active = $state('dashboard');
</script>

<nav style="display: flex; gap: 0.5rem;">
  <NavigationItem onClick={() => (active = 'dashboard')} active={active === 'dashboard'}>
    Dashboard
  </NavigationItem>
  <NavigationItem onClick={() => (active = 'settings')} active={active === 'settings'}>
    Settings
  </NavigationItem>
  <NavigationItem onClick={() => (active = 'billing')} active={active === 'billing'}>
    Billing
  </NavigationItem>
</nav>
