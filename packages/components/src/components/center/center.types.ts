import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

/** Props for the Center layout primitive. */
export type CenterProps = Omit<HTMLAttributes<HTMLElement>, 'class'> & {
  maxWidth?: string;
  minHeight?: string;
  intrinsic?: boolean;
  as?: string;
  class?: string;
  children: Snippet;
};

/** Cinder-specific props for the Center component, used by the schema generator. */
export interface CenterSchemaProps {
  /**
   * Maximum inline size. Threads to `--center-max-width`. When omitted, the
   * CSS fallback is `var(--cinder-content-width)`.
   */
  maxWidth?: string;
  /**
   * Minimum block size. Threads to `--center-min-height`. When omitted, no
   * minimum is applied.
   */
  minHeight?: string;
  /**
   * When true, the element centers based on the intrinsic width of its
   * content rather than expanding to fill the available width. Overflowing
   * content remains the consumer's responsibility — set overflow rules on
   * children directly.
   * @default false
   */
  intrinsic?: boolean;
  /**
   * Rendered HTML tag.
   * @default "div"
   */
  as?: string;
  /** Custom class merged with `.cinder-center`. */
  class?: string;
}
