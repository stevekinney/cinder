import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
export type NavigationVariant = 'horizontal' | 'mobile';
export type NavigationBarPlacement = 'top' | 'bottom';
export type NavigationBarLabelVisibility = 'always' | 'active' | 'never';
/** Attributes injected into the consumer's toggle button via the menuToggle snippet parameter. */
export type NavigationBarToggleAttributes = {
  'aria-expanded': 'true' | 'false';
  'aria-controls': string;
  /** Client-only click handler. Omitted during SSR to avoid forwarding function props in server markup. */
  onclick?: (event: MouseEvent) => void;
};
/** Context passed to the items snippet so items can adapt their layout. */
export type NavigationBarItemsContext = {
  variant: NavigationVariant;
  placement?: NavigationBarPlacement;
  showLabels?: NavigationBarLabelVisibility;
};
export type NavigationBarProps = Omit<HTMLAttributes<HTMLElement>, 'class'> & {
  /** Custom class merged onto the root `<nav>` element. */
  class?: string;
  /**
   * Visual placement mode. `bottom` renders a mobile tab-bar composition, but
   * still does not fix or stick itself to the viewport.
   *
   * @default "top"
   */
  placement?: NavigationBarPlacement;
  /**
   * Label visibility for mobile bottom-tab compositions. Hidden labels remain in
   * the accessibility tree when wrapped in `[data-cinder-navigation-label]`.
   *
   * @default "always"
   */
  showLabels?: NavigationBarLabelVisibility;
  brand?: Snippet;
  /** Receives a context object with the current variant. */
  items: Snippet<[NavigationBarItemsContext]>;
  actions?: Snippet;
  /** Snippet receiving toggle button attributes. Consumer renders the actual <button> and should mark decorative glyphs or icons inside it as aria-hidden so the button name comes from text or aria-label, not the ornament. */
  menuToggle?: Snippet<[NavigationBarToggleAttributes]>;
  /** Two-way bindable open state of the mobile menu. */
  mobileMenuOpen?: boolean;
  /** Accessible name for the <nav> landmark. Wins over any aria-label passed via rest. Default 'Main navigation'. */
  label?: string;
};
