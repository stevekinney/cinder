/**
 * One option in a Combobox.
 */
export type ComboboxOption<T extends string = string> = {
  /** Submitted value. */
  value: T;
  /** Visible label (primary line). */
  label: string;
  /** Optional secondary description rendered beneath the label inside the option. */
  description?: string;
  /**
   * Optional avatar image URL rendered to the left of the label.
   * The avatar is decorative — its alt text is empty because the
   * option's accessible name already includes the label.
   */
  avatar?: string;
  /** When true, the option is non-selectable. */
  disabled?: boolean;
};

/**
 * Props for the Combobox component.
 *
 * v1 scope (deliberately small):
 * - Single-select only.
 * - Synchronous local filtering — consumer supplies a `filter` callback,
 *   or the default substring-on-label match runs.
 * - No async / remote loading; no debounced fetch.
 * - No virtualization. Visible options are capped at 200; consumers with
 *   larger lists must paginate or pre-filter externally.
 * - No multi-select, no token chips, no "create new" / free-text submission.
 *
 * Bigger Combobox patterns will live as separate components or as an
 * extension once consumer needs justify them.
 */
export type ComboboxProps<T extends string = string> = {
  /** Unique identifier — required for label association and ARIA wiring. */
  id: string;
  /** Currently selected value. Bindable. `''` when nothing is selected. */
  value?: NoInfer<T> | '';
  /** Free-text input value (the text the user has typed). Bindable. */
  inputValue?: string;
  /** Full set of options to filter. The sole inference source for T. */
  options: readonly ComboboxOption<T>[];
  /** Visible label rendered in a `<label>` associated via `for`. */
  label?: string;
  /** Placeholder when no value is selected. */
  placeholder?: string;
  /**
   * Custom synchronous filter. Receives an option and the current input
   * value; returns true to keep. Defaults to case-insensitive substring
   * match on label.
   */
  filter?: (option: ComboboxOption<NoInfer<T>>, query: string) => boolean;
  /** Helper text displayed below the input; wired via aria-describedby. */
  description?: string;
  /** Validation error message; sets aria-invalid="true". */
  error?: string;
  /** Disables the combobox. */
  disabled?: boolean;
  /** Hard cap on visible filtered options. Default 200. */
  maxVisibleOptions?: number;
  /**
   * External element id(s) to compose into `aria-describedby`. Composed
   * after the component-generated description and error ids, matching the
   * field-control contract in Select. Useful for tooltip ids, counter ids,
   * or any external hint.
   */
  'aria-describedby'?: string;
  /** Additional class names merged with `.cinder-combobox`. */
  class?: string;
};
