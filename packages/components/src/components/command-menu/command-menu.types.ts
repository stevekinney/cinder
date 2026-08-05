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

/**
 * Emitted when the user accepts inline ghost-text completion (see
 * `command-menu.a11y.md`). `remainder` is the exact substring the ghost span
 * rendered (`value.slice(query.length)`, cased as the active item's raw
 * `value`) — hosts should append it at the caret rather than replacing the
 * whole typed token with `value`, which would silently normalize the user's
 * typed casing.
 */
export type CommandMenuCompletion = {
  /** The active item's full raw value the completion was drawn from. */
  value: string;
  /** The query text as it was at the moment of acceptance. */
  query: string;
  /** `value.slice(query.length)` — append this at the caret. */
  remainder: string;
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
  /**
   * Caret offset within the anchor value. Optional — when omitted, it's
   * derived from the anchor's live `selectionEnd`. Consumers that already
   * track trigger-relative caret state (e.g. from `detectTrigger`) may keep
   * passing it explicitly; the derivation exists for hosts that don't need
   * anything more precise than "where the caret currently is."
   */
  caretIndex?: number;
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
  onSelect?: (detail: CommandMenuSelection) => void;
  /**
   * Invoked when the user accepts inline ghost-text completion. Passing this
   * prop is what enables the feature — omit it and no ghost text ever
   * renders. See `command-menu.a11y.md` for the full keyboard model.
   */
  onComplete?: (detail: CommandMenuCompletion) => void;
  /** Invoked when Escape or outside pointerdown dismisses the menu. */
  onDismiss?: () => void;
  /** One-way state output for host-owned field ARIA. */
  onStateChange?: (state: CommandMenuState) => void;
  /** Class merged with `.cinder-command-menu`. */
  class?: string;
};
