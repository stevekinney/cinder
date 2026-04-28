/**
 * Unit tests for `scripts/playground/controls.ts`.
 */

import { describe, expect, it } from 'bun:test';

import { defaultForControl, inferControlKind } from './controls.ts';

describe('inferControlKind', () => {
  it('maps "boolean" to { kind: "boolean" }', () => {
    expect(inferControlKind('boolean')).toEqual({ kind: 'boolean' });
  });

  it('maps "number" to { kind: "number" }', () => {
    expect(inferControlKind('number')).toEqual({ kind: 'number' });
  });

  it('maps "string" to { kind: "text" }', () => {
    expect(inferControlKind('string')).toEqual({ kind: 'text' });
  });

  it('maps a single-quoted string literal union to { kind: "select", options }', () => {
    expect(inferControlKind("'primary' | 'secondary' | 'danger'")).toEqual({
      kind: 'select',
      options: ['primary', 'secondary', 'danger'],
    });
  });

  it('maps a two-option single-quoted union to select', () => {
    expect(inferControlKind("'xs' | 'lg'")).toEqual({
      kind: 'select',
      options: ['xs', 'lg'],
    });
  });

  it('maps "Snippet" (bare) to { kind: "snippet" }', () => {
    expect(inferControlKind('Snippet')).toEqual({ kind: 'snippet' });
  });

  it('maps "Snippet<[string]>" to { kind: "snippet" }', () => {
    expect(inferControlKind('Snippet<[string]>')).toEqual({ kind: 'snippet' });
  });

  it('maps an unrecognised type to { kind: "unknown", rawType }', () => {
    expect(inferControlKind('HTMLDivElement')).toEqual({
      kind: 'unknown',
      rawType: 'HTMLDivElement',
    });
  });

  it('maps a complex union involving non-literals to unknown', () => {
    expect(inferControlKind('string | number')).toEqual({
      kind: 'unknown',
      rawType: 'string | number',
    });
  });

  it('trims surrounding whitespace before matching', () => {
    expect(inferControlKind('  boolean  ')).toEqual({ kind: 'boolean' });
  });
});

describe('defaultForControl', () => {
  it('returns false for boolean controls', () => {
    expect(defaultForControl({ kind: 'boolean' })).toBe(false);
  });

  it('returns 0 for number controls', () => {
    expect(defaultForControl({ kind: 'number' })).toBe(0);
  });

  it('returns an empty string for text controls', () => {
    expect(defaultForControl({ kind: 'text' })).toBe('');
  });

  it('returns the first option for select controls', () => {
    expect(defaultForControl({ kind: 'select', options: ['a', 'b'] })).toBe('a');
  });

  it('returns an empty string for select controls with no options', () => {
    expect(defaultForControl({ kind: 'select', options: [] })).toBe('');
  });

  it('returns undefined for snippet controls', () => {
    expect(defaultForControl({ kind: 'snippet' })).toBeUndefined();
  });

  it('returns undefined for unknown controls', () => {
    expect(defaultForControl({ kind: 'unknown', rawType: 'HTMLDivElement' })).toBeUndefined();
  });
});
