/**
 * Type-level test proving that NavigationBarProps exposes `class` as `string | undefined`
 * rather than the wider `ClassValue` union that an uninstrumented HTMLAttributes intersection
 * produces. Consumers composing over NavigationBarProps must be able to extend it without
 * needing their own `Omit<NavigationBarProps, 'class'> & { class?: string }` dance.
 */
import { expect, test } from 'bun:test';

import type {
  NavigationBarItemsContext,
  NavigationBarLabelVisibility,
  NavigationBarMenuTogglePlacement,
  NavigationBarPlacement,
  NavigationBarProps,
  NavigationBarToggleAttributes,
  NavigationVariant,
} from './navigation-bar.types.ts';

// Verify all exported types are importable — compile-time smoke test.
// The _Variables prefix signals intentional use-for-type-check-only.
const navigationBarItemsContext: NavigationBarItemsContext = {
  variant: 'horizontal',
  placement: 'top',
  labelsVisible: 'always',
};
const navigationBarToggleAttributes: NavigationBarToggleAttributes = {
  'aria-expanded': 'false',
  'aria-controls': 'menu-id',
};
const navigationVariant: NavigationVariant = 'horizontal';
const navigationPlacement: NavigationBarPlacement = 'bottom';
const navigationLabelVisibility: NavigationBarLabelVisibility = 'active';
const navigationMenuTogglePlacement: NavigationBarMenuTogglePlacement = 'before-brand';

// Verify the resolved class type is string (not ClassValue / any).
type NavigationBarClass = NavigationBarProps['class'];
type ClassIsString = NavigationBarClass extends string | undefined ? true : false;
const classIsString: ClassIsString = true;

// A consumer-style wrapper that extends NavigationBarProps directly — no Omit needed.
type ConsumerExtendedProps = NavigationBarProps & {
  customProp?: string;
};
// If `class` were ClassValue, this would widen and the extract-string check below would fail.
type ExtendedClass = ConsumerExtendedProps['class'];
type ExtendedClassIsString = ExtendedClass extends string | undefined ? true : false;
const extendedClassIsString: ExtendedClassIsString = true;

test('NavigationBarProps["class"] resolves to string | undefined, not ClassValue', () => {
  expect(classIsString).toBe(true);
  expect(extendedClassIsString).toBe(true);
  // Smoke-test the other types compile (their values are assigned above).
  expect(navigationBarItemsContext.variant).toBe('horizontal');
  expect(navigationBarToggleAttributes['aria-expanded']).toBe('false');
  expect(navigationVariant).toBe('horizontal');
  expect(navigationPlacement).toBe('bottom');
  expect(navigationLabelVisibility).toBe('active');
  expect(navigationMenuTogglePlacement).toBe('before-brand');
});
