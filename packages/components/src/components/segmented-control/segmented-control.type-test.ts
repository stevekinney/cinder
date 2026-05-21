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

const _singleValid: SegmentedControlProps<'a' | 'b'> = {
  id: 'test',
  label: 'Test',
  selectionMode: 'single',
  value: 'a',
  children,
};

const _singleDefault: SegmentedControlProps<'a' | 'b'> = {
  id: 'test',
  label: 'Test',
  value: 'a',
  children,
};

declare const validSet: SvelteSet<'a' | 'b'>;

const _multipleValid: SegmentedControlProps<'a' | 'b'> = {
  id: 'test',
  label: 'Test',
  selectionMode: 'multiple',
  value: validSet,
  children,
};

declare const plainSet: Set<'a' | 'b'>;

const _multiplePlainSet: SegmentedControlProps<'a' | 'b'> = {
  id: 'test',
  label: 'Test',
  selectionMode: 'multiple',
  // @ts-expect-error - plain Set is not assignable to SvelteSet
  value: plainSet,
  children,
};

void _singleValid;
void _singleDefault;
void _multipleValid;
void _multiplePlainSet;
