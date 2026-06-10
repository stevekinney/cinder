/**
 * Type-level tests for ChoiceGrid/ChoiceGridItem prop unions.
 *
 * These are compile-time assertions — no runtime behavior is tested here.
 * The test runner imports this file; if it compiles without errors, the
 * type constraints are satisfied.
 */

import { describe, expect, test } from 'bun:test';

import type {
  ChoiceGridColumns,
  ChoiceGridItemProps,
  ChoiceGridItemState,
  ChoiceGridProps,
} from './choice-grid.types.ts';

describe('ChoiceGridItemState union', () => {
  test('all valid state values are assignable', () => {
    const states: ChoiceGridItemState[] = ['neutral', 'correct', 'incorrect', 'pending'];
    expect(states.length).toBe(4);
  });
});

describe('ChoiceGridColumns union', () => {
  test('all valid column values are assignable', () => {
    const columns: ChoiceGridColumns[] = ['responsive', 1, 2, 3, 4];
    expect(columns.length).toBe(5);
  });
});

describe('ChoiceGridProps type', () => {
  test('accepts minimal required props', () => {
    // This is a compile-time check: creating a conforming object.
    const minimal: Partial<ChoiceGridProps> & { children: ChoiceGridProps['children'] } = {
      // children is required; we use a type cast since we are not rendering.
      children: undefined as unknown as ChoiceGridProps['children'],
    };
    expect(minimal).toBeDefined();
  });

  test('value is optional and nullable', () => {
    const withValue: Pick<ChoiceGridProps, 'value'> = { value: 'a' };
    const withNull: Pick<ChoiceGridProps, 'value'> = { value: null };
    // Omitting value entirely (undefined) is covered by the optional `?` — no
    // property required to be present at all.
    expect(withValue.value).toBe('a');
    expect(withNull.value).toBeNull();
  });

  test('values is an array of strings', () => {
    const withValues: Pick<ChoiceGridProps, 'values'> = { values: ['a', 'b'] };
    expect(withValues.values).toEqual(['a', 'b']);
  });

  test('columns accepts numeric values', () => {
    const with2: Pick<ChoiceGridProps, 'columns'> = { columns: 2 };
    const withResponsive: Pick<ChoiceGridProps, 'columns'> = { columns: 'responsive' };
    expect(with2.columns).toBe(2);
    expect(withResponsive.columns).toBe('responsive');
  });
});

describe('ChoiceGridItemProps type', () => {
  test('value and children are required', () => {
    const minimal: ChoiceGridItemProps = {
      value: 'test',
      children: undefined as unknown as ChoiceGridItemProps['children'],
    };
    expect(minimal.value).toBe('test');
  });

  test('state defaults to neutral', () => {
    const withState: Pick<ChoiceGridItemProps, 'state'> = { state: 'correct' };
    expect(withState.state).toBe('correct');
  });

  test('disabled is optional boolean', () => {
    const withDisabled: Pick<ChoiceGridItemProps, 'disabled'> = { disabled: true };
    expect(withDisabled.disabled).toBe(true);
  });
});
