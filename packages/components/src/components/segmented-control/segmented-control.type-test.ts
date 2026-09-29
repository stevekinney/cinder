/**
 * Compile-time regression tests for SegmentedControlProps discriminated union.
 * svelte-check processes this file; tsc does not (it excludes .svelte imports).
 *
 * These verify that:
 *   - Single and multiple modes accept the right value types.
 *   - A plain Set is rejected for multiple mode (SvelteSet required).
 */
import type { Snippet } from 'svelte';
import type { SvelteSet } from 'svelte/reactivity';

import type { SegmentedControlProps } from './segmented-control.types.ts';

declare const children: Snippet;

const singleValid: SegmentedControlProps<'a' | 'b'> = {
  id: 'test',
  label: 'Test',
  selectionMode: 'single',
  value: 'a',
  children,
};

const singleDefault: SegmentedControlProps<'a' | 'b'> = {
  id: 'test',
  label: 'Test',
  value: 'a',
  children,
};

const navigationValid: SegmentedControlProps<'a' | 'b'> = {
  id: 'test',
  label: 'Test',
  variant: 'navigation',
  children,
};

declare const validSet: SvelteSet<'a' | 'b'>;

const multipleValid: SegmentedControlProps<'a' | 'b'> = {
  id: 'test',
  label: 'Test',
  selectionMode: 'multiple',
  value: validSet,
  children,
};

declare const plainSet: Set<'a' | 'b'>;

const multiplePlainSet: SegmentedControlProps<'a' | 'b'> = {
  id: 'test',
  label: 'Test',
  selectionMode: 'multiple',
  // @ts-expect-error - plain Set is not assignable to SvelteSet
  value: plainSet,
  children,
};

// @ts-expect-error - navigation is only valid for single-selection controls
const multipleNavigation: SegmentedControlProps<'a' | 'b'> = {
  id: 'test',
  label: 'Test',
  selectionMode: 'multiple',
  value: validSet,
  variant: 'navigation',
  children,
};

void singleValid;
void singleDefault;
void navigationValid;
void multipleValid;
void multiplePlainSet;
void multipleNavigation;
