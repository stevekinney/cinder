import type { Snippet } from 'svelte';
import type { HTMLAnchorAttributes, HTMLAttributes, HTMLButtonAttributes } from 'svelte/elements';
import type {
  AllKeys,
  DataAttributes,
  PadUnion,
  WithoutDataAttributes,
} from '../../_internal/union-props.ts';

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
  'primary' | 'secondary' | 'soft' | 'danger' | 'soft-danger' | 'ghost' | 'ghost-danger';

/**
 * Size of the button. All sizes use compact visual heights; see button.a11y.md for touch-target guidance.
 *
 * @default `"md"`
 */
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

// COR-239: keyof Props became too complex for TypeScript to represent (TS2590) once a consumer
// type-checked this published declaration under `skipLibCheck: false`. Root cause (measured):
// a union with two or more arms each carrying svelte/elements' `data-${string}` index signature
// PLUS differing key sets / attribute interfaces (HTMLButtonAttributes vs HTMLAnchorAttributes).
// Fix: hoist the attribute surface common to both the button and anchor render paths into one
// non-union type with its `data-*` index signature removed (`SharedHtmlAttributes`), restore
// `data-*` forwarding via a single non-distributed `DataAttributes` intersected once, and keep
// only the button/anchor-SPECIFIC attributes inside the (padded) small union. See
// `src/_internal/union-props.ts` for the full mechanism. No prop was added, removed, widened, or
// narrowed for consumers of `ButtonProps` — arbitrary `data-*` props are still accepted on every
// arm, exactly as before.
type SharedHtmlAttributes = WithoutDataAttributes<
  Omit<HTMLAttributes<HTMLButtonElement | HTMLAnchorElement>, 'class'>
>;

type ButtonOnlyExtra = Omit<
  HTMLButtonAttributes,
  keyof HTMLAttributes<HTMLButtonElement> | 'class'
> & { href?: undefined };
type LinkButtonExtra = Omit<
  HTMLAnchorAttributes,
  keyof HTMLAttributes<HTMLAnchorElement> | 'class'
> & { href: string };

// The naming/icon-only discriminant below is intentionally written as an INLINE union rather
// than through separately-named types (this file previously had `WithLabel`, `WithChildren`,
// `IconOnlyAccessibleName`, `IconOnlyVisual`, and `WithIconOnly` as their own named aliases).
// That was measured to reintroduce TS2590 once combined with `SharedHtmlAttributes` and
// `DataAttributes` above, even though none of those named aliases themselves reference
// `data-*` — a named alias to a discriminated union, used as a union member alongside a
// large attribute type, is itself expensive for `keyof` here; the identical shapes written
// inline are not. See `src/_internal/union-props.ts`'s module doc for the general mechanism;
// this file-specific quirk (named vs. inline discriminant) was verified empirically against
// this exact component and is why the shapes below are not factored out despite the
// duplication that would otherwise be preferable.
//
// At least one of `label` or `children` must be provided so the button has an accessible name.
// The union shape (rather than `label?: string; children?: Snippet`) gives TypeScript a
// compile-time guarantee that a consumer can't write `<Button />` with neither. Runtime
// limitation: `string` includes `""`, so a literal empty label still satisfies the label arm;
// the dev-mode guard in the instance script catches that case. `iconOnly` lives only in the
// union branches (not `SharedBase`) so the discriminant is real: the children-only arm
// genuinely forbids `iconOnly={true}`, and the icon-only arm requires it. Icon-only buttons
// additionally require a name source (label/aria-label/aria-labelledby) and a visual icon
// source (children/leadingIcon/trailingIcon) at compile time; `children` is accepted as the
// visual icon only there — it is not a name source in that mode.
type ButtonDiscriminant = (ButtonOnlyExtra | LinkButtonExtra) &
  (
    | { label: string; children?: Snippet; iconOnly?: false }
    | { label?: string; children: Snippet; iconOnly?: false }
    | ({ iconOnly: true } & (
        | { label: string; 'aria-label'?: string; 'aria-labelledby'?: string }
        | { label?: string; 'aria-label': string; 'aria-labelledby'?: string }
        | { label?: string; 'aria-label'?: string; 'aria-labelledby': string }
      ) &
        (
          | { children: Snippet; leadingIcon?: Snippet; trailingIcon?: Snippet }
          | { children?: Snippet; leadingIcon: Snippet; trailingIcon?: Snippet }
          | { children?: Snippet; leadingIcon?: Snippet; trailingIcon: Snippet }
        ))
  );

// `PadUnion` normally pads every arm with every key it lacks (typed `?: never`) so all arms
// present an identical key set to `keyof`. That is wrong here for `aria-label`/`aria-labelledby`
// (present only in the icon-only sub-arms above, but ALSO real, already-optional keys on
// `SharedHtmlAttributes`) and for `leadingIcon`/`trailingIcon` (present only in the icon-only
// visual sub-arms above, but ALSO real, already-optional keys on the trailing cinder-props
// literal below): padding them as `never` on the label/children arms would intersect with their
// real type elsewhere and collapse it to `undefined`, silently rejecting values those arms must
// keep accepting (verified: `{ children, 'aria-label': 'x' }` — a real, previously-valid Button
// usage — stopped type-checking without this exclusion). Everything else about this discriminant
// (href vs. no-href, button- vs. anchor-specific attributes) still needs the padding, so only
// these four keys are excluded from it.
type ButtonPaddedKeys = Exclude<
  AllKeys<ButtonDiscriminant>,
  'aria-label' | 'aria-labelledby' | 'leadingIcon' | 'trailingIcon'
>;

/**
 * Props for the Button component. The cinder-specific base props are inlined here (rather than
 * factored into a separate named type) so `src/api-contract.test.ts`'s AST-only checker — which
 * looks for a literal object among a top-level intersection's members — can still see them.
 */
export type ButtonProps = SharedHtmlAttributes &
  DataAttributes &
  PadUnion<ButtonDiscriminant, ButtonPaddedKeys> & {
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
