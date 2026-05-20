<script lang="ts" module>
  /**
   * @cinder
   * @category navigation
   * @status stable
   * @purpose Vertical navigation column that hosts grouped side-navigation-item entries with a required accessible label for the landmark.
   * @tag navigation
   * @tag sidebar
   * @useWhen Building a tall, dense application sidebar with many sections and nested groups.
   * @useWhen Pairing with sidebar so the column collapses responsively on narrow viewports.
   * @avoidWhen Anchoring primary navigation across the top of the page — use navigation-bar instead.
   * @avoidWhen Rendering a single flat horizontal nav row — use navigation-bar instead.
   * @related side-navigation-item, side-navigation-group, navigation-bar, sidebar
   */
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
