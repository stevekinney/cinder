import type { HTMLInputAttributes } from 'svelte/elements';

/**
 * Character set accepted by `<PinInput>`. `'numeric'` accepts only ASCII
 * digits; `'alphanumeric'` accepts ASCII letters and digits.
 */
export type PinInputMode = 'numeric' | 'alphanumeric';

/**
 * Props for `<PinInput>`. Renders a segmented one-time-code input with
 * auto-advance, paste distribution, and optional masking. `value` is a
 * bindable string capped at `length` characters and filtered to the
 * configured `mode`.
 */
export type PinInputProps = {
  /** Stable id used as the segment id prefix and as the hidden input id. */
  id: string;
  /**
   * Bindable code value. Defaults to an empty string.
   *
   * **No write-back normalization.** The bound prop reflects exactly what the
   * consumer set — it is NOT mutated back to the filtered/length-capped value.
   * The displayed and submitted value is normalized via `$derived`, but the
   * binding itself is left untouched. This is intentional: the consumer owns
   * the source of truth, and silent mutation of a bound prop is a surprising
   * side-effect.
   */
  value?: string;
  /**
   * Number of segments to render. Normalized to an integer in `[1, 12]`;
   * non-finite or out-of-range values fall back to `6`.
   */
  length?: number;
  /** Character set accepted in each segment. Defaults to `'numeric'`. */
  mode?: PinInputMode;
  /** Render segments as password-style fields without changing the emitted value. */
  masked?: boolean;
  /** Visible group label rendered above the segments. */
  label?: string;
  /** Visually hide the rendered `label` while keeping it programmatically associated. */
  hideLabel?: boolean;
  /** Group accessible name when no visible `label` is supplied. */
  'aria-label'?: string;
  /** Space-separated list of ids that label the group when no `label` is supplied. */
  'aria-labelledby'?: string;
  /** Optional description text rendered below the segments. */
  description?: string;
  /** Optional error message; sets `aria-invalid="true"` on every segment. */
  error?: string;
  /** Disable every segment and the hidden input. */
  disabled?: boolean;
  /** Mark the group as required for assistive technology. */
  required?: boolean;
  /** Form-control name applied to the hidden `<input>` that submits with the form. */
  name?: string;
  /**
   * `autocomplete` value applied to the first segment. Defaults to
   * `'one-time-code'` so iOS and Android can autofill SMS codes.
   */
  autocomplete?: HTMLInputAttributes['autocomplete'];
  /** Extra class names appended to the root group element. */
  class?: string;
  /**
   * Fires only for user-initiated committed value changes (typing, paste,
   * autofill, backspace). Never fires for external prop synchronization.
   */
  onchange?: (value: string) => void;
};
