import SideNavigationGroup from '../side-navigation-group/side-navigation-group.svelte';
import SideNavigationItem from '../side-navigation-item/side-navigation-item.svelte';
import './side-navigation.css';
import SideNavigationRoot from './side-navigation.svelte';

/**
 * `SideNavigation` is the parent compound component and a namespace exposing
 * the compose-only `SideNavigation.Group` and `SideNavigation.Item` leaves.
 * The leaves remain importable individually via `@lostgradient/cinder/side-navigation-group`
 * and `@lostgradient/cinder/side-navigation-item`.
 */
const SideNavigation = Object.assign(SideNavigationRoot, {
  Group: SideNavigationGroup,
  Item: SideNavigationItem,
});

export default SideNavigation;
export type { SideNavigationProps } from './side-navigation.types.ts';
export { SideNavigation };
