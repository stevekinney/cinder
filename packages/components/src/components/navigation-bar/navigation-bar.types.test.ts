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
  NavigationBarPlacement,
  NavigationBarProps,
  NavigationBarToggleAttributes,
  NavigationVariant,
} from './navigation-bar.types.ts';

// Verify all exported types are importable — compile-time smoke test.
// The _Variables prefix signals intentional use-for-type-check-only.
const _navigationBarItemsContext: NavigationBarItemsContext = {
  variant: 'horizontal',
  placement: 'top',
  showLabels: 'always',
};
const _navigationBarToggleAttributes: NavigationBarToggleAttributes = {
  'aria-expanded': 'false',
  'aria-controls': 'menu-id',
};
const _navigationVariant: NavigationVariant = 'horizontal';
const _navigationPlacement: NavigationBarPlacement = 'bottom';
const _navigationLabelVisibility: NavigationBarLabelVisibility = 'active';

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
  expect(_navigationBarItemsContext.variant).toBe('horizontal');
  expect(_navigationBarToggleAttributes['aria-expanded']).toBe('false');
  expect(_navigationVariant).toBe('horizontal');
  expect(_navigationPlacement).toBe('bottom');
  expect(_navigationLabelVisibility).toBe('active');
});
