import type { HTMLAttributes } from 'svelte/elements';

/** One TableOfContents entry. */
export type TableOfContentsItem = {
  /** ID of the heading element this entry links to. */
  id: string;
  /** Visible label for the heading link. */
  label: string;
  /** Optional heading level (e.g. 2 for h2) used for metadata/styling hooks. */
  level?: number;
  /** Nested child entries. */
  children?: TableOfContentsItem[];
};

export type TableOfContentsProps = Omit<
  HTMLAttributes<HTMLElement>,
  'aria-label' | 'aria-labelledby'
> & {
  /**
   * Accessible name for the nav landmark.
   * @default "On this page"
   */
  ariaLabel?: string;
  /** Additional class names merged with `.cinder-table-of-contents`. */
  class?: string;
  /**
   * Explicit TOC items. When provided and non-empty, this source wins.
   * If omitted, headings are derived from `target` + `headingSelector`.
   */
  items?: TableOfContentsItem[];
  /**
   * Target heading container for derived mode.
   * Accepts a CSS selector string or an HTMLElement.
   */
  target?: string | HTMLElement;
  /**
   * CSS selector for headings queried inside the target in derived mode.
   * @default "h2, h3, h4"
   */
  headingSelector?: string;
  /**
   * Root margin forwarded to IntersectionObserver when computing the active heading.
   * @default "0% 0% -70% 0%"
   */
  observeRootMargin?: string;
};

export interface TableOfContentsSchemaProps {
  /**
   * Accessible name for the nav landmark.
   * @default "On this page"
   */
  ariaLabel?: string;
  /** Additional class names merged with `.cinder-table-of-contents`. */
  class?: string;
  /** Explicit nested TOC items for controlled mode. */
  items?: TableOfContentsItem[];
  /** CSS selector used to find the target heading container in derived mode. */
  target?: string;
  /**
   * CSS selector used to gather headings inside the target element.
   * @default "h2, h3, h4"
   */
  headingSelector?: string;
  /**
   * Root margin passed to IntersectionObserver for active-section detection.
   * @default "0% 0% -70% 0%"
   */
  observeRootMargin?: string;
}
