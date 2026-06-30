import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

/** State passed to a trigger snippet so labels can react to open/disabled. */
export type CollapsibleTriggerState = { open: boolean; disabled: boolean };

export type CollapsibleProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  'class' | 'children' | 'ontoggle'
> & {
  /** Trigger label: a plain string, or a snippet receiving `{ open, disabled }`. */
  trigger: string | Snippet<[CollapsibleTriggerState]>;
  /** Panel content shown when open. */
  children: Snippet;
  /**
   * Bindable open state. Without `bind:open`, this seeds local state and can be
   * updated by parent prop changes, while trigger clicks update local state.
   * Use `bind:open` for full parent/trigger synchronization.
   * @default false
   */
  open?: boolean;
  /** Fired on every successful toggle with the next open state. Not called while disabled. */
  ontoggle?: (open: boolean) => void;
  /**
   * When true, the trigger cannot be toggled.
   * @default false
   */
  disabled?: boolean;
  /**
   * Accessible name override for the internal trigger button. Accepts either a
   * fixed string or a function receiving `{ open, disabled }` so labels can
   * react without requiring `bind:open`.
   */
  triggerAriaLabel?: string | ((state: CollapsibleTriggerState) => string);
  /**
   * Base used to derive the trigger and panel ARIA ids (`<base>-header`,
   * `<base>-panel`). NOT the root element id. Auto-generated when omitted.
   */
  idBase?: string;
  /** Additional classes merged onto the root element. */
  class?: string;
};

/**
 * Schema-generator surface. `trigger` is documented as a string only: the
 * `Snippet` form of the runtime prop is a template-only construct that JSON
 * Schema cannot represent, so schema-driven tooling sees the string variant.
 */
export interface CollapsibleSchemaProps {
  /** Trigger label text. (The snippet form is template-only; see the type above.) */
  trigger: string;
  /**
   * Bindable open state. Without `bind:open`, this seeds local state and can be
   * updated by parent prop changes. Use `bind:open` for full parent/trigger
   * synchronization.
   * @default false
   */
  open?: boolean;
  /**
   * When true, the trigger cannot be toggled.
   * @default false
   */
  disabled?: boolean;
  /**
   * Accessible name override for the trigger button. The runtime prop also
   * accepts a state-aware function (`{ open, disabled } => string`), but JSON
   * Schema can only model the string variant.
   */
  triggerAriaLabel?: string;
  /** Base used to derive the trigger and panel ARIA ids. Auto-generated when omitted. */
  idBase?: string;
  /** Additional classes merged onto the root element. */
  class?: string;
}
