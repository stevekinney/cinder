export type MultiSelectItem<T extends string = string> = {
  /** Submitted/stored identifier. */
  id: T;
  /** Visible option label. */
  label: string;
  /** Optional secondary line shown under the label. */
  description?: string;
  /** Non-selectable option row. */
  disabled?: boolean;
};

export type MultiSelectSelectionFeedback = 'top' | 'fixed' | 'top-after-reopen';

export type MultiSelectDirection = 'down' | 'up';

export type MultiSelectProps<T extends string = string> = {
  /** Unique identifier — required for label association and ARIA wiring. */
  id: string;
  /** Full option set. The sole inference source for T. */
  items: readonly MultiSelectItem<T>[];
  /** Bindable selected IDs. */
  selectedIds?: NoInfer<T>[];
  /** Native form field name. Emits one hidden input per selected id. */
  name?: string;
  /** Visible label rendered in a `<label>` associated via `for`. */
  label?: string;
  /** Placeholder text when nothing is selected. */
  placeholder?: string;
  /** Helper text displayed below the trigger; wired via aria-describedby. */
  description?: string;
  /** Validation error message; styles the trigger as invalid and wires aria-describedby. */
  error?: string;
  /** Warning text rendered below the control and included in aria-describedby. */
  warning?: string;
  /** Disables the control. Inherited from a wrapping FormField when unset. */
  disabled?: boolean;
  /** Prevents changing selection while still allowing viewing current selections. */
  readonly?: boolean;
  /** Marks the field required and shows the required marker on the label. */
  required?: boolean;
  /** Enables the filter input rendered above the options list. */
  filterable?: boolean;
  /** Custom option filter callback. Defaults to case-insensitive label/description matching. */
  filterItem?: (item: MultiSelectItem<T>, query: string) => boolean;
  /** Selected-option ordering behavior when the menu is open. */
  selectionFeedback?: MultiSelectSelectionFeedback;
  /** Open direction for the floating panel. */
  direction?: MultiSelectDirection;
  /** Additional class names merged with `.cinder-multi-select`. */
  class?: string;
  /** External id(s) composed into aria-describedby. */
  'aria-describedby'?: string;
};
