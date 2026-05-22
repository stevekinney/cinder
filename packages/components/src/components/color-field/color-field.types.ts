import type { HTMLInputAttributes } from 'svelte/elements';

/** Accepted input formats for `ColorField`. Output is always hex regardless. */
export type ColorFieldFormat = 'hex' | 'rgb' | 'hsl';

/**
 * Subset of native input attributes safe to forward onto the underlying
 * `<input>`. Deliberately narrow — `value`, `id`, `class`, `disabled`, `name`,
 * `placeholder`, and event handlers are owned by `ColorField` and excluded from
 * this passthrough.
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
  /** Stable id applied to the inner `<input>`. Required (mirrors `Input`). */
  id: string;
  /**
   * Controlled value. One-way: parent passes, child reads. NOT `$bindable`;
   * pair with `onchange`. Reading the value yields a canonical hex string
   * (`#rrggbb`, or `#rrggbbaa` when `alpha={true}` and `a < 1`).
   */
  value?: string;
  /** Initial value when uncontrolled. Accepts any of the allowed `formats`. */
  defaultValue?: string;
  /**
   * Accept and emit alpha when partial. When `false` (default), `#rrggbbaa`
   * is accepted on input but the alpha byte is stripped on emit.
   */
  alpha?: boolean;
  /**
   * Accepted *input* formats. Defaults to `['hex', 'rgb', 'hsl']`. Output is
   * always hex.
   */
  formats?: readonly ColorFieldFormat[];
  /** Disable the input. */
  disabled?: boolean;
  /**
   * Form field name. When set, a hidden sibling `<input>` mirrors the current
   * committed canonical hex for form submission. The hidden input renders an
   * empty value while a parse error is active so external submits do not send
   * a stale prior value.
   */
  name?: string;
  /** Placeholder text for the inner `<input>`. */
  placeholder?: string;
  /** Additional classes merged onto the outer wrapper (`.cinder-color-field`). */
  class?: string;
  /** Override the default parse-failure error message. */
  errorMessage?: string;
  /**
   * Commit-on-Enter behavior. Default `'commit-then-submit'`:
   * - `'commit-then-submit'`: Enter commits, then calls `requestSubmit` on
   *   the associated form for any non-failure outcome.
   * - `'commit-only'`: Enter commits but never submits, regardless of outcome.
   */
  enterBehavior?: 'commit-then-submit' | 'commit-only';
  /** Fires on a successful blur or Enter commit when the canonical hex changes. */
  onchange?: (value: string) => void;
};
