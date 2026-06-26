<script lang="ts" module>
  /**
   * @cinder
   * @category form
   * @status stable
   * @purpose Sliding switch implementing the WAI-ARIA switch pattern for a single on or off setting that applies immediately.
   * @tag form
   * @tag switch
   * @useWhen Flipping a single setting on or off with immediate effect such as notifications or dark mode.
   * @avoidWhen Picking one option from a small fixed set — use segmented-control instead.
   * @avoidWhen Collecting a deferred boolean (agreement, opt-in) in a Submit-style form — a switch implies immediate effect; use checkbox instead.
   * @related checkbox, segmented-control
   */
  export type { ToggleProps } from './toggle.types.ts';
</script>

<script lang="ts">
  import type { ToggleProps } from './toggle.types.ts';
  import { getFormFieldContext } from '../../_internal/form-field-context.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import { commitValue } from '../../utilities/value-change.ts';

  let {
    id,
    checked = $bindable(false),
    onValueChange,
    label,
    disabled,
    hideLabel = false,
    name,
    value = 'on',
    form,
    class: customClassName,
  }: ToggleProps = $props();

  // A switch implies an immediate-effect setting, so Toggle deliberately does
  // NOT take on `required`/`error` validation semantics — a deferred boolean in
  // a submit form should use Checkbox instead (see the module docstring). It
  // does, however, inherit `disabled` from a wrapping FormField so a disabled
  // field group greys out the switch alongside its peers.
  const context = getFormFieldContext();
  const resolvedDisabled = $derived(disabled ?? context?.disabled ?? false);

  const labelId = $derived(`${id}-label`);

  function toggle(): void {
    if (!resolvedDisabled) {
      commitValue(!checked, onValueChange, (next) => {
        checked = next;
      });
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
    disabled={resolvedDisabled}
    onclick={toggle}
    class={classNames('cinder-toggle', customClassName)}
    data-cinder-checked={checked ? '' : undefined}
  >
    <span aria-hidden="true" class="cinder-toggle__thumb"></span>
  </button>
  {#if name}
    <!--
      Form participation: a `hidden` checkbox mirrors `checked` so the toggle
      submits with a native form. The <button role="switch"> stays the only thing
      users tab to or operate. We use the `hidden` attribute (display:none) rather
      than a visually-hidden + aria-hidden + tabindex="-1" input: a display:none
      control is genuinely non-focusable and out of the accessibility tree, so it
      avoids the aria-hidden-focus WCAG violation (aria-hidden on a still-focusable
      element). `hidden` form controls STILL submit when named, checked, and not
      disabled — only `disabled` excludes a control from the form data set.
      Rendered only when `name` is set, so a client-side-only toggle pays nothing.
    -->
    <input type="checkbox" hidden {name} {value} {form} disabled={resolvedDisabled} bind:checked />
  {/if}
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
    data-disabled={resolvedDisabled || undefined}
    onclick={toggle}
  >
    {label}
  </span>
</span>
