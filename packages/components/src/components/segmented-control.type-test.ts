/**
 * Compile-time regression tests for SegmentedControlProps discriminated union.
 * svelte-check processes this file; tsc does not (it excludes .svelte imports).
 * These verify that:
 *   - Single and multiple modes accept the right value types.
 *   - A plain Set is rejected for multiple mode (SvelteSet required).
 *   - Component-owned attributes are rejected from rest props.
 */
import type { SvelteSet } from 'svelte/reactivity';

import type { SegmentedControlProps } from './segmented-control.svelte';

const options = [
  { value: 'a', label: 'A' },
  { value: 'b', label: 'B' },
] as const;

// ── Valid: single mode with string value ─────────────────────────────────────

const _singleValid: SegmentedControlProps<'a' | 'b'> = {
  id: 'test',
  label: 'Test',
  options,
  selectionMode: 'single',
  value: 'a',
};

// ── Valid: single mode without selectionMode (default) ───────────────────────

const _singleDefault: SegmentedControlProps<'a' | 'b'> = {
  id: 'test',
  label: 'Test',
  options,
  value: 'a',
};

// ── Valid: multiple mode with SvelteSet ──────────────────────────────────────

declare const validSet: SvelteSet<'a' | 'b'>;

const _multipleValid: SegmentedControlProps<'a' | 'b'> = {
  id: 'test',
  label: 'Test',
  options,
  selectionMode: 'multiple',
  value: validSet,
};

// ── Invalid: multiple mode with plain Set (must be rejected) ─────────────────

declare const plainSet: Set<'a' | 'b'>;

const _multiplePlainSet: SegmentedControlProps<'a' | 'b'> = {
  id: 'test',
  label: 'Test',
  options,
  selectionMode: 'multiple',
  // @ts-expect-error - plain Set is not assignable to SvelteSet
  value: plainSet,
};

// ── Invalid: component-owned attributes must be rejected from rest props ─────

const _roleRejected: SegmentedControlProps = {
  id: 'test',
  label: 'Test',
  options,
  // @ts-expect-error - role is component-owned and must be rejected
  role: 'presentation',
};

const _labelledByRejected: SegmentedControlProps = {
  id: 'test',
  label: 'Test',
  options,
  // @ts-expect-error - aria-labelledby is component-owned and must be rejected
  'aria-labelledby': 'other-id',
};

const _ariaDisabledRejected: SegmentedControlProps = {
  id: 'test',
  label: 'Test',
  options,
  // @ts-expect-error - aria-disabled is component-owned and must be rejected
  'aria-disabled': 'true',
};

const _tabindexRejected: SegmentedControlProps = {
  id: 'test',
  label: 'Test',
  options,
  // @ts-expect-error - tabindex is component-owned and must be rejected
  tabindex: 0,
};

const _onkeydownRejected: SegmentedControlProps = {
  id: 'test',
  label: 'Test',
  options,
  // @ts-expect-error - onkeydown is component-owned and must be rejected
  onkeydown: () => {},
};

// ── Invalid: disallowEmptySelection=true is not applicable in multiple mode ──

// @ts-expect-error - disallowEmptySelection: true is not assignable in multiple mode (type is undefined)
const _disallowEmptyInMultiple: SegmentedControlProps<'a' | 'b'> = {
  id: 'test',
  label: 'Test',
  options,
  selectionMode: 'multiple',
  disallowEmptySelection: true,
};

void _singleValid;
void _singleDefault;
void _multipleValid;
void _multiplePlainSet;
void _roleRejected;
void _labelledByRejected;
void _ariaDisabledRejected;
void _tabindexRejected;
void _onkeydownRejected;
void _disallowEmptyInMultiple;
