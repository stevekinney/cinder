<script lang="ts" module>
  /** Symbol key for the radio-group Svelte context. */
  export const RADIO_GROUP_CONTEXT_KEY = Symbol('cinder-radio-group');

  export type { RadioGroupContext, RadioGroupProps } from './radio-group.types.ts';
</script>

<script lang="ts">
  import type { RadioGroupContext, RadioGroupProps } from './radio-group.types.ts';
  import { setContext } from 'svelte';

  import {
    ariaInvalid,
    composeDescribedBy,
    describeId,
    errorId as buildErrorId,
  } from '../../_internal/field-control.ts';
  import { cn } from '../../utilities/class-names.ts';
  import { useId } from '../../utilities/use-id.ts';

  let {
    value = $bindable(''),
    name,
    legend,
    description,
    error,
    disabled = false,
    required = false,
    variant = 'default',
    class: className,
    children,
  }: RadioGroupProps = $props();

  // Group ID is needed to scope the description/error ids; consumers don't
  // pass an id because the group itself is a fieldset, not a labelled input.
  const groupId = useId('cinder-radio-group');
  const descriptionId = $derived(describeId(groupId, !!description));
  const errId = $derived(buildErrorId(groupId, !!error));
  const describedBy = $derived(composeDescribedBy(descriptionId, errId));

  setContext<RadioGroupContext>(RADIO_GROUP_CONTEXT_KEY, {
    get name() {
      return name;
    },
    get value() {
      return value;
    },
    get disabled() {
      return disabled;
    },
    get invalid() {
      return !!error;
    },
    select(next) {
      value = next;
    },
  });
</script>

<fieldset
  class={cn('cinder-radio-group', className)}
  aria-invalid={ariaInvalid(!!error)}
  aria-describedby={describedBy}
  data-cinder-disabled={disabled || undefined}
  data-cinder-required={required || undefined}
  data-variant={variant === 'card' ? 'card' : undefined}
>
  {#if legend}
    <legend class="cinder-radio-group__legend">{legend}</legend>
  {/if}

  <div class="cinder-radio-group__items">
    {@render children()}
  </div>

  {#if description}
    <p id={descriptionId} class="cinder-radio-group__description">{description}</p>
  {/if}

  {#if error}
    <p id={errId} class="cinder-radio-group__error" aria-live="polite">{error}</p>
  {/if}
</fieldset>
