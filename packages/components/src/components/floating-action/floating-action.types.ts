import type { Snippet } from 'svelte';
import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';

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

type SharedBase = {
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
 * Button-rendered floating action — no `href` prop.
 * The `type` attribute is omitted because the component always renders `type="button"`.
 */
type FloatingActionOnly = SharedBase &
  Omit<HTMLButtonAttributes, 'class' | 'type' | 'disabled'> & { href?: undefined };

/**
 * Link-rendered floating action — requires an `href` prop, renders as `<a>`.
 */
type FloatingActionLink = SharedBase & Omit<HTMLAnchorAttributes, 'class'> & { href: string };

/**
 * Props for the FloatingAction component.
 *
 * Icon-only usage (i.e. `shape="filled"`) requires an accessible name via
 * `aria-label` or `aria-labelledby`. The component emits a dev-mode warning when
 * neither is present.
 */
export type FloatingActionProps = FloatingActionOnly | FloatingActionLink;

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
