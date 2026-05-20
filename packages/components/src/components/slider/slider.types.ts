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
  /** Optional tick marks. `true` renders one per `step`; an array snaps to those values. */
  ticks?: boolean | number[];
  /** Disables interaction. */
  disabled?: boolean;
  /** Form field name. Renders hidden inputs for form submission. */
  name?: string;
  /** Extra class names merged with `.cinder-slider`. */
  class?: string;
};
/**
 * Props for the single-thumb slider. `value`/`defaultValue` are scalars and
 * `onchange` receives a scalar.
 */
export type SliderSingleProps = SliderBaseProps & {
  mode?: 'single';
  value?: number;
  defaultValue?: number;
  onchange?: (value: number) => void;
};
/**
 * Props for the two-thumb range slider. `value`/`defaultValue` are `[low, high]`
 * tuples and `onchange` receives the same tuple shape.
 */
export type SliderRangeProps = SliderBaseProps & {
  mode: 'range';
  value?: [number, number];
  defaultValue?: [number, number];
  onchange?: (value: [number, number]) => void;
};
/**
 * Props for the Slider component.
 *
 * Implements the WAI-ARIA `role="slider"` pattern. Each thumb is its own
 * focusable `<div role="slider">` carrying `aria-valuemin`, `aria-valuemax`,
 * `aria-valuenow`, optional `aria-valuetext`, and an accessible name from
 * either `aria-label` or `aria-labelledby`.
 *
 * The slider is controlled when `value` is supplied and uncontrolled when
 * only `defaultValue` is supplied. `onchange` fires after every committed
 * change (keyboard step, track click, end of pointer drag).
 *
 * Distinct from `progress.svelte` (passive read-only progress) and from
 * the internal sliders inside `color-picker.svelte` (specialized for
 * color manipulation).
 */
export type SliderProps = SliderSingleProps | SliderRangeProps;
