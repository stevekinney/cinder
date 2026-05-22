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

  import { handleRovingKeydown, isRovingKey } from '../../utilities/roving-tabindex.ts';
  import { classNames } from '../../utilities/class-names.ts';

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

  type RegistryEntry = { button: HTMLButtonElement; disabled: boolean };

  /**
   * Registry of tab buttons keyed by their `value`. Order of registration
   * determines navigation order — children register in mount order.
   *
   * In-place mutation of an entry's `disabled` field does not trigger Svelte
   * reactivity on its own, so every mutation path also bumps `version`. Any
   * `$derived` that reads from the registry must also read `version` to
   * re-run when entries change.
   */
  const buttons: Map<string, RegistryEntry> = new Map();
  let version = $state(0);

  const focusableValue = $derived.by(() => {
    void version;
    for (const [registeredValue, entry] of buttons) {
      if (!entry.disabled) return registeredValue;
    }
    return undefined;
  });

  function focusValue(target: string): void {
    const entry = buttons.get(target);
    if (entry) entry.button.focus();
  }

  function resolveFocusedIndex(active: Element | null): number {
    const entries = [...buttons.values()];
    return entries.findIndex(({ button }) => button === active);
  }

  function readActiveElement(event: KeyboardEvent): Element | null {
    // Prefer the event target if it is itself a registered tab button —
    // that is the most local, most reliable signal. Fall back to
    // ownerDocument.activeElement when the target is not a tab (e.g., when
    // the handler is attached at a higher level).
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (target) {
      for (const { button } of buttons.values()) {
        if (button === target) return target;
      }
    }
    const currentTarget = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
    return currentTarget?.ownerDocument.activeElement ?? null;
  }

  function resolveStartingIndex(event: KeyboardEvent): number {
    const entries = [...buttons.values()];
    if (entries.length === 0) return -1;
    const focused = resolveFocusedIndex(readActiveElement(event));
    if (focused !== -1) return focused;
    // Fallback: active tab if enabled, else first enabled. Returns -1 only
    // when every entry is disabled — the caller's guard handles that case.
    const order = [...buttons.keys()];
    const activeIdx = order.indexOf(value);
    if (activeIdx !== -1 && !entries[activeIdx]?.disabled) return activeIdx;
    return entries.findIndex((entry) => !entry.disabled);
  }

  /**
   * Whether the given key is one this orientation handles. Home/End are
   * always relevant; Arrow keys are orientation-specific. Mirrors the
   * `horizontal`/`vertical` filtering inside `handleRovingKeydown` so the
   * all-disabled no-op path does not preventDefault on keys we would
   * otherwise have let bubble (e.g., ArrowUp on a horizontal tablist).
   */
  function isOrientedKey(key: string, isHorizontal: boolean): boolean {
    if (!isRovingKey(key)) return false;
    if (key === 'Home' || key === 'End') return true;
    if (isHorizontal) return key === 'ArrowLeft' || key === 'ArrowRight';
    return key === 'ArrowUp' || key === 'ArrowDown';
  }

  function handleKeydown(event: KeyboardEvent): void {
    const entries = [...buttons.values()];
    const order = [...buttons.keys()];

    if (event.key === 'Enter' || event.key === ' ') {
      // Manual activation: activate the focused tab if it is enabled.
      const focused = resolveFocusedIndex(readActiveElement(event));
      if (focused === -1) return;
      if (entries[focused]?.disabled !== false) return;
      const focusedValue = order[focused];
      if (focusedValue === undefined) return;
      event.preventDefault();
      value = focusedValue;
      return;
    }

    const isHorizontal = orientation === 'horizontal';
    if (!isOrientedKey(event.key, isHorizontal)) return;
    if (entries.length === 0) return;

    const currentIndex = resolveStartingIndex(event);
    if (currentIndex === -1) {
      // All entries disabled — prevent default so arrow/Home/End do not leak
      // page scroll, but otherwise no-op.
      event.preventDefault();
      return;
    }

    const nextIdx = handleRovingKeydown(event, currentIndex, entries.length, {
      isDisabled: (i) => entries[i]?.disabled ?? false,
      horizontal: isHorizontal,
      vertical: !isHorizontal,
    });

    if (nextIdx === null) return;
    event.preventDefault();
    if (nextIdx === currentIndex) return;

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
    register(target, button, disabled = false) {
      const existing = buttons.get(target);
      if (existing) {
        existing.button = button;
        existing.disabled = disabled;
      } else {
        buttons.set(target, { button, disabled });
      }
      version += 1;
    },
    unregister(target) {
      if (buttons.delete(target)) {
        version += 1;
      }
    },
    setDisabled(target, disabled) {
      const existing = buttons.get(target);
      if (!existing) return;
      if (existing.disabled === disabled) return;
      existing.disabled = disabled;
      version += 1;
    },
    isFocusable(candidate) {
      // Force reads of every reactive input up front, regardless of which
      // branch the predicate ultimately takes. The calling $derived in
      // tab.svelte needs to subscribe to `value` AND `version` for any
      // possible code path — early-returning before reading one of them
      // would leave the derived under-subscribed and stale when only the
      // unread input changes. Must be called inside a $derived/$effect.
      void value;
      void version;
      const selectedEntry = buttons.get(value);
      const selectedIsEnabled = selectedEntry !== undefined && !selectedEntry.disabled;
      const entry = buttons.get(candidate);
      if (!entry || entry.disabled) return false;
      if (selectedIsEnabled) return value === candidate;
      return focusableValue === candidate;
    },
    handleKeydown,
  });
</script>

<div class={classNames('cinder-tabs', className)} data-cinder-orientation={orientation}>
  {@render children()}
</div>
