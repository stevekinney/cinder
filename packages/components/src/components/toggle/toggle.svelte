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
  import { classNames } from '../../utilities/class-names.ts';

  let {
    id,
    checked = $bindable(false),
    label,
    disabled = false,
    hideLabel = false,
    class: customClassName,
  }: ToggleProps = $props();

  const labelId = $derived(`${id}-label`);

  function toggle(): void {
    if (!disabled) {
      checked = !checked;
    }
  }
</script>

<span class="cinder-toggle-field">
  <button
    {id}
    type="button"
    role="switch"
    aria-checked={checked}
    aria-labelledby={labelId}
    {disabled}
    onclick={toggle}
    class={classNames('cinder-toggle', customClassName)}
    data-cinder-checked={checked ? '' : undefined}
  >
    <span aria-hidden="true" class="cinder-toggle__thumb"></span>
  </button>
  <!--
    The label is a <span> (not a <label for>) named via aria-labelledby. A native
    <label for> targeting the <button> would forward a synthetic click to it,
    which — combined with the button's own onclick — double-toggles in some
    engines. aria-labelledby supplies the accessible name, and the span's own
    onclick gives click-to-toggle. toggle() is disabled-guarded, so clicking the
    label of a disabled toggle is a no-op.
  -->
  <span
    id={labelId}
    class="cinder-toggle-field__label"
    role="presentation"
    data-hidden={hideLabel || undefined}
    data-disabled={disabled || undefined}
    onclick={toggle}
  >
    {label}
  </span>
</span>
