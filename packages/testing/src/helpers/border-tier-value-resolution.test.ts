import { describe, expect, test } from 'bun:test';

import { resolveTierReferences, type VariableValue } from './border-tier-value-resolution.ts';

function lookupFrom(values: Record<string, VariableValue>) {
  return (name: string, minimumLevel: number): VariableValue | undefined => {
    const value = values[name];
    return value !== undefined && value.level >= minimumLevel ? value : undefined;
  };
}

describe('resolveTierReferences', () => {
  test('resolves direct tier references', () => {
    expect(resolveTierReferences('1px solid var(--cinder-border)', lookupFrom({}))).toEqual([
      { tier: '--cinder-border', depth: 0, isMix: false },
    ]);
  });

  test('follows aliases and records the alias depth', () => {
    expect(
      resolveTierReferences(
        'var(--component-border)',
        lookupFrom({ '--component-border': { value: 'var(--cinder-border-strong)', level: 0 } }),
      ),
    ).toEqual([
      { tier: '--cinder-border-strong', depth: 1, isMix: false, alias: '--component-border' },
    ]);
  });

  test('uses var fallbacks when a variable is missing or initial', () => {
    expect(
      resolveTierReferences(
        'var(--component-border, var(--cinder-border-muted))',
        lookupFrom({ '--component-border': { value: 'initial', level: 0 } }),
      ),
    ).toEqual([{ tier: '--cinder-border-muted', depth: 0, isMix: false }]);
  });

  test('marks references inside color-mix as mixed', () => {
    expect(
      resolveTierReferences(
        'color-mix(in srgb, var(--cinder-border), transparent 25%)',
        lookupFrom({}),
      ),
    ).toEqual([{ tier: '--cinder-border', depth: 0, isMix: true }]);
  });

  test('resolves currentColor through the provided property context', () => {
    expect(
      resolveTierReferences('currentColor', lookupFrom({}), 0, {
        currentColor: () => ({
          tier: '--cinder-border',
          depth: 2,
          isMix: false,
          alias: '--text-color',
        }),
      }),
    ).toEqual([{ tier: '--cinder-border', depth: 2, isMix: false, alias: '--text-color' }]);
  });

  test('fails closed for cycles rather than using cyclic fallbacks', () => {
    expect(
      resolveTierReferences(
        'var(--a, var(--cinder-border))',
        lookupFrom({
          '--a': { value: 'var(--b, var(--cinder-border-muted))', level: 0 },
          '--b': { value: 'var(--a)', level: 0 },
        }),
      ),
    ).toEqual([{ tier: '--cinder-border', depth: 0, isMix: false }]);
  });
});
