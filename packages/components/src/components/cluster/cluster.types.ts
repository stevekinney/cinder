import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

/** Props for the Cluster layout primitive. */
export type ClusterProps = HTMLAttributes<HTMLElement> & {
  gap?: string;
  align?: string;
  justify?: string;
  as?: string;
  class?: string;
  children: Snippet;
};

/** Cinder-specific props for the Cluster component, used by the schema generator. */
export interface ClusterSchemaProps {
  /**
   * Gap between children. Threads to `--cluster-gap`. When omitted, the CSS
   * fallback is `var(--cinder-space-2)`.
   */
  gap?: string;
  /**
   * `align-items` value. Threads to `--cluster-align`. When omitted, the CSS
   * fallback is `center`.
   */
  align?: string;
  /**
   * `justify-content` value. Threads to `--cluster-justify`. When omitted, the
   * CSS fallback is `flex-start`.
   */
  justify?: string;
  /**
   * Rendered HTML tag.
   * @default "div"
   */
  as?: string;
  /** Custom class merged with `.cinder-cluster`. */
  class?: string;
}
