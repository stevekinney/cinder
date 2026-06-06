import type { Snippet } from 'svelte';
import type { HTMLAnchorAttributes, HTMLAttributes } from 'svelte/elements';

export type DropdownItemVariant = 'default' | 'danger';

// The shared base carries the common HTML attribute surface — crucially the
// event handlers (onclick/onkeydown/onfocus/…) — typed against the generic
// `HTMLElement`. Both render paths (`<button>` and `<a>`) satisfy that, so a
// consumer can attach an inline handler without TypeScript forcing it to
// "prove" which branch it is on. Element-specific NON-event attributes live in
// the two branches so the `href` ⇄ `type` discriminant stays real.
type DropdownItemBase = Omit<HTMLAttributes<HTMLElement>, 'class'> & {
  variant?: DropdownItemVariant;
  inset?: boolean;
  closeOnSelect?: boolean;
  class?: string;
  children?: Snippet;
  /** When true the item is inert: click is blocked and aria-disabled is set. */
  disabled?: boolean | undefined;
};

/** Button variant — renders a `<button>`. */
export type DropdownItemButtonProps = DropdownItemBase & {
  href?: undefined;
  /** Button type forwarded to the `<button>` element. Defaults to `"button"`. */
  type?: 'button' | 'submit' | 'reset';
  /** Associates the button with a form by id (for `type="submit"` outside the form). */
  form?: string;
};

/**
 * Anchor variant — renders an `<a href>`. `disabled` blocks navigation and sets
 * aria-disabled. Forwards every anchor-specific attribute (`target`, `rel`,
 * `download`, `ping`, `hreflang`, `referrerpolicy`, …) by subtracting the shared
 * `HTMLElement` surface — which the base already provides with `HTMLElement`-typed
 * event handlers — so the inline-handler contravariance trap never reappears.
 */
export type DropdownItemAnchorProps = DropdownItemBase &
  Omit<HTMLAnchorAttributes, keyof HTMLAttributes<HTMLElement> | 'class' | 'href'> & {
    /**
     * Destination URL. Any defined value — including an empty string — selects
     * the anchor branch and renders an `<a>`. Omit `href` entirely to render a
     * `<button>`.
     */
    href: string;
    type?: undefined;
  };

export type DropdownItemProps = DropdownItemButtonProps | DropdownItemAnchorProps;
