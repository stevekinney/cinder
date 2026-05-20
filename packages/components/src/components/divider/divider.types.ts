import type { HTMLAttributes } from 'svelte/elements';

/**
 * Visual tone of the divider line.
 * - `subtle` uses the muted border token (lighter, less prominent).
 * - `strong` uses the strong border token (darker, more prominent).
 */
export type DividerTone = 'subtle' | 'strong';

/**
 * Layout axis the divider spans.
 * - `horizontal` renders a full-width rule (block).
 * - `vertical` renders a full-height rule (inline).
 */
export type DividerOrientation = 'horizontal' | 'vertical';

/**
 * Props for the Divider component.
 *
 * Renders a thin 1px rule to visually separate content. Decorative by default
 * (hidden from assistive technology). Set `decorative={false}` for structural
 * separators that should appear in the accessibility tree.
 */
export type DividerProps = HTMLAttributes<HTMLElement> & {
  /**
   * Layout axis the rule spans.
   * @default "horizontal"
   */
  orientation?: DividerOrientation;
  /**
   * Shortens the rule by `--cinder-space-2` on the perpendicular axis,
   * creating visual breathing room at either end.
   * @default false
   */
  inset?: boolean;
  /**
   * Visual weight of the divider line.
   * @default "subtle"
   */
  tone?: DividerTone;
  /**
   * When `true` the element is hidden from assistive technology (`aria-hidden="true"`).
   * When `false` the element carries an explicit separator role.
   * @default true
   */
  decorative?: boolean;
  /** Additional class names merged with `.cinder-divider`. */
  class?: string;
};

/** Cinder-specific props for the Divider component, used by the schema generator. */
export interface DividerSchemaProps {
  /**
   * Layout axis the rule spans.
   * @default "horizontal"
   */
  orientation?: DividerOrientation;
  /**
   * Shortens the rule by `--cinder-space-2` on the perpendicular axis.
   * @default false
   */
  inset?: boolean;
  /**
   * Visual weight of the divider line.
   * @default "subtle"
   */
  tone?: DividerTone;
  /**
   * When `true` the element is hidden from assistive technology.
   * @default true
   */
  decorative?: boolean;
  /** Additional class names merged with `.cinder-divider`. */
  class?: string;
}
