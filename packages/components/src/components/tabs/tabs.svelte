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
   *
   * `disabledValues` is intentionally separate from `buttons`: deleting and
   * re-inserting a Map key moves it to the end of iteration order, which
   * would silently corrupt navigation order whenever a Tab's `disabled`
   * prop toggled. `setDisabled` only mutates this set.
   */
  const buttons: Map<string, HTMLButtonElement> = new Map();
  const disabledValues: Set<string> = new Set();

  function enabledValuesInOrder(): string[] {
    return [...buttons.keys()].filter((candidate) => !disabledValues.has(candidate));
  }

  function focusValue(target: string): void {
    const btn = buttons.get(target);
    if (btn) btn.focus();
  }

  function handleKeydown(event: KeyboardEvent): void {
    const intent = navigationIntent(event.key, orientation as Orientation);
    if (!intent) {
      // Manual activation: Enter/Space activates the focused tab, but only
      // if its value is registered and not disabled. Native `disabled`
      // <button> elements cannot receive focus, so this guard is
      // defense-in-depth against future internal regressions.
      if (event.key === 'Enter' || event.key === ' ') {
        const target = event.target as HTMLElement | null;
        const focusedValue = target?.dataset['cinderValue'];
        if (focusedValue && buttons.has(focusedValue) && !disabledValues.has(focusedValue)) {
          event.preventDefault();
          value = focusedValue;
        }
      }
      return;
    }

    event.preventDefault();
    const order = enabledValuesInOrder();
    if (order.length === 0) return;

    // Home/End bypass adjacency and pick the first/last enabled tab
    // directly. Arrow keys step from the user's focused tab when it is
    // enabled, falling back to the controlled `value` when the keydown
    // came from somewhere other than a registered enabled tab. Disabled
    // values never seed navigation — disabled buttons are not focusable.
    let nextValue: string | undefined;
    if (intent === 'first') {
      nextValue = order[0];
    } else if (intent === 'last') {
      nextValue = order[order.length - 1];
    } else {
      const target = event.target as HTMLElement | null;
      const focusedValue = target?.dataset['cinderValue'];
      const anchor =
        focusedValue && order.includes(focusedValue)
          ? focusedValue
          : order.includes(value)
            ? value
            : undefined;
      const anchorIndex = anchor === undefined ? 0 : order.indexOf(anchor);
      const nextIdx = nextIndex(anchorIndex, order.length, intent);
      nextValue = order[nextIdx];
    }

    if (nextValue === undefined) return;

    focusValue(nextValue);
    if (effectiveActivateOnFocus && !disabledValues.has(nextValue)) {
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
      disabledValues.delete(target);
    },
    setDisabled(target, isDisabled) {
      if (isDisabled) disabledValues.add(target);
      else disabledValues.delete(target);
    },
    handleKeydown,
  });
</script>

<div class={cn('cinder-tabs', className)} data-cinder-orientation={orientation}>
  {@render children()}
</div>
