import type { Snippet } from 'svelte';
import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';

/**
 * Visual style of the button.
 *
 * `secondary` is an outline-style button (filled surface + border). It is kept as `secondary`
 * rather than `outline` because: (a) today's `secondary` is already outline-flavored, (b) `ghost`
 * covers the transparent-background case, and (c) 27+ call sites depend on `secondary` today.
 *
 * `soft` / `soft-danger` use a tinted fill with no border — mid-emphasis between `ghost` and
 * `primary`/`danger`. Background is `color-mix(in oklch, accent, transparent 88%)` so it
 * resolves against the current theme's accent/danger color in both light and dark modes.
 *
 * @default `"secondary"`
 */
export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'soft'
  | 'danger'
  | 'soft-danger'
  | 'ghost'
  | 'ghost-danger';

/**
 * Size of the button. All sizes use compact visual heights; see button.a11y.md for touch-target guidance.
 *
 * @default `"md"`
 */
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

type SharedBase = {
  /** Visual style. */
  variant?: ButtonVariant;
  /** Size of the button. */
  size?: ButtonSize;
  /** Expand to container width. */
  fullWidth?: boolean;
  /** Disable the button and show a spinner. */
  loading?: boolean;
  /** DECORATIVE icon rendered before the label/children. Always wrapped in aria-hidden.
   *  If the icon conveys meaning, supply accessible text via `label`/`aria-label` instead. */
  leadingIcon?: Snippet;
  /** DECORATIVE icon rendered after the label/children. Always wrapped in aria-hidden.
   *  Same accessible-name guidance as `leadingIcon`. */
  trailingIcon?: Snippet;
  /** Custom class merged with `.cinder-button`. */
  class?: string;
};

// At least one of `label` or `children` must be provided so the button has an accessible name.
//
// The union shape (rather than `label?: string; children?: Snippet`) gives TypeScript a
// compile-time guarantee that a consumer can't write `<Button />` with neither. The Phase 4
// analyzer reads this two-variant shape to generate correct prop-control UI for each branch.
// Runtime limitation: `string` includes `""`, so a literal empty label still satisfies
// `WithLabel`. The dev-mode guard in the instance script catches that case.
//
// `iconOnly` lives only in the union branches (not SharedBase) so the discriminant is real:
// `WithChildren` genuinely forbids `iconOnly={true}`, and `WithIconOnly` requires it.
type WithLabel = { label: string; children?: Snippet; iconOnly?: false };
type WithChildren = { label?: string; children: Snippet; iconOnly?: false };
type IconOnlyAccessibleName =
  | { label: string; 'aria-label'?: string; 'aria-labelledby'?: string }
  | { label?: string; 'aria-label': string; 'aria-labelledby'?: string }
  | { label?: string; 'aria-label'?: string; 'aria-labelledby': string };
type IconOnlyVisual =
  | { children: Snippet; leadingIcon?: Snippet; trailingIcon?: Snippet }
  | { children?: Snippet; leadingIcon: Snippet; trailingIcon?: Snippet }
  | { children?: Snippet; leadingIcon?: Snippet; trailingIcon: Snippet };
// Icon-only buttons require a name source and a visual icon source at compile time.
// `children` is accepted as the visual icon only; it is not a name source in this mode.
type WithIconOnly = { iconOnly: true } & IconOnlyAccessibleName & IconOnlyVisual;
type SharedProps = SharedBase & (WithLabel | WithChildren | WithIconOnly);

type ButtonOnlyProps = SharedProps & Omit<HTMLButtonAttributes, 'class'> & { href?: undefined };
type LinkButtonProps = SharedProps & Omit<HTMLAnchorAttributes, 'class'> & { href: string };

/** Props for the Button component. */
export type ButtonProps = ButtonOnlyProps | LinkButtonProps;

/**
 * Cinder-specific props for the Button component, used by the schema generator.
 * Excludes the inherited HTML attribute surface that consumers can spread via
 * `...rest` — those are documented in the underlying element's MDN reference.
 */
export interface ButtonSchemaProps {
  /**
   * Visual style.
   * @default "secondary"
   */
  variant?: ButtonVariant;
  /**
   * Size of the button.
   * @default "md"
   */
  size?: ButtonSize;
  /**
   * Expand to container width.
   * @default false
   */
  fullWidth?: boolean;
  /**
   * Disable the button and show a spinner.
   * @default false
   */
  loading?: boolean;
  /**
   * Render the button with only an icon. Requires an accessible name source.
   * @default false
   */
  iconOnly?: boolean;
  /** Render as an anchor `<a>` element with this href. */
  href?: string;
  /** Visible text label. Must be non-empty if provided. */
  label?: string;
  /** Custom class merged with `.cinder-button`. */
  class?: string;
}
