import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

/** Flex-direction value for the stack. */
export type StackDirection = 'column' | 'column-reverse';

/** Props for the Stack layout primitive. */
export type StackProps = Omit<HTMLAttributes<HTMLElement>, 'class'> & {
  gap?: string;
  direction?: StackDirection;
  as?: string;
  class?: string;
  children: Snippet;
};

/** Cinder-specific props for the Stack component, used by the schema generator. */
export interface StackSchemaProps {
  /**
   * Gap between children. Threads to `--stack-gap`. When omitted, the CSS
   * fallback is `var(--cinder-space-4)`.
   */
  gap?: string;
  /**
   * Flex direction. Threads to `--stack-direction`. When omitted, the CSS
   * fallback is `column`.
   * @default "column"
   */
  direction?: StackDirection;
  /**
   * Rendered HTML tag.
   * @default "div"
   */
  as?: string;
  /** Custom class merged with `.cinder-stack`. */
  class?: string;
}
