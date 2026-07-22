import type { HTMLTextareaAttributes } from 'svelte/elements';

export type JsonEditorProps = Omit<
  HTMLTextareaAttributes,
  'id' | 'value' | 'class' | 'onchange' | 'oninput'
> & {
  /** Unique identifier used for the label and feedback relationships. */
  id: string;
  /** Controlled JSON source text. */
  value: string;
  /** Visible label associated with the native textarea. */
  label: string;
  /** Supporting text announced with the editor. */
  description?: string;
  /** External validation error. Takes precedence over JSON parse feedback. */
  error?: string;
  /** Number of visible text rows. Defaults to 8. */
  rows?: number;
  /** Whether valid JSON should render an announced success message. Defaults to true. */
  showValidFeedback?: boolean;
  /** Called with the proposed JSON source whenever the user edits the textarea. */
  onchange?: (value: string) => void;
  /** Extra class names merged onto the field wrapper. */
  class?: string;
};
