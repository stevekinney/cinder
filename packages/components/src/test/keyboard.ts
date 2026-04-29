/**
 * Keyboard interaction helpers for component tests.
 *
 * These wrap `dispatchEvent` with `KeyboardEvent` to provide a terse, intent-revealing
 * API for the kinds of keyboard sequences that components in Cinder care about
 * (arrow navigation, ESC, Enter/Space activation, Home/End, Tab).
 *
 * Use these instead of fiddling with `KeyboardEvent` directly so tests stay focused
 * on behavior, not on event-construction noise.
 */

/// <reference lib="dom" />

/** A subset of `KeyboardEvent.key` values that components in Cinder respond to. */
export type Key =
  | 'Enter'
  | ' '
  | 'Escape'
  | 'Tab'
  | 'ArrowUp'
  | 'ArrowDown'
  | 'ArrowLeft'
  | 'ArrowRight'
  | 'Home'
  | 'End'
  | 'PageUp'
  | 'PageDown';

/** Modifier flags accepted by {@link press}. */
export type KeyModifiers = {
  shift?: boolean;
  ctrl?: boolean;
  alt?: boolean;
  meta?: boolean;
};

/**
 * Dispatch a `keydown` then `keyup` pair on the given element. The element receives
 * focus first if it isn't already focused, mirroring what a real keyboard interaction
 * does.
 *
 * `key` is typed as `string` rather than the {@link Key} union so callers can
 * pass arbitrary printable characters (typeahead tests) without casting; the
 * {@link Key} union exists as a documentation aid for the keys this library
 * cares about, not as a hard restriction.
 */
export function press(target: Element, key: string, modifiers: KeyModifiers = {}): void {
  if (target instanceof HTMLElement && document.activeElement !== target) {
    target.focus();
  }
  const init: KeyboardEventInit = {
    key,
    bubbles: true,
    cancelable: true,
    shiftKey: modifiers.shift ?? false,
    ctrlKey: modifiers.ctrl ?? false,
    altKey: modifiers.alt ?? false,
    metaKey: modifiers.meta ?? false,
  };
  target.dispatchEvent(new KeyboardEvent('keydown', init));
  target.dispatchEvent(new KeyboardEvent('keyup', init));
}

/**
 * Press a sequence of keys against the same target, in order. Returns nothing —
 * the test asserts on observable state after the sequence.
 */
export function pressSequence(target: Element, keys: string[]): void {
  for (const key of keys) {
    press(target, key);
  }
}

/** Returns the element that currently has focus, or `null` if none does. */
export function getFocused(): Element | null {
  return document.activeElement === document.body ? null : document.activeElement;
}

/** Format an element as a readable tag for assertion error messages. */
function describeElement(element: Element | null): string {
  if (element === null) return '<none>';
  if (element instanceof HTMLElement) {
    return `<${element.tagName.toLowerCase()}${element.id ? ` id="${element.id}"` : ''}>`;
  }
  return `<${element.tagName.toLowerCase()}>`;
}

/** Asserts that `expected` is the currently-focused element. Throws otherwise. */
export function expectFocused(expected: Element): void {
  const actual = document.activeElement;
  if (actual !== expected) {
    throw new Error(
      `expected focus on ${describeElement(expected)}, got ${describeElement(actual)}`,
    );
  }
}
