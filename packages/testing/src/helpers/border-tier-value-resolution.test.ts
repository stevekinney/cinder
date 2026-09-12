import { describe, expect, test } from 'bun:test';

import { resolveTierReferences, type VariableValue } from './border-tier-value-resolution.ts';

function resolve(value: string, variables: Record<string, string> = {}) {
  return resolveTierReferences(value, (name): VariableValue | undefined => {
    const found = variables[name];
    return found === undefined ? undefined : { value: found, level: 0 };
  });
}

describe('parsed border tier reachability', () => {
  test('does not report a tier hidden in an alias fallback', () => {
    expect(
      resolve('var(--track)', {
        '--track': 'var(--primary, var(--cinder-border-muted))',
        '--primary': 'red',
      }),
    ).toEqual([]);
  });

  test.each([undefined, 'initial', 'var(--missing)'])(
    'uses a fallback for an invalid primary: %s',
    (primary) => {
      const variables = primary === undefined ? {} : { '--primary': primary };
      expect(resolve('var(--primary, var(--cinder-border-muted))', variables)).toEqual([
        { tier: '--cinder-border-muted', depth: 0, isMix: false },
      ]);
    },
  );

  test('a cyclic variable cannot rescue itself with its own fallback', () => {
    const variables = { '--loop': 'var(--loop, var(--cinder-border-strong))' };
    expect(resolve('var(--loop)', variables)).toEqual([]);
    expect(resolve('var(--loop, var(--cinder-border-muted))', variables)).toEqual([
      { tier: '--cinder-border-muted', depth: 0, isMix: false },
    ]);
  });

  test('cycles count references inside unused fallbacks', () => {
    expect(
      resolve('var(--loop)', {
        '--loop': 'var(--valid, var(--loop))',
        '--valid': 'var(--cinder-border-muted)',
      }),
    ).toEqual([]);
  });

  test('a dependent variable can recover from another variable cycle', () => {
    expect(
      resolve('var(--track)', {
        '--track': 'var(--loop, var(--cinder-border-muted))',
        '--loop': 'var(--loop)',
      }),
    ).toEqual([{ tier: '--cinder-border-muted', depth: 1, alias: '--track', isMix: false }]);
  });

  test('used siblings remain visible beside an unused fallback', () => {
    expect(
      resolve(
        'color-mix(in oklch, var(--primary, var(--cinder-border-muted)), var(--cinder-border-strong))',
        {
          '--primary': 'red',
        },
      ),
    ).toEqual([{ tier: '--cinder-border-strong', depth: 0, isMix: true }]);
  });

  test('an unresolved sibling invalidates the whole declaration', () => {
    expect(resolve('color-mix(in oklch, var(--missing), var(--cinder-border-muted))')).toEqual([]);
  });

  test('uses the supplied currentColor resolver inside a substituted alias value', () => {
    expect(
      resolveTierReferences(
        'var(--paint)',
        (name): VariableValue | undefined =>
          name === '--paint' ? { value: 'currentColor', level: 1 } : undefined,
        0,
        { currentColor: () => ({ tier: '--cinder-border-strong', depth: 0, isMix: false }) },
      ),
    ).toEqual([{ tier: '--cinder-border-strong', depth: 1, alias: '--paint', isMix: false }]);
  });

  test('counts currentColor resolver depth and preserves the rendered alias first', () => {
    expect(
      resolveTierReferences(
        'var(--paint)',
        (name): VariableValue | undefined =>
          name === '--paint' ? { value: 'currentColor', level: 0 } : undefined,
        0,
        {
          currentColor: () => ({
            tier: '--cinder-border-strong',
            depth: 1,
            alias: '--tone',
            isMix: false,
          }),
        },
      ),
    ).toEqual([{ tier: '--cinder-border-strong', depth: 2, alias: '--paint', isMix: false }]);
  });

  test('strings and comments do not create variable references', () => {
    expect(resolve('"var(--cinder-border-muted)" /* var(--cinder-border) */')).toEqual([]);
  });

  test('malformed function syntax cannot produce a finding', () => {
    expect(resolve('var(--cinder-border-muted')).toEqual([]);
    expect(resolve('var(--primary extra, var(--cinder-border))')).toEqual([]);
  });
  test('invalid variable names cannot activate either a primary or a fallback', () => {
    for (const name of ['foo', '--', '--bad!', '--two words']) {
      expect(
        resolve(`var(${name}, var(--cinder-border))`, {
          [name]: 'var(--cinder-border-muted)',
        }),
      ).toEqual([]);
    }
    expect(resolve('var(--missing, var(--cinder-border))')).toEqual([
      { tier: '--cinder-border', depth: 0, isMix: false },
    ]);
    expect(
      resolve('var(--paint, var(--cinder-border-strong))', {
        '--paint': 'var(foo, var(--cinder-border))',
      }),
    ).toEqual([{ tier: '--cinder-border-strong', depth: 0, isMix: false }]);
  });
});
