import type { Snippet } from 'svelte';

export type ParameterFieldEditorState = {
  /** Id of the visible label. Apply it to the nested control with `aria-labelledby`. */
  labelledBy: string;
  /** Effective value after applying the optional override. */
  value: number;
  /** Whether the effective value comes from an override. */
  overridden: boolean;
  /**
   * Set or replace the local override. Silently does nothing—no override
   * change, no `onOverrideChange` call—if `value` is `NaN` or infinite;
   * this only guards the setter itself, not the externally bindable
   * `override` prop, which accepts and renders a non-finite value as-is.
   * Beyond that guard, `onOverrideChange` fires unconditionally: calling
   * this with the value already stored in `override` still notifies.
   */
  setOverride: (value: number) => void;
};

export type ParameterFieldProps = {
  /** Stable id used for label and output association. */
  id: string;
  /** Visible parameter label. */
  label: string;
  /** Inherited or default numeric value. */
  base: number;
  /** Optional local numeric override. Bindable. */
  override?: number | undefined;
  /** Optional unit appended to the value and reset tooltip. */
  unit?: string | undefined;
  /** Marks the current override as not yet persisted. Defaults to `false`. @default false */
  unsaved?: boolean;
  /** Marks the parameter as experimental. Defaults to `false`. @default false */
  experimental?: boolean;
  /**
   * Called when the component's own `setOverride` (exposed to `children`
   * as `ParameterFieldEditorState.setOverride`) accepts a value, or its
   * built-in reset action runs—not only when either actually changes the
   * override: calling `setOverride` with the value `override` already
   * holds still notifies. `setOverride` rejecting a `NaN`/infinite value
   * is the one case where nothing happens: no override change, no call
   * here—see that function. Not called when a parent changes the
   * bindable `override` prop programmatically—that update is not
   * distinguishable here from the component's own writes.
   */
  onOverrideChange?: (value: number | undefined) => void;
  /** Optional custom numeric editor. Receives the effective value and override setter. */
  children?: Snippet<[ParameterFieldEditorState]>;
  /** Additional class merged with `.cinder-parameter-field`. */
  class?: string;
};
