import type { Snippet } from 'svelte';

export type ParameterFieldEditorState = {
  /** Id of the visible label. Apply it to the nested control with `aria-labelledby`. */
  labelledBy: string;
  /** Effective value after applying the optional override. */
  value: number;
  /** Whether the effective value comes from an override. */
  overridden: boolean;
  /** Set or replace the local override. */
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
  /** Marks the current override as not yet persisted. */
  unsaved?: boolean;
  /** Marks the parameter as experimental. */
  experimental?: boolean;
  /** Called when the override changes or is reset. */
  onOverrideChange?: (value: number | undefined) => void;
  /** Optional custom numeric editor. Receives the effective value and override setter. */
  children?: Snippet<[ParameterFieldEditorState]>;
  /** Additional class merged with `.cinder-parameter-field`. */
  class?: string;
};
