import type { Snippet } from 'svelte';
/**
 * A single color entry in a ColorSwatchPicker palette.
 *
 * Supported `color` formats for alpha detection and contrast computation:
 * `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, `rgb(r, g, b)`, `rgba(r, g, b, a)`,
 * `hsl(h, s%, l%)`, `hsla(h, s%, l%, a)` (legacy comma syntax only).
 * Other CSS color formats render via CSS but receive no checkerboard and a
 * best-effort `'white'` contrast indicator that may be invisible on near-white colors.
 */
export type ColorSwatch = {
  /** CSS color string rendered as the swatch background. */
  color: string;
  /** Optional human label. When omitted, the `color` string is the accessible name. */
  name?: string;
  /** Disables this individual swatch. Skipped during keyboard navigation; not selectable. */
  disabled?: boolean;
};
/** Props for ColorSwatchPicker. */
export type ColorSwatchPickerProps = {
  /** Controlled selected color. When provided, the parent owns the state. */
  value?: string;
  /** Initial selected color for uncontrolled use. Ignored when `value` is set. */
  defaultValue?: string;
  /** Palette to render. */
  colors: ColorSwatch[];
  /** Visual shape of each swatch. Default `'circle'`. */
  shape?: 'circle' | 'square';
  /** Swatch dimension token. Default `'md'`. */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /**
   * Layout direction. Default `'grid'`.
   *
   * Note: grid layout uses one-dimensional DOM-order navigation for both
   * ArrowLeft/Right and ArrowUp/Down. True column-aware navigation is not
   * implemented in v1 — see a11y memo.
   */
  layout?: 'grid' | 'stack';
  /** Disables the entire listbox. Keyboard activation and clicks are ignored. */
  disabled?: boolean;
  /**
   * Accessible name for the listbox. Required — `role="listbox"` needs a label
   * so screen readers can announce the control's purpose.
   */
  label: string;
  /** Additional classes merged into the listbox `<ul>`. */
  class?: string;
  /** Fired when the selected swatch changes. */
  onchange?: (color: string) => void;
  /**
   * Snippet that replaces the default check-icon indicator on the selected swatch.
   * Receives the active swatch and the computed contrast color for the icon.
   */
  indicator?: Snippet<[{ swatch: ColorSwatch; contrastColor: 'black' | 'white' }]>;
};
