<script lang="ts" module>
  /**
   * @cinder
   * @category form
   * @status stable
   * @purpose Sliding switch implementing the WAI-ARIA switch pattern for a single on or off setting that applies immediately.
   * @tag form
   * @tag switch
   * @useWhen Flipping a single setting on or off with immediate effect such as notifications or dark mode.
   * @avoidWhen Selecting zero or more options inside a form submission — use checkbox instead.
   * @avoidWhen Picking one option from a small fixed set — use segmented-control instead.
   * @related checkbox, segmented-control
   */
  export type { ToggleProps } from './toggle.types.ts';
</script>

<script lang="ts">
  import type { ToggleProps } from './toggle.types.ts';
  import { cn } from '../../utilities/class-names.ts';

  let {
    id,
    checked = $bindable(false),
    label,
    disabled = false,
    class: customClassName,
  }: ToggleProps = $props();

  function toggle(): void {
    if (!disabled) {
      checked = !checked;
    }
  }
</script>

<button
  {id}
  type="button"
  role="switch"
  aria-checked={checked}
  aria-label={label}
  {disabled}
  onclick={toggle}
  class={cn('cinder-toggle', customClassName)}
  data-cinder-checked={checked ? '' : undefined}
>
  <span aria-hidden="true" class="cinder-toggle__thumb"></span>
</button>
