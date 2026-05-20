import type { Snippet } from 'svelte';
import type { HTMLLiAttributes } from 'svelte/elements';
/** Props for the SideNavigationGroup component. */
export type SideNavigationGroupProps = Omit<HTMLLiAttributes, 'id'> & {
  /** Visible section header label. */
  label: string;
  /** Optional stable id for the root <li>. Trigger uses `${id}-trigger`, panel uses `${id}-panel`. If omitted, generated via useId. */
  id?: string;
  /** Whether the group is expanded. Bindable. Default: true. */
  expanded?: boolean;
  /** When true, the disclosure button is disabled. Default: false. */
  disabled?: boolean;
  /** Optional leading icon rendered inside the header button before the label. */
  icon?: Snippet;
  /** Optional trailing badge rendered inside the header button after the label, before the chevron. */
  badge?: Snippet;
  /** Additional CSS class merged with `.cinder-side-navigation-group`. */
  class?: string;
  /** Must be <li>-wrapped NavigationItems (or SideNavigationItems) rendered inside the disclosed <ul>. */
  children: Snippet;
};
