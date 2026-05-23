import type { NavigationItemProps } from '../navigation-item/navigation-item.types.ts';

/**
 * Distributive `Omit` — preserves the link/button arm discrimination on
 * `NavigationItemProps`. Plain `Omit<NavigationItemProps, 'variant'>` would
 * collapse the union into a single intersection and let consumers pass any
 * extra property without TypeScript complaining; the `T extends unknown`
 * trigger fans the Omit across each arm individually.
 */
type DistributiveOmit<T, K extends keyof never> = T extends unknown ? Omit<T, K> : never;

/**
 * Props for the SideNavigationItem component.
 *
 * Forwards all NavigationItem props except `variant` — side navigation always
 * renders the vertical variant so consumers cannot accidentally introduce a
 * tombstone (horizontal-radius) focus ring inside a sidebar list.
 */
export type SideNavigationItemProps = DistributiveOmit<NavigationItemProps, 'variant'> & {
  /** Class merged onto the outer <li>. */
  listItemClass?: string;
};
