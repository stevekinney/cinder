import type { Snippet } from 'svelte';
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
  /** Visual layout. 'card' wraps each radio row in a bordered surface. */
  variant?: 'default' | 'card';
  /** Additional class names merged with `.cinder-radio-group`. */
  class?: string;
  /** Radio children. */
  children: Snippet;
};
