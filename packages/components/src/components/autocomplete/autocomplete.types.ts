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
  id?: string;
  value?: string;
  suggestionSource?: AutocompleteSuggestionSource;
  label?: string;
  description?: string;
  error?: string;
  minQueryLength?: number;
  maxVisibleSuggestions?: number;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  readonly?: boolean;
  emptyMessage?: string;
  loadingMessage?: string;
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
  | 'aria-describedby'
  | 'aria-invalid'
  | 'role'
> &
  AutocompleteSchemaProps;
