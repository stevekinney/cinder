import type { Snippet } from 'svelte';
export type CommandPaletteProps = {
  /**
   * Bindable open state. The component mutates `open = false` on Escape,
   * backdrop click, or any explicit close path, then fires `onclose`.
   */
  open: boolean;
  /** Placeholder rendered inside the search input. */
  placeholder?: string;
  /** Accessible name for the dialog, wired via `aria-label`. */
  label?: string;
  /**
   * Bindable search query. Mutated by the input's oninput handler.
   * Exposed to the items snippet so consumers can filter.
   * Note: query is NOT reset on close — consumers who want a fresh query on
   * each open should reset it in their `onclose` callback.
   */
  query?: string;
  /** Fired after any close path routed through the palette close lifecycle. */
  onclose?: () => void;
  /** Element to restore focus to on close. Falls back to `captureFocus()`. */
  triggerRef?: HTMLElement | null;
  /** Receives the current query so consumers can filter. */
  items: Snippet<[{ query: string }]>;
  /** Rendered when zero items are registered after filtering. */
  empty?: Snippet;
  /** Optional footer, e.g. for keybinding hints. Not part of the listbox. */
  footer?: Snippet;
  /** Class merged onto the palette panel. */
  class?: string;
};
