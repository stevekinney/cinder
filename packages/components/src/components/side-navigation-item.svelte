<script lang="ts" module>
  import type { NavigationItemProps } from './navigation-item.svelte';

  /** Props for the SideNavigationItem component. Forwards all NavigationItem props to the inner item. */
  export type SideNavigationItemProps = NavigationItemProps & {
    /** Class merged onto the outer <li>. */
    listItemClass?: string;
  };
</script>

<script lang="ts">
  import { classNames } from '../utilities/class-names.ts';
  import NavigationItem from './navigation-item.svelte';

  let { listItemClass, ...navigationItemProps }: SideNavigationItemProps = $props();
</script>

<li class={classNames('cinder-side-navigation__item', listItemClass)}>
  <NavigationItem {...navigationItemProps} />
</li>
