<script lang="ts" module>
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';

  /** Props for the SideNavigation component. */
  export type SideNavigationProps = Omit<HTMLAttributes<HTMLElement>, 'aria-label'> & {
    /** Accessible name for the <nav> landmark. Required, non-empty, distinct from other navs on the page. */
    ariaLabel: string;
    /** Additional CSS class merged with `.cinder-side-navigation`. */
    class?: string;
    /** Must be <li> elements containing NavigationItem and/or SideNavigationGroup. */
    children: Snippet;
  };
</script>

<script lang="ts">
  import { classNames } from '../utilities/class-names.ts';

  let { ariaLabel, class: className, children, ...rest }: SideNavigationProps = $props();

  const validatedLabel = $derived.by(() => {
    if (ariaLabel.trim() === '') {
      throw new Error('SideNavigation requires a non-empty ariaLabel.');
    }
    return ariaLabel;
  });
</script>

<nav class={classNames('cinder-side-navigation', className)} {...rest} aria-label={validatedLabel}>
  <ul class="cinder-side-navigation__list">
    {@render children()}
  </ul>
</nav>
