<script lang="ts" module>
  /**
   * @cinder
   * @category navigation
   * @status stable
   * @purpose Single list-wrapped navigation entry tuned for the vertical layout of side-navigation, delegating rendering to navigation-item.
   * @tag navigation
   * @tag sidebar
   * @useWhen Rendering one entry inside a side-navigation column or side-navigation-group.
   * @useWhen Keeping list semantics correct so screen readers announce sidebar entry counts.
   * @avoidWhen Placing entries in a horizontal navigation-bar — use navigation-item directly.
   * @avoidWhen Rendering outside a side-navigation list — use navigation-item without the list wrapper.
   * @related side-navigation, side-navigation-group, navigation-item
   */
  export type { SideNavigationItemProps } from './side-navigation-item.types.ts';
</script>

<script lang="ts">
  import type { SideNavigationItemProps } from './side-navigation-item.types.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import NavigationItem from '../navigation-item/navigation-item.svelte';

  let { listItemClass, ...navigationItemProps }: SideNavigationItemProps = $props();
</script>

<li class={classNames('cinder-side-navigation__item', listItemClass)}>
  <NavigationItem {...navigationItemProps} variant="vertical" />
</li>
