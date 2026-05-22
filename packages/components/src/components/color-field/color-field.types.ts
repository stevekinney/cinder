import type { HTMLInputAttributes } from 'svelte/elements';

/** Accepted input color string formats for `ColorField`. Output is always hex. */
export type ColorFieldFormat = 'hex' | 'rgb' | 'hsl';

/**
 * Subset of native input attributes that are safe to forward onto the inner
 * `<input>`. Deliberately narrow — we own `id`, `value`, `disabled`, `name`,
 * `class`, and the input event handlers; consumers who need more can wrap with
 * `<form-field>`.
 */
type ForwardedInputAttributes = Pick<
  HTMLInputAttributes,
  | 'required'
  | 'readonly'
  | 'autocomplete'
  | 'autofocus'
  | 'inputmode'
  | 'aria-label'
  | 'aria-labelledby'
>;

/** Props for `ColorField`. */
export type ColorFieldProps = ForwardedInputAttributes & {
  /** Inner `<input>` id. Required (mirrors Input). */
  id: string;
  /**
   * Controlled value. One-way: parent sets, child reads via `onchange`.
   * Not `$bindable` — use `onchange` to observe changes.
   */
  value?: string;
  /** Initial value when uncontrolled. Accepts any allowed `formats` input. */
  defaultValue?: string;
  /**
   * Accept and emit alpha when the parsed alpha is partial. When `false`
   * (default), inputs with alpha (`#RRGGBBAA`, `rgba(...)`, `hsla(...)`) are
   * still accepted but the alpha channel is stripped on emit.
   */
  alpha?: boolean;
  /**
   * Accepted *input* formats. Defaults to all three. Output is always hex.
   * Modern slash-alpha syntax (e.g. `rgb(255 0 0 / 50%)`) is unsupported.
   */
  formats?: readonly ColorFieldFormat[];
  /** Disable the field. */
  disabled?: boolean;
  /**
   * Form field name. When set, a hidden sibling `<input>` mirrors the current
   * committed hex value for native form submission.
   */
  name?: string;
  /** Placeholder text for the inner `<input>`. */
  placeholder?: string;
  /** Additional classes merged onto the outer wrapper (`.cinder-color-field`). */
  class?: string;
  /** Override the default parse-failure error message. */
  errorMessage?: string;
  /**
   * Behavior when the user presses Enter in the field:
   * - `'commit-then-submit'` (default): commit the value, then allow the
   *   form's native submission to proceed (`requestSubmit()`).
   * - `'commit-only'`: commit and `preventDefault()` the submission. Useful
   *   in dialogs / multi-field flows where Enter must not submit the form.
   */
  enterBehavior?: 'commit-then-submit' | 'commit-only';
  /**
   * Fires on a successful blur-time commit when the canonical hex actually
   * changes. The native `change` event from the inner `<input>` is NOT
   * forwarded — only this commit pipeline invokes the callback.
   */
  onchange?: (value: string) => void;
};
