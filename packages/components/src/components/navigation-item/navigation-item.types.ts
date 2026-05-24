import type { Snippet } from 'svelte';
type CommonArm = {
  active?: boolean;
  disabled?: boolean;
  class?: string;
  /**
   * Controls item geometry. Emitted as `data-variant`. Default `'horizontal'`.
   *
   * - `'horizontal'`: top-rounded radius, accent bottom-border active indicator.
   *   Used inside `NavigationBar` and similar horizontal tab-bar contexts.
   * - `'mobile'`: stacked full-width layout below the mobile breakpoint.
   * - `'vertical'`: symmetric radius, accent inline-start border active indicator.
   *   Used inside `SideNavigation` (set automatically by `SideNavigationItem`) or
   *   standalone sidebar footers — anywhere a vertical, non-tombstone focus ring
   *   is required.
   */
  variant?: 'horizontal' | 'mobile' | 'vertical';
  children: Snippet;
};
export type LinkArm = CommonArm & {
  href: string;
  /**
   * Optional click handler called for the rendered `<a>` element. Useful for
   * intercepting plain left-clicks for SPA navigation while letting modified
   * clicks (cmd/ctrl/shift/alt or middle-click) fall through to native browser
   * behavior. Disabled-state preventDefault still applies.
   */
  onclick?: (event: MouseEvent) => void;
};
type ButtonArm = CommonArm & { onclick: (event: MouseEvent) => void };
/** Props for the NavigationItem component. Pass `href` for a link, `onclick` for a button. */
export type NavigationItemProps = LinkArm | ButtonArm;
