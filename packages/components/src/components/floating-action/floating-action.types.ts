import type { Snippet } from 'svelte';
import type { HTMLAnchorAttributes, HTMLAttributes, HTMLButtonAttributes } from 'svelte/elements';
import type {
  DataAttributes,
  PadUnion,
  WithoutDataAttributes,
} from '../../_internal/union-props.ts';

/**
 * Visual palette of the floating action.
 *
 * - `primary` — uses the primary accent color (solid fill, contrast foreground).
 * - `secondary` — uses the surface-raised background with standard text color.
 * - `surface` — uses the neutral surface color, suited for floating over content.
 *
 * @default `"primary"`
 */
export type FloatingActionVariant = 'primary' | 'secondary' | 'surface';

/**
 * Size of the floating action. Controls the diameter (`filled`) or height (`extended`).
 *
 * @default `"md"`
 */
export type FloatingActionSize = 'sm' | 'md' | 'lg';

/**
 * Shape of the floating action.
 *
 * `filled` renders a circle with equal width and height — the classic floating action shape.
 * `extended` renders a pill with auto-width that accommodates icon + label side by side.
 *
 * @default `"filled"`
 */
export type FloatingActionShape = 'filled' | 'extended';

// COR-239: keyof Props became too complex for TypeScript to represent (TS2590) once a consumer
// type-checked this published declaration under `skipLibCheck: false` — the button/anchor split
// each forwarded a FULL svelte/elements attribute interface (including its `data-*` index
// signature), and the two arms have different key sets. Fix: hoist the attribute surface common
// to both render paths into one non-union type with `data-*` removed (`SharedHtmlAttributes`),
// restore `data-*` forwarding via a single non-distributed `DataAttributes` intersected once, and
// keep only the element-SPECIFIC attributes inline inside the (padded) small union (naming this
// union's shapes was measured to reintroduce TS2590; see `src/_internal/union-props.ts` and
// button.types.ts for the general mechanism). No prop was added, removed, widened, or narrowed —
// arbitrary `data-*` props are still accepted on every arm, exactly as before.
type SharedHtmlAttributes = WithoutDataAttributes<
  Omit<HTMLAttributes<HTMLButtonElement | HTMLAnchorElement>, 'class'>
>;

/**
 * The button-rendered (no `href`) discriminant arm, exported so `SpeedDialActionProps` can
 * derive its own button-only attribute surface directly rather than trying to `Extract<>` a
 * single arm out of `FloatingActionProps` — which is no longer a union at the top level (it's
 * `SharedHtmlAttributes & DataAttributes & PadUnion<...> & {...}`, a single intersection type),
 * so `Extract` can no longer pick an arm out of it.
 */
export type FloatingActionButtonOnlyProps = SharedHtmlAttributes &
  DataAttributes &
  Omit<HTMLButtonAttributes, keyof HTMLAttributes<HTMLButtonElement> | 'type' | 'disabled'> & {
    href?: undefined;
    /** Shape. `filled` = circle, `extended` = pill with icon + label. */
    shape?: FloatingActionShape;
    /** Size — controls diameter for filled, height for extended. */
    size?: FloatingActionSize;
    /** Color palette (primary, secondary, or surface). */
    variant?: FloatingActionVariant;
    /** When true, disables the button and prevents interaction. */
    disabled?: boolean;
    /** Custom class merged with `.cinder-floating-action`. */
    class?: string;
    /**
     * The icon (or icon + label for extended shape). Always provide `aria-label` when
     * the floating action renders an icon without visible text — i.e. the `filled` shape.
     */
    children?: Snippet;
  };

/**
 * Props for the FloatingAction component.
 *
 * Icon-only usage (i.e. `shape="filled"`) requires an accessible name via
 * `aria-label` or `aria-labelledby`. The component emits a dev-mode warning when
 * neither is present.
 */
export type FloatingActionProps = SharedHtmlAttributes &
  DataAttributes &
  PadUnion<
    | (Omit<HTMLButtonAttributes, keyof HTMLAttributes<HTMLButtonElement> | 'type' | 'disabled'> & {
        href?: undefined;
      })
    | (Omit<HTMLAnchorAttributes, keyof HTMLAttributes<HTMLAnchorElement>> & { href: string })
  > & {
    /** Shape. `filled` = circle, `extended` = pill with icon + label. */
    shape?: FloatingActionShape;
    /** Size — controls diameter for filled, height for extended. */
    size?: FloatingActionSize;
    /** Color palette (primary, secondary, or surface). */
    variant?: FloatingActionVariant;
    /** When true, disables the button and prevents interaction. */
    disabled?: boolean;
    /** Custom class merged with `.cinder-floating-action`. */
    class?: string;
    /**
     * The icon (or icon + label for extended shape). Always provide `aria-label` when
     * the floating action renders an icon without visible text — i.e. the `filled` shape.
     */
    children?: Snippet;
  };

/**
 * Cinder-specific props for the FloatingAction component, used by the schema generator.
 * Excludes the inherited HTML attribute surface.
 */
export interface FloatingActionSchemaProps {
  /**
   * Shape. `filled` = circle, `extended` = pill.
   * @default "filled"
   */
  shape?: FloatingActionShape;
  /**
   * Size of the floating action.
   * @default "md"
   */
  size?: FloatingActionSize;
  /**
   * Color palette.
   * @default "primary"
   */
  variant?: FloatingActionVariant;
  /**
   * When true, disables the button and prevents interaction.
   * @default false
   */
  disabled?: boolean;
  /** Render as an anchor `<a>` element with this href. */
  href?: string;
  /** Custom class merged with `.cinder-floating-action`. */
  class?: string;
}
