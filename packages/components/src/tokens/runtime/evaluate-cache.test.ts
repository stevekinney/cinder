import { describe, expect, test } from 'bun:test';

import { CINDER_BASE } from './base-corpus.ts';
import { validateCorpus, validateLoadedTokenDocuments } from './corpus-documents.ts';
import { evaluateTheme, evaluateThemeProperties, type ThemeSources } from './evaluate.ts';
import type { ResolverDocument } from './types.ts';

type Group = Record<string, unknown>;

const SIX_CONTEXTS = [
  'light/default',
  'light/reduced',
  'light/forced-reduced-motion',
  'dark/default',
  'dark/reduced',
  'dark/forced-reduced-motion',
];

const deepClone = <T>(value: T): T => structuredClone(value);

/** The bundled base plus extra documents appended to the shared set and, optionally, themes. */
function sourcesWith(options: {
  shared?: Group;
  themeDocuments?: Partial<Record<'light' | 'dark', Group>>;
  replace?: Record<string, Group>;
  revision?: number;
}): ThemeSources {
  const resolver = deepClone(CINDER_BASE.resolver) as unknown as {
    sets: { foundation: { sources: Array<{ $ref: string }> } };
    modifiers: { theme: { contexts: Record<string, Array<{ $ref: string }>> } };
  };
  const documents: Record<string, unknown> = { ...CINDER_BASE.documents };
  for (const [path, document] of Object.entries(options.replace ?? {})) documents[path] = document;
  if (options.shared !== undefined) {
    resolver.sets.foundation.sources.push({ $ref: 'overrides/shared.tokens.json' });
    documents['overrides/shared.tokens.json'] = options.shared;
  }
  for (const [mode, document] of Object.entries(options.themeDocuments ?? {})) {
    resolver.modifiers.theme.contexts[mode]!.push({ $ref: `overrides/${mode}.tokens.json` });
    documents[`overrides/${mode}.tokens.json`] = document;
  }
  return { revision: options.revision ?? 1, resolver, documents };
}

describe('evaluateThemeProperties', () => {
  test('matches evaluateTheme for all six contexts on the bundled base', () => {
    const sources = sourcesWith({});
    const full = evaluateTheme(sources);
    const cheap = evaluateThemeProperties(sources);
    expect(full.ok && cheap.ok).toBe(true);
    if (!full.ok || !cheap.ok) return;
    for (const id of SIX_CONTEXTS) expect(cheap.properties[id]).toEqual(full.properties[id]);
    expect('provenance' in cheap).toBe(false);
  });

  test('matches evaluateTheme after an override', () => {
    const sources = sourcesWith({
      shared: { radius: { medium: { $value: { value: 3, unit: 'px' } } } },
    });
    const full = evaluateTheme(sources);
    const cheap = evaluateThemeProperties(sources);
    if (!full.ok || !cheap.ok) throw new Error('expected both to succeed');
    expect(cheap.properties['dark/reduced']).toEqual(full.properties['dark/reduced']);
    expect(cheap.properties['light/default']?.['--cinder-radius-md']).toBe('3px');
  });

  test('projects only the requested contexts', () => {
    const result = evaluateThemeProperties(sourcesWith({}), { contexts: ['dark/reduced'] });
    if (!result.ok) throw new Error('expected success');
    expect(Object.keys(result.properties)).toEqual(['dark/reduced']);
    expect(result.contexts.map((context) => context.id)).toEqual(['dark/reduced']);
  });

  test('still rejects an edit that is invalid only in a context it did not project', () => {
    const sources = sourcesWith({
      themeDocuments: { dark: { radius: { medium: { $value: '{radius.missing}' } } } },
    });
    expect(evaluateThemeProperties(sources, { contexts: ['light/default'] }).ok).toBe(false);
    expect(evaluateThemeProperties(sources).ok).toBe(false);
  });
});

describe('remembered validation', () => {
  function resolverOf(
    sources: string[],
    themeSources?: { light: string[]; dark: string[] },
  ): ResolverDocument {
    return {
      version: '2025.10',
      sets: { base: { sources: sources.map(($ref) => ({ $ref })) } },
      modifiers:
        themeSources === undefined
          ? {}
          : {
              theme: {
                contexts: {
                  light: themeSources.light.map(($ref) => ({ $ref })),
                  dark: themeSources.dark.map(($ref) => ({ $ref })),
                },
                default: 'light',
              },
            },
      resolutionOrder: [
        { $ref: '#/sets/base' },
        ...(themeSources === undefined ? [] : [{ $ref: '#/modifiers/theme' }]),
      ],
    } as unknown as ResolverDocument;
  }

  const validate = (resolver: ResolverDocument, documents: Record<string, Group>) =>
    validateLoadedTokenDocuments(
      resolver,
      Object.entries(documents).map(([path, document]) => ({ path, document })),
    );

  test('revalidates a document when an earlier document in its prefix changes', () => {
    const resolver = resolverOf(['a.tokens.json', 'b.tokens.json']);
    const override: Group = { group: { x: { $value: { value: 1, unit: 'px' } } } };
    const dimensions: Group = {
      group: { $type: 'dimension', x: { $value: { value: 2, unit: 'px' } } },
    };
    expect(() =>
      validate(resolver, { 'a.tokens.json': dimensions, 'b.tokens.json': override }),
    ).not.toThrow();

    // The override object is the same, but the inherited type it relies on has changed.
    const durations: Group = {
      group: { $type: 'duration', x: { $value: { value: 2, unit: 'ms' } } },
    };
    expect(() =>
      validate(resolver, { 'a.tokens.json': durations, 'b.tokens.json': override }),
    ).toThrow();
  });

  test('does not remember a pass across a stack that uses $extends', () => {
    const resolver = resolverOf(['a.tokens.json'], {
      light: ['light.tokens.json'],
      dark: ['dark.tokens.json'],
    });
    const base: Group = { copy: { $extends: '{forward}' } };
    const target: Group = { forward: { note: { $type: 'number', $value: 1 } } };
    expect(() =>
      validate(resolver, {
        'a.tokens.json': base,
        'light.tokens.json': target,
        'dark.tokens.json': deepClone(target),
      }),
    ).not.toThrow();

    // `a` is unchanged and its ordered prefix is unchanged, but its $extends target is gone.
    expect(() =>
      validate(resolver, {
        'a.tokens.json': base,
        'light.tokens.json': {},
        'dark.tokens.json': {},
      }),
    ).toThrow();
  });

  test('sees a $extends nested under $root', () => {
    const resolver = resolverOf(['a.tokens.json'], {
      light: ['light.tokens.json'],
      dark: ['dark.tokens.json'],
    });
    const base: Group = {
      holder: { $root: { $type: 'number', $value: 1 }, nested: { $extends: '{forward}' } },
    };
    const target: Group = { forward: { note: { $type: 'number', $value: 1 } } };
    const withTarget = {
      'a.tokens.json': base,
      'light.tokens.json': target,
      'dark.tokens.json': deepClone(target),
    };
    expect(() => validate(resolver, withTarget)).not.toThrow();
    expect(() =>
      validate(resolver, {
        'a.tokens.json': base,
        'light.tokens.json': {},
        'dark.tokens.json': {},
      }),
    ).toThrow();
  });

  test('revalidates the resolved tokens when a document they alias changes', () => {
    const resolver = resolverOf(['a.tokens.json', 'b.tokens.json']);
    const corpus = (target: Group) =>
      validateCorpus(resolver, [
        { path: 'a.tokens.json', document: target },
        { path: 'b.tokens.json', document: alias },
      ]);
    const alias: Group = { two: { $type: 'number', $value: '{one}' } };
    const present: Group = { $type: 'number', one: { $value: 1 } };
    expect(() => corpus(present)).not.toThrow();
    expect(() => corpus({ $type: 'number', other: { $value: 1 } })).toThrow();
    expect(() => corpus(present)).not.toThrow();
  });
});
