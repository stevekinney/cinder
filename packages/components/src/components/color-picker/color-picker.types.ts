/** Output color format for the emitted/committed value. `lab` is deliberately excluded. */
export type ColorPickerFormat = 'hex' | 'rgb' | 'hsl' | 'hwb' | 'oklch';

/** Props for ColorPicker. */
export type ColorPickerProps = {
  /**
   * Bindable value. Reading the value yields a string in the configured
   * `format` (`#rrggbb`/`#rrggbbaa` for the `'hex'` default, or modern
   * space-separated CSS Color 4 syntax with slash alpha for the others).
   * Setting the value accepts hex, `rgb()`, `rgba()`, `hsl()`, `hsla()`, or
   * `hwb()` input; invalid input is normalized to `''`.
   */
  value?: string;
  /**
   * Show the alpha slider. When `false` (default), a parsed input's alpha
   * channel is forced fully opaque. This gate is uniform across every
   * `format` — it is not a hex-only concern. Independently of `alpha`, a
   * non-hex `format`'s alpha-emission syntax (the `/ a` segment) only
   * appears when the resulting alpha is actually below 1.
   */
  alpha?: boolean;
  /**
   * Output color format for the committed/emitted value. Default `'hex'`.
   * Purely additive — existing consumers relying on the hex default are
   * unaffected. `value` stays a plain string regardless of format.
   */
  format?: ColorPickerFormat;
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
  onValueCommit?: (color: string, reason: 'pointer' | 'swatch' | 'keyboard') => void;
  /** Fired on every intermediate update (drag, slider key, swatch click). */
  onValueChange?: (color: string) => void;
};
