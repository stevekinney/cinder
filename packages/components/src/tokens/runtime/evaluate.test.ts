import { describe, expect, spyOn, test } from 'bun:test';

import { cloneCorpus, loadProfileCorpus } from '../../../scripts/tokens/authoring-test-support.ts';
import { evaluateTheme, validateThemeSources, type ThemeSources } from './evaluate.ts';
import { cascadeCustomProperties } from './theme-runtime.test-support.ts';

type Group = Record<string, any>;

function baseSources(edit: (documents: Record<string, Group>) => void = () => {}): ThemeSources {
  const corpus = cloneCorpus(loadProfileCorpus());
  // A modifier may only override base tokens; the unbound imported token is traced elsewhere.
  delete (corpus.documentsByPath.get('profile-light.tokens.json') as Group)['imported'];
  const documents = Object.fromEntries(corpus.documentsByPath) as Record<string, Group>;
  edit(documents);
  return { revision: 7, resolver: corpus.resolver, documents };
}

function publicToken(cssProperty: string, extra: Record<string, unknown> = {}) {
  return {
    'com.lostgradient.cinder': { cssProperty, public: true, category: 'color', ...extra },
  };
}

function failure(sources: ThemeSources) {
  const result = evaluateTheme(sources);
  if (result.ok) throw new Error('expected the theme to be rejected');
  return result;
}

describe('evaluateTheme', () => {
  test('accepts a valid theme and tags every result with its revision', () => {
    const result = evaluateTheme(baseSources());
    expect(result.ok).toBe(true);
    expect(result.revision).toBe(7);
    expect(result.diagnostics).toEqual([]);
    if (result.ok) expect(result.provenance.revision).toBe(7);
  });

  test('a reference cycle fails with a path-addressed diagnostic and no result', () => {
    const result = failure(
      baseSources((documents) => {
        documents['profile-base.tokens.json']!['cycle'] = {
          $type: 'color',
          a: { $value: '{cycle.b}', $extensions: publicToken('--cinder-cycle-a') },
          b: { $value: '{cycle.a}', $extensions: publicToken('--cinder-cycle-b') },
        };
      }),
    );
    expect(result.diagnostics.length).toBeGreaterThan(0);
    expect(result.diagnostics.every((d) => d.revision === 7 && d.severity === 'error')).toBe(true);
    expect(result.diagnostics.map((d) => d.path)).toContain('cycle.a');
    expect(result.diagnostics.map((d) => d.reason)).toContain('circular token alias');
    expect('properties' in result).toBe(false);
    expect('provenance' in result).toBe(false);
  });

  test('an $extends cycle fails before projection', () => {
    const result = failure(
      baseSources((documents) => {
        documents['profile-base.tokens.json']!['one'] = { $extends: '{two}' };
        documents['profile-base.tokens.json']!['two'] = { $extends: '{one}' };
      }),
    );
    expect(result.diagnostics.some((d) => d.reason.includes('circular $extends'))).toBe(true);
  });

  test('a reference to a missing token fails', () => {
    const result = failure(
      baseSources((documents) => {
        documents['profile-base.tokens.json']!['dangling'] = {
          $type: 'color',
          $value: '{nowhere.defined}',
          $extensions: publicToken('--cinder-dangling'),
        };
      }),
    );
    expect(result.diagnostics.map((d) => d.reason)).toContain('reference target does not exist');
  });

  test('a value the declared type cannot hold fails at the schema stage, naming the path', () => {
    const result = failure(
      baseSources((documents) => {
        documents['profile-base.tokens.json']!['palette'].ink.$value = { value: 1, unit: 'rem' };
      }),
    );
    expect(result.diagnostics[0]).toMatchObject({ revision: 7, severity: 'error' });
    expect(result.diagnostics.some((d) => d.path.includes('palette.ink'))).toBe(true);
  });

  test('an override that changes a token to a different type is rejected before projection', () => {
    const result = failure(
      baseSources((documents) => {
        documents['profile-dark.tokens.json']!['palette'].paper = {
          $type: 'dimension',
          $value: { value: 1, unit: 'rem' },
        };
      }),
    );
    expect(result.diagnostics.length).toBeGreaterThan(0);
    expect('properties' in result).toBe(false);
  });

  test('an unsupported value is an explicit, context-addressed diagnostic, never a fallback', () => {
    const result = failure(
      baseSources((documents) => {
        documents['profile-base.tokens.json']!['stroke'] = {
          $type: 'strokeStyle',
          edge: { $value: 'solid', $extensions: publicToken('--cinder-stroke-edge') },
        };
      }),
    );
    expect(result.diagnostics.map((d) => d.path)).toEqual(Array(6).fill('stroke.edge'));
    expect(result.diagnostics[0]!.reason).toContain(
      'No direct CSS serialization implemented for token type "strokeStyle"',
    );
    expect(result.diagnostics.map((d) => d.context)).toEqual([
      'light/default',
      'light/reduced',
      'light/forced-reduced-motion',
      'dark/default',
      'dark/reduced',
      'dark/forced-reduced-motion',
    ]);
  });

  test('a trusted recipe projects an otherwise unsupported type', () => {
    const result = evaluateTheme(
      baseSources((documents) => {
        documents['profile-base.tokens.json']!['stroke'] = {
          $type: 'strokeStyle',
          edge: {
            $value: 'solid',
            $extensions: publicToken('--cinder-stroke-edge', {
              cssRecipe: '1px solid currentColor',
            }),
          },
        };
      }),
    );
    expect(result.ok && result.properties['dark/default']!['--cinder-stroke-edge']).toBe(
      '1px solid currentColor',
    );
  });

  test('a new public token appears in every context with no registration step', () => {
    const result = evaluateTheme(
      baseSources((documents) => {
        documents['profile-base.tokens.json']!['badge'] = {
          $type: 'color',
          fill: {
            $value: '{palette.paper}',
            $extensions: publicToken('--cinder-badge-fill', { component: 'badge' }),
          },
        };
      }),
    );
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    for (const id of Object.keys(result.properties)) {
      expect(result.properties[id]!['--cinder-badge-fill']).toBe('var(--cinder-palette-paper)');
      const token = result.provenance.tokens[id]!.find(
        (candidate) => candidate.path === 'badge.fill',
      );
      expect(token?.dependencies.map((dependency) => dependency.path)).toEqual(['palette.paper']);
    }
  });

  test('a private runtime variable never reaches the public output', () => {
    const result = evaluateTheme(
      baseSources((documents) => {
        documents['profile-base.tokens.json']!['internal'] = {
          scratch: {
            $type: 'color',
            $value: { colorSpace: 'srgb', components: [0, 0, 0] },
            $extensions: publicToken('--_cinder-scratch', { public: false }),
          },
        };
      }),
    );
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    for (const properties of Object.values(result.properties)) {
      expect(Object.keys(properties).some((property) => property.startsWith('--_cinder-'))).toBe(
        false,
      );
    }
  });

  test('the context property maps differ where the contexts differ', () => {
    const result = evaluateTheme(baseSources());
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    expect(result.properties['light/default']!['--cinder-motion-fast']).toBe('200ms');
    expect(result.properties['light/reduced']!['--cinder-motion-fast']).toBe('0ms');
    expect(result.properties['light/forced-reduced-motion']!['--cinder-motion-fast']).toBe('1ms');
    expect(result.properties['light/reduced']!['--cinder-motion-normal']).toBe(
      'var(--cinder-motion-fast)',
    );
  });

  test('rejects a resolver that is not a resolver, and a document nothing references', () => {
    const notResolver = failure({ revision: 'r', resolver: 'nope', documents: {} });
    expect(notResolver.diagnostics[0]).toMatchObject({ revision: 'r', path: '$' });
    const extra = failure(
      baseSources((documents) => {
        documents['orphan.tokens.json'] = { $type: 'color' };
      }),
    );
    expect(extra.diagnostics.map((d) => d.reason)).toContain(
      'token document is not referenced by the resolver',
    );
  });
});

describe('evaluateTheme when a context fails unexpectedly', () => {
  test('reports the failure against that context instead of throwing', () => {
    // Projection builds each context's property map with Object.fromEntries; make it fail
    // for the maps only, so validation (which also relies on it) is unaffected.
    const real = Object.fromEntries.bind(Object);
    const failing = spyOn(Object, 'fromEntries').mockImplementation(((entries: Iterable<any>) => {
      const pairs = [...entries];
      if (pairs.some(([key]) => typeof key === 'string' && key.startsWith('--cinder-'))) {
        throw new Error('projection exploded');
      }
      return real(pairs);
    }) as typeof Object.fromEntries);
    let result: ReturnType<typeof evaluateTheme>;
    try {
      result = evaluateTheme(baseSources());
    } finally {
      failing.mockRestore();
    }
    expect(result.ok).toBe(false);
    expect(result.diagnostics.map((d) => d.context)).toEqual([
      'light/default',
      'light/reduced',
      'light/forced-reduced-motion',
      'dark/default',
      'dark/reduced',
      'dark/forced-reduced-motion',
    ]);
    expect(
      result.diagnostics.every((d) => d.reason === 'projection exploded' && d.path === '$'),
    ).toBe(true);
  });
});

describe('validateThemeSources', () => {
  test('reports no diagnostics for a valid theme and echoes the revision', () => {
    expect(validateThemeSources(baseSources())).toEqual({ revision: 7, diagnostics: [] });
  });

  test('reports the same diagnostics evaluation does for an invalid theme', () => {
    const sources = baseSources((documents) => {
      documents['profile-base.tokens.json']!['palette'].ink.$value = 'not a color';
    });
    expect(validateThemeSources(sources).diagnostics).toEqual(failure(sources).diagnostics);
  });
});

describe('schema validation through the runtime', () => {
  function themeWithStroke(value: unknown, groupTyped: boolean) {
    return baseSources((documents) => {
      documents['profile-base.tokens.json']!['stroke'] = groupTyped
        ? {
            $type: 'strokeStyle',
            edge: {
              $value: value,
              $extensions: publicToken('--cinder-edge', { cssRecipe: 'solid' }),
            },
          }
        : {
            edge: {
              $type: 'strokeStyle',
              $value: value,
              $extensions: publicToken('--cinder-edge', { cssRecipe: 'solid' }),
            },
          };
    });
  }

  test.each([true, false])(
    'accepts a named stroke style (type from the group: %p)',
    (groupTyped) => {
      expect(evaluateTheme(themeWithStroke('dashed', groupTyped)).ok).toBe(true);
    },
  );

  test.each([
    ['none', true],
    ['hidden', true],
    ['none', false],
    ['hidden', false],
    ['banana', true],
  ])('rejects %p as a stroke style (type from the group: %p)', (value, groupTyped) => {
    const result = evaluateTheme(themeWithStroke(value, groupTyped));
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.reason.startsWith('must be one of ["solid"'))).toBe(
      true,
    );
  });
});

test('the cascade helper distinguishes contexts', () => {
  const css = ':root { --a: 1; }\n[data-theme="dark"] { --a: 2; }';
  expect(cascadeCustomProperties(css, { theme: 'light', motion: 'default' }).get('--a')).toBe('1');
  expect(cascadeCustomProperties(css, { theme: 'dark', motion: 'default' }).get('--a')).toBe('2');
  expect(() =>
    cascadeCustomProperties('a:hover { --a: 1; }', { theme: 'dark', motion: 'default' }),
  ).toThrow('Unsupported selector form');
});
