import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

/** Visual style of the badge. */
export type BadgeVariant = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent';

/** Size of the badge. */
export type BadgeSize = 'xs' | 'sm' | 'md';

/** Props for the Badge component. */
export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
  size?: BadgeSize;
  class?: string;
  children: Snippet;
};

/** Cinder-specific props for the Badge component, used by the schema generator. */
export interface BadgeSchemaProps {
  /**
   * Visual style.
   * @default "neutral"
   */
  variant?: BadgeVariant;
  /**
   * Size of the badge.
   * @default "md"
   */
  size?: BadgeSize;
  /** Custom class merged with `.cinder-badge`. */
  class?: string;
}
