<script lang="ts" module>
  import type { HTMLInputAttributes } from 'svelte/elements';

  /**
   * Props for the Radio component.
   *
   * Must be used inside a RadioGroup. The group owns `name`, `disabled`, and
   * the bound value; this component contributes `value`, the visible label,
   * and a unique `id` for label association.
   *
   * Per the WAI-ARIA radiogroup pattern, only the currently-checked radio
   * sits in the tab order (`tabindex=0`); all others are reachable only via
   * arrow keys (`tabindex=-1`). Native radio inputs implement this
   * automatically when they share a `name`, so we let the platform handle it.
   */
  export type RadioProps = HTMLInputAttributes & {
    /** Unique identifier — required for label association. */
    id: string;
    /** The value submitted when this radio is selected. */
    value: string;
    /** Visible label rendered in a `<label>` element associated via `for`. */
    label: string;
    /** Override the group's `disabled` for this single radio. */
    disabled?: boolean;
    /** Extra class names merged with `.cinder-radio`. */
    class?: string;
  };
</script>

<script lang="ts">
  import { getContext } from 'svelte';

  import { ariaInvalid } from '../_internal/field-control.ts';
  import { RADIO_GROUP_CONTEXT_KEY, type RadioGroupContext } from './radio-group.svelte';
  import { cn } from '../utilities/class-names.ts';

  let { id, value, label, disabled, class: className, ...rest }: RadioProps = $props();

  const rawGroup = getContext<RadioGroupContext | undefined>(RADIO_GROUP_CONTEXT_KEY);
  if (!rawGroup) {
    throw new Error('Radio must be used inside a RadioGroup component.');
  }
  const group: RadioGroupContext = rawGroup;

  const checked = $derived(group.value === value);
  const effectiveDisabled = $derived(disabled ?? group.disabled);

  function handleChange(): void {
    if (effectiveDisabled) return;
    group.select(value);
  }
</script>

<div class="cinder-radio-row">
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
  />
  <label for={id} class="cinder-radio-row__label" data-disabled={effectiveDisabled || undefined}>
    {label}
  </label>
</div>
