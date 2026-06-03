import type { Snippet } from 'svelte';
import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';

/**
 * Visual variant of the FAB.
 *
 * `filled` renders a circle with equal width and height — the classic FAB shape.
 * `extended` renders a pill with auto-width that accommodates icon + label side by side.
 *
 * @default `"filled"`
 */
export type FloatingActionButtonVariant = 'filled' | 'extended';

/**
 * Size of the FAB. Controls the diameter (`filled`) or height (`extended`).
 *
 * @default `"md"`
 */
export type FloatingActionButtonSize = 'sm' | 'md' | 'lg';

/**
 * Color palette of the FAB.
 *
 * - `primary` — uses the primary accent color (solid fill, contrast foreground).
 * - `secondary` — uses the surface-raised background with standard text color.
 * - `surface` — uses the neutral surface color, suited for floating over content.
 *
 * @default `"primary"`
 */
export type FloatingActionButtonColor = 'primary' | 'secondary' | 'surface';

type SharedBase = {
  /** Visual variant. `filled` = circle, `extended` = pill with icon + label. */
  variant?: FloatingActionButtonVariant;
  /** Size — controls diameter for filled, height for extended. */
  size?: FloatingActionButtonSize;
  /** Color palette. */
  color?: FloatingActionButtonColor;
  /** When true, disables the button and prevents interaction. */
  disabled?: boolean;
  /** Custom class merged with `.cinder-fab`. */
  class?: string;
  /**
   * The icon (or icon + label for extended variant). Always provide `aria-label` when
   * the FAB renders an icon without visible text — i.e. the `filled` variant.
   */
  children?: Snippet;
};

/**
 * Button-rendered FAB — no `href` prop.
 * The `type` attribute is omitted because the component always renders `type="button"`.
 */
type FloatingActionButtonOnly = SharedBase &
  Omit<HTMLButtonAttributes, 'class' | 'type' | 'disabled'> & { href?: undefined };

/**
 * Link-rendered FAB — requires an `href` prop, renders as `<a>`.
 */
type FloatingActionButtonLink = SharedBase & Omit<HTMLAnchorAttributes, 'class'> & { href: string };

/**
 * Props for the FloatingActionButton component.
 *
 * Icon-only usage (i.e. `variant="filled"`) requires an accessible name via
 * `aria-label` or `aria-labelledby`. The component emits a dev-mode warning when
 * neither is present.
 */
export type FloatingActionButtonProps = FloatingActionButtonOnly | FloatingActionButtonLink;

/**
 * Cinder-specific props for the FloatingActionButton component, used by the schema generator.
 * Excludes the inherited HTML attribute surface.
 */
export interface FloatingActionButtonSchemaProps {
  /**
   * Visual variant. `filled` = circle, `extended` = pill.
   * @default "filled"
   */
  variant?: FloatingActionButtonVariant;
  /**
   * Size of the FAB.
   * @default "md"
   */
  size?: FloatingActionButtonSize;
  /**
   * Color palette.
   * @default "primary"
   */
  color?: FloatingActionButtonColor;
  /**
   * When true, disables the button and prevents interaction.
   * @default false
   */
  disabled?: boolean;
  /** Render as an anchor `<a>` element with this href. */
  href?: string;
  /** Custom class merged with `.cinder-fab`. */
  class?: string;
}
