<script lang="ts" module>
  export type { RadioProps } from './radio.types.ts';
</script>

<script lang="ts">
  import type { RadioProps } from './radio.types.ts';
  import { getContext } from 'svelte';

  import { ariaInvalid, composeDescribedBy, describeId } from '../../_internal/field-control.ts';
  import { RADIO_GROUP_CONTEXT_KEY, type RadioGroupContext } from '../radio-group.svelte';
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
