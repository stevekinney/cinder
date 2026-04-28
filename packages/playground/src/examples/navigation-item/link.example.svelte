<script lang="ts" module>
  export const title = 'Link navigation item';
  export const description = 'Renders an anchor element; active item shows aria-current="page".';
</script>

<script lang="ts">
  import { NavigationItem } from '../../../../components/src/index.ts';
</script>

<nav style="display: flex; gap: 0.5rem;">
  <NavigationItem href="/home" active>Home</NavigationItem>
  <NavigationItem href="/about">About</NavigationItem>
  <NavigationItem href="/contact" disabled>Contact (coming soon)</NavigationItem>
</nav>
