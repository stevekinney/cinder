import type { Snippet } from 'svelte';
/** Orientation of the tab list. */
export type TabsOrientation = 'horizontal' | 'vertical';
/**
 * Shape of the context object provided to Tab and TabPanel children.
 *
 * The contract is split between selection (the bound `value`, exposed via
 * `select` and `isActive`) and roving-tabindex focus management (`register`,
 * `unregister`, `setDisabled`, `isFocusable`). Decoupling lets a
 * selected-but-disabled tab keep `aria-selected="true"` while the tab stop
 * (`tabindex="0"`) shifts to the first enabled tab — so the tablist always
 * has a reachable entry point.
 */
export type TabsContext = {
  /** The currently active tab value. */
  readonly value: string;
  /** Layout orientation, forwarded to TabList for `aria-orientation`. */
  readonly orientation: TabsOrientation;
  /** Whether focus movement also activates a tab (per WAI-ARIA pattern). */
  readonly activateOnFocus: boolean;
  /** Activate a tab by value. */
  select: (next: string) => void;
  /** True when `candidate` is the active tab. */
  isActive: (candidate: string) => boolean;
  /**
   * Announce a tab to the parent registry on mount. Registry order is the
   * navigation order. Re-registering an existing value updates its button
   * reference in place; insertion order is preserved. The `disabled` argument
   * seeds the registry entry's initial state so first paint reflects the
   * tab's current `disabled` prop without waiting for `setDisabled` to run.
   */
  register: (value: string, button: HTMLButtonElement, disabled?: boolean) => void;
  /** Remove a tab from the registry on unmount. */
  unregister: (value: string) => void;
  /**
   * Sync the disabled state for a registered tab. Safe no-op when called
   * before `register` has run (e.g., during the first paint of a Tab whose
   * disabled-sync effect fires before its registration effect).
   */
  setDisabled: (value: string, disabled: boolean) => void;
  /**
   * Whether `candidate` should currently hold `tabindex="0"`. Reads
   * reactive registry state, so callers MUST invoke this inside a
   * `$derived` or `$effect` to stay current — a plain assignment captures
   * a stale snapshot.
   */
  isFocusable: (candidate: string) => boolean;
  /** Tab buttons forward `keydown` here for shared arrow-key navigation. */
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
