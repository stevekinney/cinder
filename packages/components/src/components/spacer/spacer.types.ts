import type { HTMLAttributes } from 'svelte/elements';

/** Props for the Spacer layout primitive. */
export type SpacerProps = HTMLAttributes<HTMLElement> & {
  as?: string;
  class?: string;
};

/** Cinder-specific props for the Spacer component, used by the schema generator. */
export interface SpacerSchemaProps {
  /**
   * Rendered HTML tag.
   * @default "span"
   */
  as?: string;
  /** Custom class merged with `.cinder-spacer`. */
  class?: string;
}
