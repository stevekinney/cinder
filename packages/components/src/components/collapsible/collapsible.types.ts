import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

/** State passed to a trigger snippet so labels can react to open/disabled. */
export type CollapsibleTriggerState = { open: boolean; disabled: boolean };

export type CollapsibleProps = Omit<HTMLAttributes<HTMLDivElement>, 'class' | 'children'> & {
  /** Trigger label: a plain string, or a snippet receiving `{ open, disabled }`. */
  trigger: string | Snippet<[CollapsibleTriggerState]>;
  /** Panel content shown when open. */
  children: Snippet;
  /**
   * Bindable open state. Without `bind:open`, this is the initial value and the
   * component manages subsequent toggles. With `bind:open`, the parent owns it.
   * @default false
   */
  open?: boolean;
  /** Fired on every toggle with the next open state. */
  onToggle?: (open: boolean) => void;
  /**
   * When true, the trigger cannot be toggled.
   * @default false
   */
  disabled?: boolean;
  /**
   * Base used to derive the trigger and panel ARIA ids (`<base>-header`,
   * `<base>-panel`). NOT the root element id. Auto-generated when omitted.
   */
  idBase?: string;
  /** Additional classes merged onto the root element. */
  class?: string;
};

export interface CollapsibleSchemaProps {
  /** Trigger label text. */
  trigger: string;
  /**
   * Bindable open state. Without binding, the initial value the component then
   * manages.
   * @default false
   */
  open?: boolean;
  /**
   * When true, the trigger cannot be toggled.
   * @default false
   */
  disabled?: boolean;
  /** Base used to derive the trigger and panel ARIA ids. Auto-generated when omitted. */
  idBase?: string;
  /** Additional classes merged onto the root element. */
  class?: string;
}
