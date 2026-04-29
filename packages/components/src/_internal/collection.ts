/**
 * Internal collection / selection contract shared by parent-child components.
 *
 * Components that coordinate a parent (group) with N children where exactly one
 * (or any subset) is "active" all need the same plumbing:
 *
 * - A reactive value (or set of values) the parent owns and mutates.
 * - A `toggle` (multi) or `select` (single) function children call.
 * - An `isActive(id)` predicate children read.
 * - Keyboard navigation across the children, where arrow keys move focus or
 *   active state, and only one child sits in the tab order at a time
 *   (roving tabindex).
 *
 * This module exposes minimal helpers that the new Phase 1 components
 * (RadioGroup, Tabs) consume directly, and that Accordion can adopt while
 * preserving its public `AccordionContext` shape.
 *
 * The helpers return plain objects with getters — they do **not** themselves
 * call `setContext`. Each consuming parent owns its own context key and
 * shape, since the public API that children read from differs (Accordion
 * exposes `expandedIds`, RadioGroup exposes `value`, etc.).
 */

/**
 * Predicate for which key counts as "next" / "previous" given the current
 * orientation. RadioGroup is non-orientable (per WAI-ARIA radiogroup the
 * arrow keys move within the group regardless of orientation), Tabs and
 * Toolbar are orientable.
 */
export type Orientation = 'horizontal' | 'vertical';

/**
 * Returns the navigation intent for a key event given an orientation. Pure —
 * does not access the DOM or stop the event. The caller is responsible for
 * `event.preventDefault()` after acting on the intent.
 */
export function navigationIntent(
  key: string,
  orientation: Orientation = 'horizontal',
): 'next' | 'previous' | 'first' | 'last' | null {
  if (key === 'Home') return 'first';
  if (key === 'End') return 'last';

  if (orientation === 'horizontal') {
    if (key === 'ArrowRight') return 'next';
    if (key === 'ArrowLeft') return 'previous';
  } else {
    if (key === 'ArrowDown') return 'next';
    if (key === 'ArrowUp') return 'previous';
  }
  return null;
}

/**
 * Compute the next index for a list of length `length`, given a `current`
 * index and a navigation intent. Wraps around at the boundaries (per WAI-ARIA
 * convention for radiogroup, tablist, etc.).
 *
 * Returns the same `current` index when `length` is 0 (defensive: no items
 * means no navigation).
 */
export function nextIndex(
  current: number,
  length: number,
  intent: 'next' | 'previous' | 'first' | 'last',
): number {
  if (length <= 0) return current;
  switch (intent) {
    case 'first':
      return 0;
    case 'last':
      return length - 1;
    case 'next':
      return (current + 1) % length;
    case 'previous':
      return (current - 1 + length) % length;
  }
}

/**
 * Single-selection state holder. Wraps a bindable `value` getter/setter pair
 * so the consumer (Tabs, RadioGroup) doesn't reimplement the same select/
 * isSelected logic. Returns plain functions; the consumer wires them into
 * its context.
 *
 * Generic over the value type so RadioGroup can use string values, Tabs
 * can use string or number values, etc.
 */
export function createSingleSelection<T>(
  getValue: () => T,
  setValue: (next: T) => void,
): {
  readonly value: T;
  select: (next: T) => void;
  isSelected: (candidate: T) => boolean;
} {
  return {
    get value() {
      return getValue();
    },
    select(next) {
      setValue(next);
    },
    isSelected(candidate) {
      return getValue() === candidate;
    },
  };
}

/**
 * Multi-selection state holder. Wraps a bindable `values` getter/setter pair
 * so the consumer (Accordion when `multiple=true`) doesn't reimplement the
 * same toggle/isSelected logic.
 *
 * The setter receives a fresh array each toggle so reactivity is preserved
 * even when the consumer's bindable is a non-proxied array.
 */
export function createMultiSelection<T>(
  getValues: () => readonly T[],
  setValues: (next: T[]) => void,
): {
  readonly values: readonly T[];
  toggle: (item: T) => void;
  isSelected: (candidate: T) => boolean;
} {
  return {
    get values() {
      return getValues();
    },
    toggle(item) {
      const current = getValues();
      const index = current.indexOf(item);
      if (index === -1) {
        setValues([...current, item]);
      } else {
        setValues(current.filter((existing) => existing !== item));
      }
    },
    isSelected(candidate) {
      return getValues().includes(candidate);
    },
  };
}

/**
 * Returns the tabindex value for a child given whether it's the currently
 * active item in a roving-tabindex group. Active item is in the tab order
 * (`0`); all others are reachable only via arrow keys (`-1`).
 */
export function rovingTabIndex(isActive: boolean): 0 | -1 {
  return isActive ? 0 : -1;
}
