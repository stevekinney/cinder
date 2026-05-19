import type { Snippet } from 'svelte';

/**
 * One breadcrumb entry. The current page entry omits `href` so it renders
 * as plain text with `aria-current="page"`.
 */
export type BreadcrumbItem = {
  /** Visible label for the entry. */
  label: string;
  /** Link target. Omit for the current page (last entry). */
  href?: string;
};

export type BreadcrumbsProps = {
  /** Ordered list of breadcrumb entries from root to current page. */
  items: BreadcrumbItem[];
  /** Custom separator between entries. Defaults to "/". */
  separator?: Snippet | string;
  /** Accessible name for the nav landmark. Defaults to "Breadcrumb". */
  label?: string;
  /** Additional class names merged with `.cinder-breadcrumbs`. */
  class?: string;
};

/**
 * Cinder-specific props for the Breadcrumbs component, used by the schema generator.
 * Excludes non-JSON-schemable props such as snippet render functions and structured
 * item arrays that are documented by the component itself.
 */
export interface BreadcrumbsSchemaProps {
  /**
   * Custom string separator between entries.
   * @default "/"
   */
  separator?: string;
  /**
   * Accessible name for the nav landmark.
   * @default "Breadcrumb"
   */
  label?: string;
  /** Additional class names merged with `.cinder-breadcrumbs`. */
  class?: string;
}
