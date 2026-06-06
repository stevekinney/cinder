import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
export type NavigationVariant = 'horizontal' | 'mobile';
/** Attributes injected into the consumer's toggle button via the menuToggle snippet parameter. */
export type NavigationBarToggleAttributes = {
  'aria-expanded': 'true' | 'false';
  'aria-controls': string;
  onclick: (event: MouseEvent) => void;
};
/** Context passed to the items snippet so items can adapt their layout. */
export type NavigationBarItemsContext = {
  variant: NavigationVariant;
};
export type NavigationBarProps = Omit<HTMLAttributes<HTMLElement>, 'class'> & {
  class?: string;
  brand?: Snippet;
  /** Receives a context object with the current variant. */
  items: Snippet<[NavigationBarItemsContext]>;
  actions?: Snippet;
  /** Snippet receiving toggle button attributes. Consumer renders the actual <button> and should mark decorative glyphs or icons inside it as aria-hidden so the button name comes from text or aria-label, not the ornament. */
  menuToggle?: Snippet<[NavigationBarToggleAttributes]>;
  /** Two-way bindable open state of the mobile menu. */
  mobileMenuOpen?: boolean;
  /** Accessible name for the <nav> landmark. Wins over any aria-label passed via rest. Default 'Main navigation'. */
  navAriaLabel?: string;
};
