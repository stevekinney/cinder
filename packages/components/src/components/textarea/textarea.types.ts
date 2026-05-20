import type { HTMLTextareaAttributes } from 'svelte/elements';
export type TextareaProps = HTMLTextareaAttributes & {
  /** Unique identifier — required for label association and ARIA wiring. */
  id: string;
  /** Bound value of the textarea. */
  value?: string;
  /** Visible label rendered in a `<label>` element associated via `for`. */
  label?: string;
  /** Helper text displayed below the textarea; wired via `aria-describedby`. */
  description?: string;
  /** Validation error message; sets `aria-invalid="true"` and `aria-describedby`. */
  error?: string;
  /** Number of visible text rows. Defaults to 4. */
  rows?: number;
  /** Disables the textarea. */
  disabled?: boolean;
  /** Extra class names merged with `.cinder-textarea`. */
  class?: string;
  /**
   * When `true` AND `maxlength` is set, renders a live character counter
   * (`{value.length}/{maxlength}`) below the textarea. The counter element
   * is wired into `aria-describedby` so screen readers announce it as part
   * of the field's description, and it is also placed inside an
   * `aria-live="polite"` region so updates are announced as the user types.
   */
  showCount?: boolean;
};
