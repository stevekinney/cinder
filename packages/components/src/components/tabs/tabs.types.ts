import type { Snippet } from 'svelte';
/** Orientation of the tab list. */
export type TabsOrientation = 'horizontal' | 'vertical';
/**
 * Shape of the context object provided to Tab and TabPanel children.
 *
 * `register` lets each Tab announce itself to the parent during mount so
 * the parent can drive arrow-key navigation (focus management requires the
 * parent to know each tab's element). `unregister` removes the entry on
 * unmount. `setDisabled` is kept independent of registration so toggling
 * the disabled flag at runtime does not perturb the registration order
 * (which is the navigation order — re-inserting a Map key moves it to the
 * end).
 */
export type TabsContext = {
  readonly value: string;
  readonly orientation: TabsOrientation;
  readonly activateOnFocus: boolean;
  select: (next: string) => void;
  isActive: (candidate: string) => boolean;
  register: (value: string, button: HTMLButtonElement) => void;
  unregister: (value: string) => void;
  setDisabled: (value: string, disabled: boolean) => void;
  handleKeydown: (event: KeyboardEvent) => void;
};
export type TabsProps = {
  /** Bound active tab value. */
  value?: string;
  /** Layout orientation. Affects which arrow keys move between tabs. */
  orientation?: TabsOrientation;
  /**
   * When true (default for horizontal), focusing a tab also activates it
   * (the panel updates immediately). Vertical defaults to manual activation
   * — the user moves focus with arrows, then presses Enter or Space.
   */
  activateOnFocus?: boolean;
  /** Additional class names merged with `.cinder-tabs`. */
  class?: string;
  /** Tab and TabPanel children. */
  children: Snippet;
};
