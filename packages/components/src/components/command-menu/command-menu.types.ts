import type { Snippet } from 'svelte';

import type { PopoverPlacement } from '../popover/popover.types.ts';

export type CommandMenuTriggerMatch = {
  active: true;
  query: string;
  start: number;
  end: number;
};

export type CommandMenuSelection = {
  value: string;
  query: string;
};

export type CommandMenuState = {
  listboxId: string;
  activeItemId: string | null;
};

export type CommandMenuProps = {
  /** Stable listbox id. Defaults to a generated component id. */
  listboxId?: string;
  /** Open state. Bindable. Default `false`. */
  open?: boolean;
  /** Text field used as the caret-position anchor. */
  anchor: HTMLInputElement | HTMLTextAreaElement | null;
  /** Caret offset within the anchor value. */
  caretIndex: number;
  /** Query text after the trigger character. Bindable. Default `''`. */
  query?: string;
  /** Render command items for the current query. */
  items: Snippet<[{ query: string }]>;
  /** Optional empty state rendered after item registration settles. */
  empty?: Snippet;
  /** Caret-relative placement. Default `'bottom-start'`. */
  placement?: PopoverPlacement;
  /** Distance in px between the caret and menu. Default `6`. */
  offset?: number;
  /** Accessible listbox label. Default `'Commands'`. */
  label?: string;
  /** Invoked when an enabled command is activated. */
  onselect?: (detail: CommandMenuSelection) => void;
  /** Invoked when Escape or outside pointerdown dismisses the menu. */
  ondismiss?: () => void;
  /** One-way state output for host-owned field ARIA. */
  onstatechange?: (state: CommandMenuState) => void;
  /** Class merged with `.cinder-command-menu`. */
  class?: string;
};
