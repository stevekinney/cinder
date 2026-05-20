<script lang="ts" module>
  export type { SideNavigationItemProps } from './side-navigation-item.types.ts';
</script>

<script lang="ts">
  import type { SideNavigationItemProps } from './side-navigation-item.types.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import NavigationItem from '../navigation-item/navigation-item.svelte';

  let { listItemClass, ...navigationItemProps }: SideNavigationItemProps = $props();
</script>

<li class={classNames('cinder-side-navigation__item', listItemClass)}>
  <NavigationItem {...navigationItemProps} />
</li>
