<script lang="ts" module>
  /**
   * @cinder
   * @category overlay
   * @status stable
   * @purpose Headless focus-trap primitive that keeps Tab navigation within a container and restores focus on teardown.
   * @tag overlay
   * @tag accessibility
   * @useWhen Building non-native overlays or popovers that need contained keyboard focus.
   * @useWhen Reusing the same focus-management behavior across custom floating surfaces.
   * @avoidWhen The surface already uses native dialog focus trapping.
   * @related modal, drawer, sheet, popover
   */
  export type { FocusTrapProps } from './focus-trap.types.ts';
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';

  import type { FocusTrapProps } from './focus-trap.types.ts';
  import { createFocusTrap } from './focus-trap.utilities.svelte.ts';

  let {
    active = true,
    restoreFocus = true,
    initialFocus = null,
    fallbackFocus = null,
    class: className,
    children,
    ...rest
  }: FocusTrapProps = $props();
</script>

<div
  {@attach createFocusTrap({
    active: () => active,
    restoreFocus,
    initialFocus: () => initialFocus,
    fallbackFocus: () => fallbackFocus,
  })}
  class={classNames(className)}
  {...rest}
>
  {@render children()}
</div>
