<script lang="ts" module>
  /**
   * @cinder
   * @category navigation
   * @status stable
   * @purpose Root tabs composite that owns the active value and orientation and coordinates tab, tab-list, and tab-panel descendants via context.
   * @tag navigation
   * @tag tabs
   * @useWhen Switching between several panels of related content under one heading area.
   * @useWhen Building the WAI-ARIA tabs pattern with shared keyboard navigation and activation rules.
   * @avoidWhen Picking one of two to five short values inline — use segmented-control instead.
   * @avoidWhen Showing ordered progress through a wizard — use steps instead.
   * @related tab, tab-list, tab-panel, segmented-control
   */
  /** Symbol key for the tabs Svelte context. */
  export const TABS_CONTEXT_KEY = Symbol('cinder-tabs');

  export type { TabsContext, TabsOrientation, TabsProps } from './tabs.types.ts';
</script>

<script lang="ts">
  import type { TabsContext, TabsProps } from './tabs.types.ts';
  import { setContext } from 'svelte';

  import { type Orientation, navigationIntent, nextIndex } from '../../_internal/collection.ts';
  import { cn } from '../../utilities/class-names.ts';

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
