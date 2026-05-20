import type { NavigationItemProps } from '../navigation-item/navigation-item.types.ts';
/** Props for the SideNavigationItem component. Forwards all NavigationItem props to the inner item. */
export type SideNavigationItemProps = NavigationItemProps & {
  /** Class merged onto the outer <li>. */
  listItemClass?: string;
};
