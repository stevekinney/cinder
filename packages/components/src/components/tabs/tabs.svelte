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

  type RegisteredTab = {
    button: HTMLButtonElement;
    disabled: boolean;
  };

  /**
   * Registry of tab buttons keyed by their `value`. Updated as Tab children
   * mount, unmount, and toggle disabled state. The order of registration
   * determines the navigation order.
   */
  const registeredTabs = new Map<string, RegisteredTab>();

  function enabledValuesInOrder(): string[] {
    return [...registeredTabs.entries()]
      .filter(([, registration]) => !registration.disabled)
      .map(([registeredValue]) => registeredValue);
  }

  function isEnabledValue(candidate: string): boolean {
    const registration = registeredTabs.get(candidate);
    return registration !== undefined && !registration.disabled;
  }

  function isRegisteredValue(candidate: string): boolean {
    return registeredTabs.has(candidate);
  }

  function focusedRegisteredValue(event: KeyboardEvent): string | null {
    const target = event.target as HTMLElement | null;
    const focusedValue = target?.dataset['cinderValue'];
    return focusedValue && isRegisteredValue(focusedValue) ? focusedValue : null;
  }

  function focusValue(target: string): void {
    registeredTabs.get(target)?.button.focus();
  }

  function handleKeydown(event: KeyboardEvent): void {
    const intent = navigationIntent(event.key, orientation as Orientation);
    if (!intent) {
      // Manual activation: Enter/Space activates the focused tab.
      if (event.key === 'Enter' || event.key === ' ') {
        const activeFocusedValue = focusedRegisteredValue(event);
        if (activeFocusedValue && isEnabledValue(activeFocusedValue)) {
          event.preventDefault();
          value = activeFocusedValue;
        }
      }
      return;
    }

    event.preventDefault();
    const enabledValues = enabledValuesInOrder();
    if (enabledValues.length === 0) return;

    const keyboardAnchor = focusedRegisteredValue(event) ?? value;
    const currentIndex = enabledValues.indexOf(keyboardAnchor);
    const nextValue =
      currentIndex === -1
        ? intent === 'next' || intent === 'first'
          ? enabledValues[0]
          : enabledValues.at(-1)
        : enabledValues[nextIndex(currentIndex, enabledValues.length, intent)];
    if (nextValue === undefined) return;

    focusValue(nextValue);
    if (effectiveActivateOnFocus && isEnabledValue(nextValue)) {
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
    register(target, button, disabled) {
      registeredTabs.set(target, {
        button,
        disabled,
      });
    },
    updateDisabledState(target, disabled) {
      const existingRegistration = registeredTabs.get(target);
      if (!existingRegistration) return;

      registeredTabs.set(target, {
        ...existingRegistration,
        disabled,
      });
    },
    unregister(target) {
      registeredTabs.delete(target);
    },
    handleKeydown,
  });
</script>

<div class={cn('cinder-tabs', className)} data-cinder-orientation={orientation}>
  {@render children()}
</div>
