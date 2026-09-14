import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

export type PageHeaderHeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

/** Props for the PageHeader component. */
export type PageHeaderProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  'class' | 'children' | 'title'
> & {
  /** Page-level heading content. Rendered inside the configured heading level; snippets must emit phrasing content. */
  title: string | Snippet;
  /** Heading level for the title element. Default 1. */
  headingLevel?: PageHeaderHeadingLevel;
  /** Optional supporting content rendered below the title; snippets must emit phrasing content. */
  description?: string | Snippet;
  /** Optional breadcrumb navigation rendered above the heading row. */
  breadcrumbs?: Snippet;
  /** Optional trailing actions (buttons, menus, controls). */
  actions?: Snippet;
  /** Additional class names merged with `.cinder-page-header`. */
  class?: string;
};

/**
 * Schema-generator surface. The runtime title and description also accept
 * snippets, while schema-driven consumers use their string variants.
 */
export interface PageHeaderSchemaProps {
  /** Page-level heading text rendered inside the configured heading level; the runtime API also accepts a template-only snippet. */
  title: string;
  /** Heading level for the title element. Default 1. */
  headingLevel?: PageHeaderHeadingLevel;
  /** Optional supporting text rendered below the title; the runtime API also accepts a template-only snippet. */
  description?: string;
  /** Additional class names merged with `.cinder-page-header`. */
  class?: string;
}
