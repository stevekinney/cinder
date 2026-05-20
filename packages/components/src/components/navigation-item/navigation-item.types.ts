import type { Snippet } from 'svelte';
type CommonArm = {
  active?: boolean;
  disabled?: boolean;
  class?: string;
  /** Controls stacked layout on mobile. Emitted as data-variant. Default 'horizontal'. */
  variant?: 'horizontal' | 'mobile';
  children: Snippet;
};
export type LinkArm = CommonArm & { href: string };
type ButtonArm = CommonArm & { onclick: (event: MouseEvent) => void };
/** Props for the NavigationItem component. Pass `href` for a link, `onclick` for a button. */
export type NavigationItemProps = LinkArm | ButtonArm;
