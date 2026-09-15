import { describe, expect, test } from 'bun:test';

import { clone, isToken, mergeDocuments, mergeTraceMetadata } from './resolve-merge.ts';
import { resolveDocuments, resolveDocumentsWithTrace } from './resolve.ts';
import type { TraceMetadata, TraceState } from './trace.ts';
import { TokenValidationError, type TokenDocument } from './types.ts';

function traced(documents: TokenDocument[], identifiers: string[]) {
  const sources = new Map<object, string>();
  documents.forEach((document, index) => sources.set(document, identifiers[index]!));
  return resolveDocumentsWithTrace(documents, sources, identifiers);
}

describe('resolver provenance', () => {
  test('deeply isolates copied node, group, and group-type provenance', () => {
    const location = (documentId: string, tokenPath: string) => ({
      documentId,
      tokenPath,
      sourcePointer: `/${tokenPath}`,
      sourceIndex: 0,
    });
    const source = { group: { token: { $value: 1 } } } as TokenDocument;
    const sourceGroup = source['group'] as Record<string, unknown>;
    const sourceToken = sourceGroup['token'] as Record<string, unknown>;
    const state: TraceState = {
      nodes: new WeakMap(),
      groups: new WeakMap(),
      groupTypes: new WeakMap(),
    };
    state.nodes.set(sourceToken, {
      location: location('source.json', 'group.token'),
      contributions: [location('base.json', 'group.token')],
      typeOrigin: location('types.json', 'group/$type'),
      dependencies: [
        {
          kind: 'alias',
          source: location('source.json', 'group.token'),
          targetPath: 'target',
          target: location('source.json', 'target'),
        },
        { kind: 'reference', source: location('source.json', 'group.token'), targetPath: 'other' },
      ],
    });
    state.groups.set(sourceGroup, location('source.json', 'group'));
    state.groupTypes.set(sourceGroup, location('types.json', 'group/$type'));

    const copy = clone(source, undefined, state);
    const copyGroup = copy['group'] as Record<string, unknown>;
    const copyToken = copyGroup['token'] as Record<string, unknown>;
    const copyMetadata = state.nodes.get(copyToken)!;
    copyMetadata.location.documentId = 'copy.json';
    copyMetadata.contributions[0]!.tokenPath = 'copy.token';
    copyMetadata.typeOrigin!.sourcePointer = '/copy/$type';
    copyMetadata.dependencies[0]!.source.documentId = 'copy.json';
    copyMetadata.dependencies[0]!.target!.tokenPath = 'copy.target';
    copyMetadata.dependencies[1]!.source.documentId = 'copy.json';
    state.groups.get(copyGroup)!.documentId = 'copy.json';
    state.groupTypes.get(copyGroup)!.sourcePointer = '/copy/$type';

    expect(state.nodes.get(sourceToken)).toMatchObject({
      location: { documentId: 'source.json' },
      contributions: [{ tokenPath: 'group.token' }],
      typeOrigin: { sourcePointer: '/group/$type' },
      dependencies: [
        { source: { documentId: 'source.json' }, target: { tokenPath: 'target' } },
        { source: { documentId: 'source.json' } },
      ],
    });
    expect(state.groups.get(sourceGroup)).toEqual(location('source.json', 'group'));
    expect(state.groupTypes.get(sourceGroup)).toEqual(location('types.json', 'group/$type'));
    expect(copyMetadata.dependencies[1]).not.toHaveProperty('target');

    state.nodes.get(sourceToken)!.location.documentId = 'source-mutated.json';
    state.nodes.get(sourceToken)!.contributions[0]!.tokenPath = 'source-mutated.token';
    state.nodes.get(sourceToken)!.typeOrigin!.sourcePointer = '/source-mutated/$type';
    state.nodes.get(sourceToken)!.dependencies[0]!.source.documentId = 'source-mutated.json';
    state.nodes.get(sourceToken)!.dependencies[0]!.target!.tokenPath = 'source-mutated.target';
    state.groups.get(sourceGroup)!.documentId = 'source-mutated.json';
    state.groupTypes.get(sourceGroup)!.sourcePointer = '/source-mutated/$type';
    expect(state.nodes.get(copyToken)).toMatchObject({
      location: { documentId: 'copy.json' },
      contributions: [{ tokenPath: 'copy.token' }],
      typeOrigin: { sourcePointer: '/copy/$type' },
      dependencies: [
        { source: { documentId: 'copy.json' }, target: { tokenPath: 'copy.target' } },
        { source: { documentId: 'copy.json' } },
      ],
    });
    expect(state.groups.get(copyGroup)).toEqual(location('copy.json', 'group'));
    expect(state.groupTypes.get(copyGroup)).toMatchObject({
      documentId: 'types.json',
      sourcePointer: '/copy/$type',
    });
  });

  test('deeply isolates merged dependency locations', () => {
    const location = (documentId: string, tokenPath: string) => ({
      documentId,
      tokenPath,
      sourcePointer: `/${tokenPath}`,
      sourceIndex: 0,
    });
    const base: TraceMetadata = {
      location: location('base.json', 'base'),
      contributions: [],
      typeOrigin: null,
      dependencies: [
        {
          kind: 'alias',
          source: location('base.json', 'base'),
          targetPath: 'target',
          target: location('base.json', 'target'),
        },
      ],
    };
    const override: TraceMetadata = {
      location: location('override.json', 'override'),
      contributions: [],
      typeOrigin: null,
      dependencies: [
        {
          kind: 'reference',
          source: location('override.json', 'override'),
          targetPath: 'reference',
        },
      ],
    };

    const merged = mergeTraceMetadata(base, override);
    merged.dependencies[0]!.source.documentId = 'merged-base.json';
    merged.dependencies[0]!.target!.tokenPath = 'merged-target';
    merged.dependencies[1]!.source.documentId = 'merged-override.json';
    base.dependencies[0]!.source.tokenPath = 'mutated-base';
    override.dependencies[0]!.source.tokenPath = 'mutated-override';

    expect(base.dependencies[0]).toMatchObject({
      source: { documentId: 'base.json', tokenPath: 'mutated-base' },
      target: { tokenPath: 'target' },
    });
    expect(override.dependencies[0]).toMatchObject({
      source: { documentId: 'override.json', tokenPath: 'mutated-override' },
    });
    expect(merged.dependencies[0]).toMatchObject({
      source: { documentId: 'merged-base.json', tokenPath: 'base' },
      target: { tokenPath: 'merged-target' },
    });
    expect(merged.dependencies[1]).toMatchObject({
      source: { documentId: 'merged-override.json', tokenPath: 'override' },
    });
    expect(merged.dependencies[1]).not.toHaveProperty('target');
  });

  test('preserves authored extension diagnostic locations after source preparation', () => {
    for (const reference of ['{missing}', '#/invalid~3pointer']) {
      try {
        traced(
          [
            { derived: { $type: 'number', value: { $value: 1 } } },
            { derived: { $extends: reference } },
          ],
          ['base.json', 'override.json'],
        );
        throw new Error('Expected extension rejection');
      } catch (error) {
        expect(error).toBeInstanceOf(TokenValidationError);
        expect((error as TokenValidationError).issues[0]?.path).toBe(
          'override.json.derived.$extends',
        );
      }
    }
  });

  test('reset removes only the selected override and recomputes fallback origins and edges', () => {
    const base: TokenDocument = {
      value: { $type: 'number', $value: 1 },
      target: { $type: 'number', $value: 7 },
    };
    const shared: TokenDocument = { value: { $value: '{target}' } };
    const theme: TokenDocument = { value: { $value: 4 } };
    const motion: TokenDocument = { value: { $value: 0 } };
    const documents = [base, shared, theme, motion];
    const identifiers = [
      'base.json',
      'overrides/shared.json',
      'overrides/dark.json',
      'overrides/reduced.json',
    ];
    const evaluate = () => traced(documents, identifiers);
    expect(evaluate().resolved['value']!.$value).toBe(0);
    delete motion['value'];
    const themeFallback = evaluate();
    expect(themeFallback.resolved['value']!.$value).toBe(4);
    expect(themeFallback.traces.get('value')?.winningLocation).toEqual({
      documentId: identifiers[2]!,
      tokenPath: 'value',
      sourcePointer: '/value',
      sourceIndex: 2,
    });
    expect(
      themeFallback.traces.get('value')?.contributingLocations.map((source) => source.documentId),
    ).toEqual(identifiers.slice(0, 3));
    expect(themeFallback.traces.get('value')?.directDependencies).toEqual([]);
    delete theme['value'];
    const sharedFallback = evaluate();
    expect(sharedFallback.resolved['value']!.$value).toBe(7);
    expect(sharedFallback.traces.get('value')?.winningLocation).toEqual({
      documentId: identifiers[1]!,
      tokenPath: 'value',
      sourcePointer: '/value',
      sourceIndex: 1,
    });
    expect(
      sharedFallback.traces.get('value')?.contributingLocations.map((source) => source.documentId),
    ).toEqual(identifiers.slice(0, 2));
    expect(sharedFallback.traces.get('value')?.directDependencies).toEqual([
      {
        kind: 'alias',
        source: {
          documentId: identifiers[1]!,
          tokenPath: 'value',
          sourcePointer: '/value/$value',
          sourceIndex: 1,
        },
        targetPath: 'target',
        target: {
          documentId: identifiers[0]!,
          tokenPath: 'target',
          sourcePointer: '/target',
          sourceIndex: 0,
        },
      },
    ]);
    delete shared['value'];
    const baseFallback = evaluate();
    expect(baseFallback.resolved['value']!.$value).toBe(1);
    expect(baseFallback.traces.get('value')?.winningLocation.sourceIndex).toBe(0);
    expect(baseFallback.traces.get('value')?.contributingLocations).toHaveLength(1);
    expect(baseFallback.traces.get('value')?.directDependencies).toEqual([]);
    expect(documents).toEqual([base, {}, {}, {}]);
  });

  test('keeps distinct source indexes when the same input object is applied twice', () => {
    const source = { g: { $type: 'number', x: { $value: 100 } } } as TokenDocument;
    const result = traced([source, source], ['base.json', 'base.json']);
    expect(
      result.traces.get('g.x')?.contributingLocations.map((location) => location.sourceIndex),
    ).toEqual([0, 1]);
  });

  test('attributes a group-only type override to the winning group field', () => {
    const result = traced(
      [
        { g: { $type: 'number', x: { $value: 100 } } } as TokenDocument,
        { g: { $type: 'fontWeight' } } as TokenDocument,
      ],
      ['base.json', 'override.json'],
    );
    expect(result.resolved['g.x']!.$type).toBe('fontWeight');
    expect(result.traces.get('g.x')?.typeOrigin).toMatchObject({
      documentId: 'override.json',
      sourcePointer: '/g/$type',
      sourceIndex: 1,
    });
  });

  test('traces tokens copied by the real extends operation', () => {
    const result = traced(
      [
        {
          base: { $type: 'number', x: { $value: 2 } },
          derived: { $extends: '{base}' },
        } as TokenDocument,
      ],
      ['base.json'],
    );
    expect(result.resolved['derived.x']!.$value).toBe(2);
    expect(result.traces.get('derived.x')).toBeDefined();
    expect(
      result.traces
        .get('derived.x')
        ?.directDependencies.some((dependency) => dependency.kind === 'extends'),
    ).toBe(true);
  });

  test('records a whole-token reference edge at the authored $ref field', () => {
    const result = traced(
      [{ a: { $type: 'number', $value: 2 }, b: { $ref: '#/a' } } as TokenDocument],
      ['tokens.json'],
    );
    const dependency = result.traces
      .get('b')
      ?.directDependencies.find((candidate) => candidate.kind === 'reference');
    expect(dependency).toMatchObject({
      targetPath: 'a',
      source: { sourcePointer: '/b/$ref' },
    });
  });

  test('keeps traced and untraced values identical without mutating frozen source', () => {
    const source = Object.freeze({
      a: Object.freeze({ $type: 'number', $value: 2 }),
      b: Object.freeze({ $value: '{a}' }),
    }) as TokenDocument;
    const before = JSON.stringify(source);
    const result = traced([source], ['frozen.json']);
    expect(JSON.stringify(source)).toBe(before);
    expect(result.resolved['b']!.$value).toBe(2);
  });

  test('records two-hop aliases and the active value field as dependencies', () => {
    const result = traced(
      [
        {
          a: { $type: 'number', $value: 2 },
          b: { $type: 'number', $value: '{a}' },
          c: { $type: 'number', $value: '{b}' },
        } as TokenDocument,
      ],
      ['aliases.json'],
    );
    expect(result.resolved['c']!.$value).toBe(2);
    expect(result.traces.get('c')?.directDependencies).toEqual([
      expect.objectContaining({
        kind: 'alias',
        targetPath: 'b',
        source: expect.objectContaining({ sourcePointer: '/c/$value' }),
      }),
    ]);
  });

  test('follows whole-token reference type origins through two hops', () => {
    const result = traced(
      [
        {
          a: { $type: 'number', $value: 1 },
          b: { $ref: '#/a' },
          c: { $ref: '#/b' },
        } as TokenDocument,
      ],
      ['references.json'],
    );
    expect(result.traces.get('c')?.typeOrigin).toMatchObject({ sourcePointer: '/a/$type' });
  });

  test('isolates extension edges between chained copies', () => {
    const result = traced(
      [
        {
          leaf: { $extends: '{mid}' },
          mid: { $extends: '{base}' },
          base: { $root: { $type: 'number', $value: 1 }, x: { $value: 2 } },
        } as TokenDocument,
      ],
      ['extends.json'],
    );
    expect(result.traces.get('base.x')?.directDependencies).toEqual([]);
    expect(result.traces.get('mid.x')?.directDependencies).toEqual([
      expect.objectContaining({ kind: 'extends', targetPath: 'base.x' }),
    ]);
    expect(result.traces.get('leaf.x')?.directDependencies).toEqual([
      expect.objectContaining({ kind: 'extends', targetPath: 'mid.x' }),
    ]);
  });

  test('traces nested group copies at each extends operation', () => {
    const source = {
      base: { nested: { x: { $value: 1 } } },
      mid: { $extends: '{base}' },
      leaf: { $extends: '{mid}' },
    } as TokenDocument;
    const result = traced([source], ['nested-extends.json']);

    expect(result.traces.get('base.nested.x')?.directDependencies).toEqual([]);
    expect(result.traces.get('mid.nested.x')?.directDependencies).toEqual([
      expect.objectContaining({
        kind: 'extends',
        targetPath: 'base.nested.x',
        source: expect.objectContaining({
          tokenPath: 'mid',
          sourcePointer: '/mid/$extends',
        }),
        target: expect.objectContaining({
          tokenPath: 'base.nested.x',
          sourcePointer: '/base/nested/x',
        }),
      }),
    ]);
    expect(result.traces.get('leaf.nested.x')?.directDependencies).toEqual([
      expect.objectContaining({
        kind: 'extends',
        targetPath: 'mid.nested.x',
        source: expect.objectContaining({
          tokenPath: 'leaf',
          sourcePointer: '/leaf/$extends',
        }),
        target: expect.objectContaining({
          tokenPath: 'base.nested.x',
          sourcePointer: '/base/nested/x',
        }),
      }),
    ]);
  });

  test('tracks forward, nested, and root extensions with authored pointers', () => {
    const result = traced(
      [
        {
          child: { $extends: '{parent}' },
          parent: { $extends: '{base}' },
          base: { $type: 'number', $root: { $value: 1 }, nested: { $value: 2 } },
        } as TokenDocument,
      ],
      ['forward.json'],
    );
    expect(result.resolved['child']!.$value).toBe(1);
    expect(result.resolved['child.nested']!.$value).toBe(2);
    expect(result.traces.get('child')?.winningLocation.sourcePointer).toBe('/base/$root');
    expect(result.traces.get('child')?.typeOrigin?.sourcePointer).toBe('/base/$type');
    expect(result.traces.get('child')?.directDependencies[0]?.source.sourcePointer).toBe(
      '/child/$extends',
    );
  });

  test('nearest inherited type beats a distant group type and local type wins locally', () => {
    const result = traced(
      [
        {
          $type: 'number',
          outer: {
            $type: 'number',
            inner: { $type: 'number', a: { $value: 1 }, b: { $value: 0 } },
          },
        } as unknown as TokenDocument,
      ],
      ['types.json'],
    );
    expect(result.resolved['outer.inner.a']!.$type).toBe('number');
    expect(result.traces.get('outer.inner.a')?.typeOrigin?.sourcePointer).toBe(
      '/outer/inner/$type',
    );
    expect(result.resolved['outer.inner.b']!.$type).toBe('number');
  });

  test('partial and value-only overrides preserve identity metadata but replace recipe inputs', () => {
    const result = traced(
      [
        {
          token: {
            $value: 1,
            $extensions: {
              'com.lostgradient.cinder': {
                usageContracts: [{ property: 'x', profile: 'number' }],
                recipeInputs: ['a'],
              },
            },
          },
        } as TokenDocument,
        { token: { $value: 2 } } as TokenDocument,
      ],
      ['base.json', 'override.json'],
    );
    expect(result.resolved['token']!.$value).toBe(2);
    expect(result.resolved['token']!.$extensions?.['com.lostgradient.cinder']).toMatchObject({
      usageContracts: [{ property: 'x', profile: 'number' }],
    });
    expect(result.resolved['token']!.$extensions?.['com.lostgradient.cinder']).not.toHaveProperty(
      'recipeInputs',
    );
  });

  test('drops CSS-only recipe metadata when a value-only override becomes representable', () => {
    const result = mergeDocuments([
      {
        token: {
          $type: 'dimension',
          $value: { value: 1, unit: 'rem' },
          $extensions: {
            'com.lostgradient.cinder': {
              cssProperty: '--cinder-spacing-token',
              public: true,
              usageContracts: [{ property: 'margin', profile: 'signed-length' }],
              cssRecipe: 'calc(100% - 1rem)',
              recipeInputs: [],
              nonRepresentableValue: true,
              portabilityReason: 'recipe requires a CSS calculation',
            },
          },
        },
      } as TokenDocument,
      {
        token: { $value: { value: 2, unit: 'rem' } },
      } as TokenDocument,
    ]);
    const token = result['token'];
    if (!isToken(token)) throw new Error('Expected merged token');
    const metadata = token.$extensions?.['com.lostgradient.cinder'];
    expect(metadata).toMatchObject({
      cssProperty: '--cinder-spacing-token',
      public: true,
      usageContracts: [{ property: 'margin', profile: 'signed-length' }],
    });
    expect(metadata).not.toHaveProperty('cssRecipe');
    expect(metadata).not.toHaveProperty('recipeInputs');
    expect(metadata).not.toHaveProperty('nonRepresentableValue');
    expect(metadata).not.toHaveProperty('portabilityReason');
  });

  test('preserves public spacing membership when a later layer changes the literal value', () => {
    const base: TokenDocument = {
      space: {
        small: {
          $type: 'dimension',
          $value: { value: 4, unit: 'px' },
          $extensions: {
            'com.lostgradient.cinder': {
              public: true,
              cssProperty: '--cinder-space-small',
              scale: 'spacing',
              usageContracts: [{ property: 'padding', profile: 'nonnegative-length' }],
            },
          },
        },
      },
    };
    const override: TokenDocument = { space: { small: { $value: { value: 8, unit: 'px' } } } };
    const before = JSON.stringify([base, override]);
    const result = traced([base, override], ['base.json', 'override.json']);
    expect(result.resolved['space.small']?.$value).toEqual({ value: 8, unit: 'px' });
    expect(result.resolved['space.small']?.$extensions?.['com.lostgradient.cinder']).toMatchObject({
      public: true,
      cssProperty: '--cinder-space-small',
      scale: 'spacing',
      usageContracts: [{ property: 'padding', profile: 'nonnegative-length' }],
    });
    expect(JSON.stringify([base, override])).toBe(before);
  });

  test('records exact nested composite reference pointers and resolved target locations', () => {
    const result = traced(
      [
        {
          base: { $type: 'number', $value: 2 },
          composite: { $value: { left: '{base}', nested: { right: '{base}' } } },
        } as TokenDocument,
      ],
      ['composite.json'],
    );
    expect(result.resolved['composite']!.$value).toEqual({ left: 2, nested: { right: 2 } });
    expect(
      result.traces
        .get('composite')
        ?.directDependencies.map((dependency) => dependency.source.sourcePointer),
    ).toEqual(['/composite/$value/left', '/composite/$value/nested/right']);
  });

  test('captures canonical targets for property references through tokens and roots', () => {
    const result = traced(
      [
        {
          $root: { $type: 'dimension', $value: { value: 7, unit: 'rem' } },
          dimension: { $type: 'dimension', $value: { value: 2, unit: 'rem' } },
          nested: { $root: { $type: 'dimension', $value: { value: 3, unit: 'rem' } } },
          dimensionValue: { $value: '#/dimension/$value/value' },
          nestedRootValue: { $value: '#/nested/$root/$value/value' },
          documentRootValue: { $value: '#/$root/$value/value' },
        } as TokenDocument,
      ],
      ['property-references.json'],
    );
    expect(result.resolved['dimensionValue']!.$value).toBe(2);
    expect(result.resolved['nestedRootValue']!.$value).toBe(3);
    expect(result.resolved['documentRootValue']!.$value).toBe(7);
    expect(
      ['dimensionValue', 'nestedRootValue', 'documentRootValue'].map((path) =>
        result.traces.get(path)?.directDependencies.map((dependency) => ({
          kind: dependency.kind,
          targetPath: dependency.targetPath,
          targetPointer: dependency.target?.sourcePointer,
        })),
      ),
    ).toEqual([
      [{ kind: 'reference', targetPath: 'dimension', targetPointer: '/dimension' }],
      [{ kind: 'reference', targetPath: 'nested', targetPointer: '/nested/$root' }],
      [{ kind: 'reference', targetPath: '', targetPointer: '/$root' }],
    ]);
  });

  test('does not infer a parent type for a scalar property reference', () => {
    const result = traced(
      [
        {
          dimension: { $type: 'dimension', $value: { value: 2, unit: 'rem' } },
          scalar: { $ref: '#/dimension/$value/value' },
        } as TokenDocument,
      ],
      ['scalar-property-reference.json'],
    );
    expect(result.resolved['scalar']!.$value).toBe(2);
    expect(result.resolved['scalar']!.$type).toBeUndefined();
    expect(result.traces.get('scalar')?.typeOrigin).toBeNull();
  });

  test('traces aliases from the document root token path', () => {
    const result = traced(
      [
        {
          $root: { $type: 'number', $value: '{base}' },
          base: { $type: 'number', $value: 2 },
        } as TokenDocument,
      ],
      ['document-root-alias.json'],
    );
    expect(result.resolved['']!.$value).toBe(2);
    expect(result.traces.get('')?.directDependencies).toEqual([
      expect.objectContaining({
        kind: 'alias',
        targetPath: 'base',
        source: expect.objectContaining({ sourcePointer: '/$root/$value' }),
        target: expect.objectContaining({ sourcePointer: '/base' }),
      }),
    ]);
  });

  test('records an overwritten extends source at the later authored field', () => {
    const result = traced(
      [
        {
          first: { value: { $value: 1 } },
          second: { value: { $value: 2 } },
          derived: { $extends: '{first}' },
        } as TokenDocument,
        { derived: { $extends: '{second}' } } as TokenDocument,
      ],
      ['base.json', 'override.json'],
    );
    expect(result.resolved['derived.value']!.$value).toBe(2);
    expect(result.traces.get('derived.value')?.directDependencies).toEqual([
      expect.objectContaining({
        kind: 'extends',
        targetPath: 'second.value',
        source: expect.objectContaining({
          documentId: 'override.json',
          sourcePointer: '/derived/$extends',
        }),
      }),
    ]);
  });

  test('deduplicates repeated direct edges while retaining contributions', () => {
    const result = traced(
      [
        {
          base: { $type: 'number', $value: 2 },
          composite: { $value: ['{base}', '{base}'] },
        } as TokenDocument,
      ],
      ['dedupe.json'],
    );
    expect(result.traces.get('composite')?.contributingLocations).toHaveLength(1);
    expect(
      result.traces.get('composite')?.directDependencies.filter((d) => d.kind === 'alias'),
    ).toHaveLength(2);
  });

  test('unknown source identity yields null trace data without invented identifiers', () => {
    const source = { token: { $value: 1 } } as TokenDocument;
    const result = resolveDocumentsWithTrace([source], new Map());
    expect(result.traces.size).toBe(0);
    expect(JSON.stringify(result.resolved['token']!)).not.toContain('unknown');
  });

  test('traced resolution preserves CIN-593 diagnostics for invalid group roots', () => {
    const source = { group: { $extends: '{missing}' } } as TokenDocument;
    expect(() =>
      resolveDocumentsWithTrace([source], new Map([[source, 'invalid.json']])),
    ).toThrow();
  });
});

test('root-token overrides retain metadata and ordered provenance like ordinary tokens', () => {
  const base: TokenDocument = {
    surface: {
      $type: 'number',
      $root: {
        $value: 1,
        $description: 'Base root',
        $extensions: {
          'com.lostgradient.cinder': {
            cssProperty: '--cinder-surface',
            public: true,
            usageContracts: [{ property: 'opacity', profile: 'opacity' }],
          },
        },
      },
    },
  };
  const override: TokenDocument = { surface: { $root: { $value: 2 } } };
  const result = traced([base, override], ['base.json', 'override.json']);
  expect(result.resolved['surface']).toEqual(resolveDocuments([base, override])['surface']);
  expect(result.resolved['surface']?.$description).toBe('Base root');
  expect(result.resolved['surface']?.$extensions?.['com.lostgradient.cinder']).toMatchObject({
    cssProperty: '--cinder-surface',
    public: true,
  });
  expect(
    result.traces
      .get('surface')
      ?.contributingLocations.map((location) => [location.sourceIndex, location.sourcePointer]),
  ).toEqual([
    [0, '/surface/$root'],
    [1, '/surface/$root'],
  ]);
  expect(result.traces.get('surface')?.winningLocation.documentId).toBe('override.json');
});

test('nested copied roots and missing nested groups target their immediate source identities', () => {
  const source: TokenDocument = {
    base: {
      $type: 'number',
      $root: { $value: 1 },
      nested: { $root: { $value: 2 }, deep: { item: { $value: 3 } } },
    },
    middle: { $extends: '{base}', nested: { own: { $value: 4 } } },
    leaf: { $extends: '{middle}' },
  };
  const result = traced([source], ['roots.json']);
  for (const [path, targetPath, sourcePointer] of [
    ['middle', 'base', '/middle/$extends'],
    ['middle.nested', 'base.nested', '/middle/$extends'],
    ['middle.nested.deep.item', 'base.nested.deep.item', '/middle/$extends'],
    ['leaf', 'middle', '/leaf/$extends'],
    ['leaf.nested', 'middle.nested', '/leaf/$extends'],
    ['leaf.nested.deep.item', 'middle.nested.deep.item', '/leaf/$extends'],
  ]) {
    expect(result.traces.get(path!)?.directDependencies).toEqual([
      expect.objectContaining({
        kind: 'extends',
        targetPath,
        source: expect.objectContaining({ sourcePointer }),
      }),
    ]);
  }
});

test('source identities reject non-normalized paths and preserve valid repeated applications', () => {
  const source: TokenDocument = { value: { $type: 'number', $value: 1 } };
  for (const id of [
    '',
    './base.json',
    'sets//base.json',
    'sets/../base.json',
    '/base.json',
    'https://example.com/base.json',
    'C:\\base.json',
    'sets/./base.json',
  ]) {
    expect(() => traced([source], [id])).toThrow('normalized relative document identities');
    if (id)
      expect(() => resolveDocumentsWithTrace([source], new Map([[source, id]]))).toThrow(
        'normalized relative document identities',
      );
  }
  const result = traced([source, source], ['sets/base..json', 'overrides/shared.tokens.json']);
  expect(
    result.traces
      .get('value')
      ?.contributingLocations.map(({ documentId, sourceIndex }) => [documentId, sourceIndex]),
  ).toEqual([
    ['sets/base..json', 0],
    ['overrides/shared.tokens.json', 1],
  ]);
});
