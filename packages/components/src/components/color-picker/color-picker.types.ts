/** Props for ColorPicker. */
export type ColorPickerProps = {
  /**
   * Bindable value. Reading the value yields a hex string (`#rrggbb`, or
   * `#rrggbbaa` when `alpha` is true). Setting the value accepts hex, `rgb()`,
   * `rgba()`, `hsl()`, or `hsla()` input; invalid input is normalized to `''`.
   */
  value?: string;
  /** Initial color when `value` is not bound. Same input formats as `value`. */
  defaultValue?: string;
  /** Enable the alpha slider and emit `#rrggbbaa`. Default `false`. */
  alpha?: boolean;
  /** Form field name. When set, a hidden input mirrors the current value for form submission. */
  name?: string;
  /** Optional palette of preset colors rendered below the picker. */
  swatches?: string[];
  /** Disable interaction across the picker. */
  disabled?: boolean;
  /** Additional classes merged onto the root element. */
  class?: string;
  /** Accessible label for the picker. Default `'Color picker'`. */
  label?: string;
  /** Fired on commit (pointer up, swatch click, slider key). */
  onchange?: (color: string) => void;
  /** Fired on every intermediate update (drag, slider key, swatch click). */
  oninput?: (color: string) => void;
};
