import type { Snippet } from 'svelte';
import type { HTMLAnchorAttributes, HTMLAttributes, HTMLButtonAttributes } from 'svelte/elements';

export type DropdownItemVariant = 'default' | 'danger';
export type DropdownItemRole = 'menuitem' | 'menuitemradio';

// The shared base carries the common HTML attribute surface — crucially the
// event handlers (onclick/onkeydown/onfocus/…) — typed against the generic
// `HTMLElement`. Both render paths (`<button>` and `<a>`) satisfy that, so a
// consumer can attach an inline handler without TypeScript forcing it to
// "prove" which branch it is on. Element-specific NON-event attributes live in
// the two branches so the `href` ⇄ `type` discriminant stays real.
type DropdownItemBase = Omit<HTMLAttributes<HTMLElement>, 'class'> & {
  /** Visual style of the item. Use `danger` to signal a destructive action. Default `default`. */
  variant?: DropdownItemVariant;
  /** ARIA role for the row. Use `menuitemradio` for mutually exclusive menu selections. */
  itemRole?: DropdownItemRole;
  /** When true, adds leading padding to align the item with items that have a leading icon or indicator. Default `false`. */
  inset?: boolean;
  /** When true, the parent dropdown closes after this item is activated. Default `true`. */
  closeOnSelect?: boolean;
  /** Additional class names merged with the component's root class. */
  class?: string;
  children?: Snippet;
  /** When true the item is inert: click is blocked and aria-disabled is set. */
  disabled?: boolean | undefined;
};

/**
 * Button variant — renders a `<button>`. Forwards every button-specific
 * attribute (`name`, `value`, `form`, `formaction`, `formmethod`,
 * `formnovalidate`, `formtarget`, `formenctype`, …) by subtracting the shared
 * `HTMLElement` surface — which the base already provides with `HTMLElement`-typed
 * event handlers — so a form-submitting menu item (`type="submit"` with `name`/
 * `value`) keeps full typing without reintroducing the inline-handler
 * contravariance trap. `disabled` is owned by the base (a managed click guard +
 * aria-disabled), not the native attribute.
 */
export type DropdownItemButtonProps = DropdownItemBase &
  Omit<HTMLButtonAttributes, keyof HTMLAttributes<HTMLElement> | 'class' | 'disabled' | 'type'> & {
    href?: undefined;
    /**
     * Button type forwarded to the `<button>` element. Defaults to `"button"`.
     *
     * NOTE: `type="submit"` only submits a surrounding `<form>` when the menu
     * stays inside that form's DOM subtree. DropdownMenu portals its panel to
     * `document.body` on the non-popover fallback path, so a submit item is then
     * NOT a form descendant and native submission is skipped. To submit a form
     * from a portaled menu, set `form="<form-id>"` to associate the button with
     * the form by id, or handle submission in `onclick`.
     */
    type?: 'button' | 'submit' | 'reset';
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
