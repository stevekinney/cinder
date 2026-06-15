import type { HTMLInputAttributes } from 'svelte/elements';

export type AutocompleteSuggestion = {
  /** Text committed into the input when this suggestion is completed. */
  value: string;
  /** Visible primary label. Defaults to `value` when omitted. */
  label?: string;
  /** Optional secondary text rendered under the label. */
  description?: string;
  /** When true, the suggestion is rendered but cannot be completed. */
  disabled?: boolean;
};

export type AutocompleteSuggestionSourceContext = {
  /** Aborted when a newer query supersedes this request or the component is destroyed. */
  signal: AbortSignal;
};

export type AutocompleteSuggestionSource = (
  query: string,
  context: AutocompleteSuggestionSourceContext,
) => AutocompleteSuggestion[] | Promise<AutocompleteSuggestion[]>;

export type AutocompleteSchemaProps = {
  /** HTML `id` for the underlying input, used to associate the `<label>` and ARIA attributes. */
  id?: string;
  /** Bindable current text value of the input. */
  value?: string;
  suggestionSource?: AutocompleteSuggestionSource;
  /** Visible label text rendered above the input and linked via `for`/`id`. */
  label?: string;
  /** Helper text rendered below the input and associated via `aria-describedby`. */
  description?: string;
  /** Error message rendered below the input; also sets `aria-invalid` on the input. */
  error?: string;
  /** Minimum number of characters the user must type before suggestions are requested. Default `1`. */
  minQueryLength?: number;
  /** Maximum number of suggestions rendered in the listbox at once. Default `50`. */
  maxVisibleSuggestions?: number;
  /** Placeholder text shown inside the input when it is empty. */
  placeholder?: string;
  /** When true, disables the input and prevents interaction, matching the native `disabled` attribute. */
  disabled?: boolean;
  /** Marks the input as required for form validation, matching the native `required` attribute. */
  required?: boolean;
  /** When true, the input value cannot be changed by the user, matching the native `readonly` attribute. */
  readonly?: boolean;
  /** Message shown in the listbox when the suggestion source returns no results. Default `"No suggestions"`. */
  emptyMessage?: string;
  /** Message shown in the listbox while the suggestion source is fetching results. Default `"Loading suggestions"`. */
  loadingMessage?: string;
  /** Additional class names merged onto the root wrapper element. */
  class?: string;
  oninput?: (value: string) => void;
  oncomplete?: (suggestion: AutocompleteSuggestion) => void;
};

export type AutocompleteProps = Omit<
  HTMLInputAttributes,
  | 'type'
  | 'value'
  | 'oninput'
  | 'onchange'
  | 'onkeydown'
  | 'onfocus'
  | 'onblur'
  | 'oncompositionstart'
  | 'oncompositionend'
  | 'disabled'
  | 'required'
  | 'readonly'
  | 'role'
> &
  AutocompleteSchemaProps;
