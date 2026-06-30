import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

/** Props for the PageHeader component. */
export type PageHeaderProps = Omit<HTMLAttributes<HTMLElement>, 'class' | 'children'> & {
  /** Page-level heading text. Rendered as `<h1>`. */
  title: string;
  /** Optional supporting metadata displayed beside the title. */
  meta?: string;
  /** Additional class names merged with `.cinder-page-header`. */
  class?: string;
  /** Optional trailing actions (buttons, menus, controls). */
  children?: Snippet;
};
