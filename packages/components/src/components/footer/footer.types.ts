import type { HTMLAttributes } from 'svelte/elements';

export type FooterLink = {
  id: string;
  label: string;
  href: string;
};

export type FooterGroup = {
  id: string;
  title: string;
  links: FooterLink[];
};

export type FooterProps = Omit<HTMLAttributes<HTMLElement>, 'children' | 'class'> & {
  /** Optional brand/title text rendered in the first column. */
  brand?: string;
  /** Optional supporting copy rendered under brand. */
  description?: string;
  /** Link groups rendered as columns in the main area. */
  groups?: FooterGroup[];
  /** Additional links rendered in the legal row. */
  legalLinks?: FooterLink[];
  /** Copyright text in the legal row. */
  copyright?: string;
  /** Accessible label for the footer landmark. */
  label?: string;
  /** Additional classes merged on the root element. */
  class?: string;
};
