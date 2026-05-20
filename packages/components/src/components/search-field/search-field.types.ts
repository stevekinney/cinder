import type { HTMLInputAttributes } from 'svelte/elements';
/**
 * Props for the SearchField component.
 *
 * Renders an `<input type="search">` with a leading search icon, a clear
 * button that appears only when the field has a value, and an optional
 * `<kbd>` hint badge for a keyboard shortcut. The shortcut itself is not
 * wired by this component — the consumer is responsible for binding it
 * globally.
 *
 * Supports both controlled (`value` + `oninput`) and uncontrolled
 * (`defaultValue`) usage.
 */
export type SearchFieldProps = Omit<
  HTMLInputAttributes,
  'type' | 'value' | 'defaultValue' | 'oninput'
> & {
  /** Stable id for the input element. Required when composing with `FormField`. */
  id?: string;
  /** Controlled value. When provided, the field is fully controlled by the parent. */
  value?: string;
  /** Initial value for uncontrolled usage. Ignored when `value` is provided. */
  defaultValue?: string;
  /** Placeholder text. */
  placeholder?: string;
  /**
   * Optional keyboard shortcut hint (e.g. `'⌘K'`). Rendered as a trailing
   * `<kbd aria-hidden="true">` badge. The shortcut itself is not wired by
   * this component.
   */
  shortcut?: string;
  /** Disables the input and the clear button. */
  disabled?: boolean;
  /** Marks the input as read-only; the clear button becomes inert. */
  readonly?: boolean;
  /** `name` attribute for form submission. */
  name?: string;
  /** Additional class merged with `.cinder-search-field`. */
  class?: string;
  /** Fires on every keystroke with the current value. */
  oninput?: (value: string) => void;
  /** Fires when the native `search` event triggers (Enter or programmatic dispatch). */
  onsearch?: (value: string) => void;
  /** Fires when the clear button is clicked. */
  onclear?: () => void;
};
