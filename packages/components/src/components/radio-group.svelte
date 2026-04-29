<script lang="ts" module>
  import type { Snippet } from 'svelte';

  /** Symbol key for the radio-group Svelte context. */
  export const RADIO_GROUP_CONTEXT_KEY = Symbol('cinder-radio-group');

  /**
   * Shape of the context object provided to Radio children. Children read
   * the current group `value`, the shared `name`, and `disabled` / `invalid`
   * state, and call `select(value)` when the user activates a radio.
   */
  export type RadioGroupContext = {
    readonly name: string;
    readonly value: string;
    readonly disabled: boolean;
    readonly invalid: boolean;
    select: (next: string) => void;
  };

  /**
   * Props for the RadioGroup component.
   *
   * The group owns the bound `value`, the shared `name`, the disabled/invalid
   * states, and the description/error/legend wrapper. Each child Radio
   * derives its own `checked` state from the group value.
   */
  export type RadioGroupProps = {
    /** Bound selected value. */
    value?: string;
    /** Shared `name` for all radios in the group; required for native form submission. */
    name: string;
    /** Optional legend rendered as a `<legend>` inside the `<fieldset>`. */
    legend?: string;
    /** Helper text displayed below the group; wired via `aria-describedby` on the fieldset. */
    description?: string;
    /** Validation error message; sets `aria-invalid="true"` on the group's children. */
    error?: string;
    /** Disables the entire group. */
    disabled?: boolean;
    /** When true, marks the group's radios as required for form submission. */
    required?: boolean;
    /** Additional class names merged with `.cinder-radio-group`. */
    class?: string;
    /** Radio children. */
    children: Snippet;
  };
</script>

<script lang="ts">
  import { setContext } from 'svelte';

  import {
    ariaInvalid,
    composeDescribedBy,
    describeId,
    errorId as buildErrorId,
  } from '../_internal/field-control.ts';
  import { cn } from '../utilities/class-names.ts';
  import { useId } from '../utilities/use-id.ts';

  let {
    value = $bindable(''),
    name,
    legend,
    description,
    error,
    disabled = false,
    required = false,
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
