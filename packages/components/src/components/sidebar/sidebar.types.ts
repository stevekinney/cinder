import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
/** Props for the Sidebar component. */
export type SidebarProps = Omit<
  HTMLAttributes<HTMLElement>,
  'aria-label' | 'aria-labelledby' | 'class' | 'children'
> & {
  /**
   * Whether the sidebar is collapsed. Bindable via `bind:collapsed`. Default `false`.
   *
   * Above `mobileBreakpoint`, `collapsed=true` switches the sidebar to
   * icon-only mode. At or below `mobileBreakpoint`, the sidebar renders inside a
   * `<Drawer>` and `collapsed=true` means the drawer is closed.
   */
  collapsed?: boolean;
  /**
   * Accessible name for the outer landmark and the mobile drawer. Required —
   * defaults to `'Sidebar'` for convenience but must be unique per page. The
   * inner `<nav>` landmark derives its own accessible name from this value
   * by appending `' navigation'` so screen readers can distinguish the
   * outer complementary region from the inner navigation region.
   */
  label?: string;
  /**
   * Viewport width below which the sidebar switches from the inline aside to
   * the mobile drawer. Accepts a simple CSS length such as `'47.99rem'` or
   * `'1024px'`. Default `'47.99rem'`.
   */
  mobileBreakpoint?: string;
  /** Additional CSS class merged with `.cinder-sidebar`. */
  class?: string;
  /** Optional branding region rendered above the navigation. */
  brand?: Snippet;
  /**
   * Navigation region. Typically a `<SideNavigation>` subtree. Optional — when
   * omitted, no `<nav>` landmark is rendered (so the sidebar can serve as app chrome
   * without a navigation list, and an empty `<nav>` isn't announced to screen readers).
   */
  navigation?: Snippet;
  /** Optional footer region (e.g. user account, sign-out). */
  footer?: Snippet;
};
