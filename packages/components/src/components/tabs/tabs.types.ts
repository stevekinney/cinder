import type { Snippet } from 'svelte';
/** Orientation of the tab list. */
export type TabsOrientation = 'horizontal' | 'vertical';
/**
 * Shape of the context object provided to Tab and TabPanel children.
 *
 * `register` lets each Tab announce its button element during mount so the
 * parent can drive arrow-key navigation. `updateDisabledState` keeps the
 * parent-side keyboard registry aligned with disabled prop changes without
 * disturbing registration order. `unregister` removes the entry on unmount.
 */
export type TabsContext = {
  readonly value: string;
  readonly orientation: TabsOrientation;
  readonly activateOnFocus: boolean;
  select: (next: string) => void;
  isActive: (candidate: string) => boolean;
  register: (value: string, button: HTMLButtonElement) => void;
  updateDisabledState: (value: string, disabled: boolean) => void;
  unregister: (value: string) => void;
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
