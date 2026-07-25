import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

/** Props for the PageHeader component. */
export type PageHeaderProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  'class' | 'children' | 'title'
> & {
  /** Page-level heading content. Rendered inside `<h1>`; snippets must emit phrasing content. */
  title: string | Snippet;
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
  /** Page-level heading text rendered inside `<h1>`. */
  title: string;
  /** Optional supporting text rendered below the title. */
  description?: string;
  /** Additional class names merged with `.cinder-page-header`. */
  class?: string;
}
