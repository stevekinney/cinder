import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

/** Flex-wrap value for the inline row. */
export type InlineWrap = 'wrap' | 'nowrap' | 'wrap-reverse';

/** Props for the Inline layout primitive. */
export type InlineProps = HTMLAttributes<HTMLElement> & {
  gap?: string;
  wrap?: InlineWrap;
  align?: string;
  as?: string;
  class?: string;
  children: Snippet;
};

/** Cinder-specific props for the Inline component, used by the schema generator. */
export interface InlineSchemaProps {
  /**
   * Gap between children. Threads to `--inline-gap`. When omitted, the CSS
   * fallback is `var(--cinder-space-4)`.
   */
  gap?: string;
  /**
   * Flex-wrap value. Threads to `--inline-wrap`. When omitted, the CSS
   * fallback is `wrap`.
   * @default "wrap"
   */
  wrap?: InlineWrap;
  /**
   * `align-items` value. Threads to `--inline-align`. When omitted, the CSS
   * fallback is `center`.
   */
  align?: string;
  /**
   * Rendered HTML tag.
   * @default "div"
   */
  as?: string;
  /** Custom class merged with `.cinder-inline`. */
  class?: string;
}
