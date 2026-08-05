<script lang="ts" module>
  /**
   * @cinder
   * @category form
   * @status stable
   * @purpose Single radio button that contributes a value, label, and id to a parent radio-group for one-of-many selection.
   * @tag form
   * @tag selection
   * @useWhen Rendering one option inside a radio-group where exactly one value must be chosen.
   * @useWhen Overriding the group disabled state for a single option.
   * @avoidWhen Selecting zero or more independent options — use checkbox instead.
   * @avoidWhen Used outside a radio-group — the group owns the shared name and value.
   * @related radio-group, checkbox
   */
  export type { RadioProps } from './radio.types.ts';
</script>

<script lang="ts">
  import type { RadioProps } from './radio.types.ts';

  import { ariaInvalid, composeDescribedBy, describeId } from '../../_internal/field-control.ts';
  import { getRadioGroupContext } from '../radio-group/radio-group-context.ts';
  import FormFieldFrame from '../../_internal/form-field-frame.svelte';
  import { classNames } from '../../utilities/class-names.ts';

  let {
    id,
    value,
    label,
    description,
    disabled,
    class: className,
    'aria-describedby': consumerAriaDescribedBy,
    ...rest
  }: RadioProps = $props();

  const group = getRadioGroupContext();

  const checked = $derived(group.value === value);
  const effectiveDisabled = $derived(disabled ?? group.disabled);

  const descriptionId = $derived(describeId(id, !!description));
  const describedBy = $derived(composeDescribedBy(descriptionId, consumerAriaDescribedBy));

  // The row's checked/disabled/invalid/has-description states used to live as
  // `data-*` attributes on the row's own root <div>. FormFieldFrame owns that
  // root now and only exposes a `class` passthrough, so the same states are
  // expressed as BEM modifier classes instead (radio-group.css selects on
  // these rather than the old attribute selectors).
  const rowClass = $derived(
    classNames(
      'cinder-radio-row',
      checked && 'cinder-radio-row--checked',
      effectiveDisabled && 'cinder-radio-row--disabled',
      group.invalid && 'cinder-radio-row--invalid',
      description && 'cinder-radio-row--has-description',
    ),
  );

  function handleChange(): void {
    if (effectiveDisabled) return;
    group.select(value);
  }
</script>

{#snippet radioControl()}
  <span class="cinder-radio-row__control">
    <!--
      aria-invalid mirrors the group's validity onto the native radio so screen
      readers announce invalidity on focus. It is a global ARIA state and the
      standard way to mark form-control validity; the implicit-role lint rule
      does not list it for role=radio, but applying it here is correct.
    -->
    <!-- svelte-ignore a11y_role_supports_aria_props_implicit -->
    <input
      {id}
      type="radio"
      name={group.name}
      {value}
      {checked}
      disabled={effectiveDisabled}
      required={group.required || undefined}
      aria-invalid={ariaInvalid(group.invalid)}
      onchange={handleChange}
      class={classNames('cinder-radio', className)}
      {...rest}
      aria-describedby={describedBy}
    />
    <span class="cinder-radio-row__indicator" aria-hidden="true"></span>
  </span>
{/snippet}

<FormFieldFrame
  {id}
  {label}
  {description}
  disabled={effectiveDisabled}
  class={rowClass}
  labelClass="cinder-radio-row__label"
  descriptionClass="cinder-radio-row__description"
  {descriptionId}
  control={radioControl}
/>
