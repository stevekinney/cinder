import type { NavigationItemProps } from '../navigation-item/navigation-item.types.ts';

type WithoutVariant<T> = T extends unknown ? Omit<T, 'variant'> : never;

/**
 * Props for the SideNavigationItem component.
 *
 * Forwards all NavigationItem props except `variant` — side navigation always
 * renders the vertical variant so consumers cannot accidentally introduce a
 * tombstone (horizontal-radius) focus ring inside a sidebar list.
 */
export type SideNavigationItemProps = WithoutVariant<NavigationItemProps> & {
  /** Class merged onto the outer <li>. */
  listItemClass?: string;
};
