/** Output color format for the emitted/committed value. `lab` is deliberately excluded. */
export type ColorPickerFormat = 'hex' | 'rgb' | 'hsl' | 'hwb' | 'oklch';

/** Props for ColorPicker. */
export type ColorPickerProps = {
  /**
   * Bindable value. Reading the value yields a string in the configured
   * `format` (`#rrggbb`/`#rrggbbaa` for the `'hex'` default, or modern
   * space-separated CSS Color 4 syntax with slash alpha for the others).
   * Setting the value accepts hex, `rgb()`, `rgba()`, `hsl()`, `hsla()`,
   * `hwb()`, or `oklch()` input, in either legacy comma syntax or modern
   * space-separated syntax — including whatever this component's own
   * `format` emits, so an emitted value always parses back; invalid input
   * is normalized to `''`. Mounting does NOT normalize this prop itself —
   * a non-canonical `value` you pass in (short hex, legacy comma syntax, a
   * syntax mismatched with `format`) is left exactly as you passed it until
   * the first user-driven commit, which writes the fully normalized string
   * back. Only the rendered hidden form-mirror input is normalized at mount.
   */
  value?: string;
  /**
   * Show the alpha slider. Default `false`. Per the CIN-104 ruling this is a
   * UI-affordance concern, not a value-mutation switch:
   *
   * - A translucent `value` passed in programmatically (the initial `value`,
   *   a later controlled update, or a native form reset) keeps its alpha
   *   exactly as parsed, whether or not `alpha` is true — disabling the
   *   slider alone never strips it.
   * - An *interactively* produced alpha (set by dragging the alpha slider
   *   while it was visible) re-gates to fully opaque on the next
   *   user-driven commit — any pointer drag, keyboard nudge, or swatch
   *   selection — once `alpha` is false and the slider is gone. This is what
   *   prevents a hidden, un-editable translucency from persisting forever
   *   once the affordance to see or change it is removed.
   *
   * This gate is uniform across every `format` — it is not a hex-only
   * concern. Independently of `alpha`, a non-hex `format`'s alpha-emission
   * syntax (the `/ a` segment) only appears when the resulting alpha is
   * actually below 1.
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
