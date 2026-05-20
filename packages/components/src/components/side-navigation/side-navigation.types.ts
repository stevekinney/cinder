import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
/** Props for the SideNavigation component. */
export type SideNavigationProps = Omit<
  HTMLAttributes<HTMLElement>,
  'aria-label' | 'aria-labelledby'
> & {
  /** Accessible name for the <nav> landmark. Required, non-empty, distinct from other navs on the page. */
  ariaLabel: string;
  /** Additional CSS class merged with `.cinder-side-navigation`. */
  class?: string;
  /** Must be <li> elements containing NavigationItem and/or SideNavigationGroup. */
  children: Snippet;
};
