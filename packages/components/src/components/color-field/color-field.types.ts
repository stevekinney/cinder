/** Accepted *input* color string formats. */
export type ColorFieldFormat = 'hex' | 'rgb' | 'rgba' | 'hsl' | 'hsla' | 'hwb' | 'oklch';

/** Output color format for the emitted/committed value. `lab` is deliberately excluded. */
export type ColorFieldOutputFormat = 'hex' | 'rgb' | 'hsl' | 'hwb' | 'oklch';

/** Props for ColorField. */
export type ColorFieldProps = {
  /** Inner `<input>` id. Required (mirrors Input). */
  id: string;
  /**
   * Bindable value, committed in the syntax the configured `format` prop
   * selects (plain hex by default; modern CSS Color 4 syntax for the other
   * formats — see `format`). Accepts any color string the configured
   * `formats` allow when set externally, regardless of `format`.
   */
  value?: string;
  /**
   * Accept and emit alpha when the parsed value has partial alpha. When
   * `false` (default), alpha-bearing input (`#RRGGBBAA`, `rgba()`,
   * `hsla()`, or a translucent `oklch()`/`hwb()`) is parsed but alpha is
   * stripped on emit, uniformly across every `format` — not a hex-only
   * concern.
   */
  alpha?: boolean;
  /** Accepted *input* formats. Defaults to `['hex', 'rgb', 'hsl', 'hwb']`; rgba/hsla aliases can be restricted independently. Add `'oklch'` to accept `oklch()` input strings. */
  formats?: readonly ColorFieldFormat[];
  /**
   * Output color format for the committed/emitted value. Default `'hex'`.
   * Purely additive — existing consumers relying on the hex default are
   * unaffected. `value` stays a plain string regardless of format. `lab` is
   * deliberately excluded.
   */
  format?: ColorFieldOutputFormat;
  /** Disable the input. */
  disabled?: boolean;
  /** Mark the input as required for form submission and a11y. */
  required?: boolean;
  /** Render the inner `<input>` as read-only. */
  readonly?: boolean;
  /**
   * Form field name. When set, the hidden mirror input contributes the
   * current committed value — in the configured `format`'s syntax — to
   * native form submission.
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
   * Fires on successful blur-time commit when the committed value — in the
   * configured `format`'s syntax — actually changes. Value callback by repo
   * convention — not forwarded to the inner native `<input>`.
   */
  onValueChange?: (value: string) => void;
};
