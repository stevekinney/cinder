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
  import { getContext } from 'svelte';

  import { ariaInvalid, composeDescribedBy, describeId } from '../../_internal/field-control.ts';
  import {
    RADIO_GROUP_CONTEXT_KEY,
    type RadioGroupContext,
  } from '../radio-group/radio-group.svelte';
  import { cn } from '../../utilities/class-names.ts';

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

  const rawGroup = getContext<RadioGroupContext | undefined>(RADIO_GROUP_CONTEXT_KEY);
  if (!rawGroup) {
    throw new Error('Radio must be used inside a RadioGroup component.');
  }
  const group: RadioGroupContext = rawGroup;

  const checked = $derived(group.value === value);
  const effectiveDisabled = $derived(disabled ?? group.disabled);

  const descriptionId = $derived(describeId(id, !!description));
  const describedBy = $derived(composeDescribedBy(descriptionId, consumerAriaDescribedBy));

  function handleChange(): void {
    if (effectiveDisabled) return;
    group.select(value);
  }
</script>

<div
  class="cinder-radio-row"
  data-checked={checked || undefined}
  data-disabled={effectiveDisabled || undefined}
  data-invalid={group.invalid || undefined}
  data-has-description={description ? '' : undefined}
>
  <span class="cinder-radio-row__control">
    <input
      {id}
      type="radio"
      name={group.name}
      {value}
      {checked}
      disabled={effectiveDisabled}
      aria-invalid={ariaInvalid(group.invalid)}
      onchange={handleChange}
      class={cn('cinder-radio', className)}
      {...rest}
      aria-describedby={describedBy}
    />
    <span class="cinder-radio-row__indicator" aria-hidden="true"></span>
  </span>
  <label for={id} class="cinder-radio-row__label" data-disabled={effectiveDisabled || undefined}>
    {label}
  </label>
  {#if description}
    <p
      id="{id}-description"
      class="cinder-radio-row__description"
      data-disabled={effectiveDisabled || undefined}
    >
      {description}
    </p>
  {/if}
</div>
