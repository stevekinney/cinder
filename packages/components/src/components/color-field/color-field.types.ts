/** Accepted *input* color string formats. Output is always hex. */
export type ColorFieldFormat = 'hex' | 'rgb' | 'hsl';

/** Props for ColorField. */
export type ColorFieldProps = {
  /** Inner `<input>` id. Required (mirrors Input). */
  id: string;
  /**
   * Controlled value as a hex string. One-way: parent sets, child reads.
   * Not bindable — use `onchange` to observe commits. Accepts any color
   * string the configured `formats` allow when set externally.
   */
  value?: string;
  /** Initial value when uncontrolled. Accepts any allowed `formats` input. */
  defaultValue?: string;
  /**
   * Accept and emit alpha when the parsed value has partial alpha. When
   * `false` (default), `#RRGGBBAA` and `rgba()`/`hsla()` inputs are parsed
   * but alpha is stripped on emit.
   */
  alpha?: boolean;
  /** Accepted *input* formats. Defaults to `['hex', 'rgb', 'hsl']`. Output is always hex. */
  formats?: readonly ColorFieldFormat[];
  /** Disable the input. */
  disabled?: boolean;
  /** Mark the input as required for form submission and a11y. */
  required?: boolean;
  /** Render the inner `<input>` as read-only. */
  readonly?: boolean;
  /**
   * Form field name. When set, the hidden mirror input contributes the current
   * committed hex value to native form submission.
   */
  name?: string;
  /** Placeholder text for the inner `<input>`. */
  placeholder?: string;
  /** Accessible label applied directly to the inner `<input>` when no `FormField` wraps it. */
  'aria-label'?: string;
  /** Id of an external element that labels the inner `<input>`. */
  'aria-labelledby'?: string;
  /** Additional classes merged onto the **outer wrapper** root (`.cinder-color-field`). */
  class?: string;
  /** Override the default parse-failure error message. */
  errorMessage?: string;
  /**
   * Commit-on-Enter behavior. Default `'commit-then-submit'`:
   *   - `'commit-then-submit'`: Enter commits the value, then lets the form's
   *     native submission proceed via `requestSubmit`.
   *   - `'commit-only'`: Enter commits and `preventDefault()`s, suppressing
   *     form submission (useful in dialogs / multi-field flows where Enter
   *     must not submit).
   */
  enterBehavior?: 'commit-then-submit' | 'commit-only';
  /**
   * Fires on successful blur-time commit when the canonical hex actually
   * changes. Value callback by repo convention — not forwarded to the inner
   * native `<input>`.
   */
  onchange?: (value: string) => void;
};
