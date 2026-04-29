<script lang="ts" module>
  import type { Snippet } from 'svelte';

  /** Symbol key for the tabs Svelte context. */
  export const TABS_CONTEXT_KEY = Symbol('cinder-tabs');

  /** Orientation of the tab list. */
  export type TabsOrientation = 'horizontal' | 'vertical';

  /**
   * Shape of the context object provided to Tab and TabPanel children.
   *
   * `register` lets each Tab announce itself to the parent during mount so
   * the parent can drive arrow-key navigation (focus management requires the
   * parent to know each tab's element). `unregister` removes the entry on
   * unmount.
   */
  export type TabsContext = {
    readonly value: string;
    readonly orientation: TabsOrientation;
    readonly activateOnFocus: boolean;
    select: (next: string) => void;
    isActive: (candidate: string) => boolean;
    register: (value: string, button: HTMLButtonElement) => void;
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
</script>

<script lang="ts">
  import { setContext } from 'svelte';

  import { type Orientation, navigationIntent, nextIndex } from '../_internal/collection.ts';
  import { cn } from '../utilities/class-names.ts';

  let {
    value = $bindable(''),
    orientation = 'horizontal',
    activateOnFocus,
    class: className,
    children,
  }: TabsProps = $props();

  // Default activation behavior follows the WAI-ARIA tabs pattern: horizontal
  // tablists activate on focus (left/right are dedicated to tab navigation),
  // vertical tablists activate on Enter/Space (down/up commonly belong to the
  // panel content too).
  const effectiveActivateOnFocus = $derived(activateOnFocus ?? orientation === 'horizontal');

  /**
   * Registry of tab buttons keyed by their `value`. Updated as Tab children
   * mount and unmount. The order of registration determines the navigation
   * order — children are registered in mount order, which is the same as
   * source order in the template.
   */
  const buttons: Map<string, HTMLButtonElement> = new Map();

  function valuesInOrder(): string[] {
    return [...buttons.keys()];
  }

  function focusValue(target: string): void {
    const btn = buttons.get(target);
    if (btn) btn.focus();
  }

  function handleKeydown(event: KeyboardEvent): void {
    const intent = navigationIntent(event.key, orientation as Orientation);
    if (!intent) {
      // Manual activation: Enter/Space activates the focused tab.
      if (event.key === 'Enter' || event.key === ' ') {
        const target = event.target as HTMLElement | null;
        const focusedValue = target?.dataset['cinderValue'];
        if (focusedValue && buttons.has(focusedValue)) {
          event.preventDefault();
          value = focusedValue;
        }
      }
      return;
    }

    event.preventDefault();
    const order = valuesInOrder();
    if (order.length === 0) return;
    const currentIndex = order.indexOf(value);
    const nextIdx = nextIndex(currentIndex === -1 ? 0 : currentIndex, order.length, intent);
    const nextValue = order[nextIdx];
    if (nextValue === undefined) return;

    focusValue(nextValue);
    if (effectiveActivateOnFocus) {
      value = nextValue;
    }
  }

  setContext<TabsContext>(TABS_CONTEXT_KEY, {
    get value() {
      return value;
    },
    get orientation() {
      return orientation;
    },
    get activateOnFocus() {
      return effectiveActivateOnFocus;
    },
    select(next) {
      value = next;
    },
    isActive(candidate) {
      return value === candidate;
    },
    register(target, button) {
      buttons.set(target, button);
    },
    unregister(target) {
      buttons.delete(target);
    },
    handleKeydown,
  });
</script>

<div class={cn('cinder-tabs', className)} data-cinder-orientation={orientation}>
  {@render children()}
</div>
