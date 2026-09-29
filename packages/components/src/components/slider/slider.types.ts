/** Single-value or `[min, max]` tuple. */
export type SliderValue = number | [number, number];
/** Mode of the slider — `single` thumb or two-thumb `range`. */
export type SliderMode = 'single' | 'range';
type SliderBaseProps = {
  /** Minimum value. Default `0`. */
  min?: number;
  /** Maximum value. Default `100`. */
  max?: number;
  /** Step increment for arrow keys. Default `1`. Must be a positive finite number. */
  step?: number;
  /** Step increment for Page Up/Down. Default `step * 10`. */
  pageStep?: number;
  /** Visible label / accessible name for the slider. Required. */
  label: string;
  /** Formats the numeric value for `aria-valuetext`. */
  valueText?: (value: number) => string;
  /** Optional unit displayed with the current value, such as `%` or `ms`. */
  unit?: string;
  /** Optional tick marks. `true` renders one per `step`; an array snaps to those values. */
  ticks?: boolean | number[];
  /** Disables interaction. */
  disabled?: boolean;
  /** Form field name. Renders hidden inputs for form submission. */
  name?: string;
  /** Extra class names merged with `.cinder-slider`. */
  class?: string;
  /**
   * Whether the header row renders the visible label span. Default `true`.
   * Hides only the label — the visible value text always stays, with no
   * layout gap left behind — and never affects the thumbs' accessible
   * names, which come from `label` regardless.
   *
   * This composes with, rather than replaces, the automatic label
   * suppression a Slider already performs inside `<FormField>` (the field
   * owns the label there via `aria-labelledby`, so Slider's own label span
   * is omitted independent of this prop). Setting `headerVisible={false}`
   * inside a FormField is a no-op for the label — it's already hidden —
   * but still governs the value span the same way it does standalone.
   */
  headerVisible?: boolean;
};
/**
 * Props for the single-thumb slider. `value` is a scalar and `onValueChange`
 * receives a scalar.
 */
export type SliderSingleProps = SliderBaseProps & {
  /** Slider mode. `"single"` renders one thumb and emits a scalar value; `"range"` renders two thumbs and emits a `[low, high]` tuple. Default `"single"`. */
  mode?: 'single';
  value?: number;
  onValueChange?: (value: number) => void;
  /**
   * Formats the visible value text shown in the header. Replaces only the
   * value display — the `valueText` ARIA formatter is untouched. Absent a
   * formatter, the value renders with the current unit-based formatting.
   */
  displayValue?: (value: number) => string;
};
/**
 * Props for the two-thumb range slider. `value` is a `[low, high]` tuple and
 * `onValueChange` receives the same tuple shape.
 */
export type SliderRangeProps = SliderBaseProps & {
  /** Slider mode. `"single"` renders one thumb and emits a scalar value; `"range"` renders two thumbs and emits a `[low, high]` tuple. Default `"single"`. */
  mode: 'range';
  value?: [number, number];
  onValueChange?: (value: [number, number]) => void;
  /**
   * Formats the visible value text shown in the header from the full
   * `[low, high]` tuple (for example, `'0–22'` or `'7 notes · C4–B4'`).
   * Replaces only the value display — the per-thumb `valueText` ARIA
   * formatter is untouched. Absent a formatter, the value renders with the
   * current unit-based formatting joined by an en dash.
   */
  displayValue?: (value: [number, number]) => string;
};
/**
 * Props for the Slider component.
 *
 * Implements the WAI-ARIA `role="slider"` pattern. Each thumb is its own
 * focusable `<div role="slider">` carrying `aria-valuemin`, `aria-valuemax`,
 * `aria-valuenow`, optional `aria-valuetext`, and an accessible name from
 * either `aria-label` or `aria-labelledby`.
 *
 * `value` is bindable. `onValueChange` fires after every committed change
 * (keyboard step, track click, end of pointer drag).
 *
 * Distinct from `progress.svelte` (passive read-only progress) and from
 * the internal sliders inside `color-picker.svelte` (specialized for
 * color manipulation).
 */
export type SliderProps = SliderSingleProps | SliderRangeProps;
