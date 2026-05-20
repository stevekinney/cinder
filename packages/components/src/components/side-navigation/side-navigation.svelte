<script lang="ts" module>
  export type { SideNavigationProps } from './side-navigation.types.ts';
</script>

<script lang="ts">
  import type { SideNavigationProps } from './side-navigation.types.ts';
  import { classNames } from '../../utilities/class-names.ts';

  type SideNavigationRuntimeProps = SideNavigationProps & {
    'aria-label'?: unknown;
    'aria-labelledby'?: unknown;
  };

  let {
    ariaLabel,
    class: className,
    children,
    'aria-label': _ariaLabelAttribute,
    'aria-labelledby': _ariaLabelledbyAttribute,
    ...rest
  }: SideNavigationRuntimeProps = $props();

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
