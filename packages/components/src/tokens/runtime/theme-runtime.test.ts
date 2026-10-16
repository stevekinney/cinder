import { throwingRejectionOf } from '@lostgradient/testing';
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

import {
  cloneCorpus,
  deepClone,
  loadProfileCorpus,
} from '../../../scripts/tokens/authoring-test-support.ts';
import { buildTokensBaseCss } from '../../../scripts/tokens/css-generator.ts';
import { loadCorpus } from '../../../scripts/tokens/generate.ts';
import {
  resolvedDirectory,
  tokensBaseCssPath,
} from '../../../scripts/tokens/generator-configuration.ts';
import { buildResolvedContexts } from '../../../scripts/tokens/resolved-contexts.ts';
import { TOKEN_REGISTRY } from '../registry.generated.ts';
import { AUTHORING_CATALOGUE } from './authoring-catalogue.generated.ts';
import { buildAuthoringCatalogue } from './authoring-catalogue.ts';
import { CINDER_BASE } from './base-corpus.ts';
import { authoringContexts, authoringLayerStack } from './context-stack.ts';
import { cinderExtensions } from './corpus.ts';
import { evaluateTheme, type ThemeEvaluation, type ThemeSources } from './evaluate.ts';
import { resolveDocuments } from './resolve.ts';
import { computeSourceDigest } from './source-digest.ts';
import {
  cascadeCustomProperties,
  normalizeCssValues,
  type CascadeContext,
} from './theme-runtime.test-support.ts';
import type { ResolverDocument, TokenDocument } from './types.ts';

const SIX_CONTEXTS = [
  'light/default',
  'light/reduced',
  'light/forced-reduced-motion',
  'dark/default',
  'dark/reduced',
  'dark/forced-reduced-motion',
];

function sourcesOf(
  corpus: { resolver: ResolverDocument; documentsByPath: Map<string, TokenDocument> },
  revision: number | string = 1,
): ThemeSources {
  return {
    revision,
    resolver: corpus.resolver,
    documents: Object.fromEntries(corpus.documentsByPath),
  };
}

function expectOk(result: ThemeEvaluation) {
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics, null, 2));
  return result;
}

/** Runtime properties and the CSS cascade must agree on every public property of a context. */
async function expectRuntimeMatchesCss(
  result: Extract<ThemeEvaluation, { ok: true }>,
  css: string,
): Promise<number> {
  let compared = 0;
  for (const context of result.contexts) {
    const environment: CascadeContext = { theme: context.theme, motion: context.motion };
    const cascaded = await normalizeCssValues(cascadeCustomProperties(css, environment));
    const runtime = await normalizeCssValues(
      new Map(Object.entries(result.properties[context.id]!)),
    );
    for (const [property, value] of runtime) {
      expect(cascaded.get(property), `${context.id} ${property}`).toBe(value);
      compared++;
    }
    for (const property of runtime.keys()) expect(cascaded.has(property)).toBe(true);
  }
  return compared;
}

describe('runtime evaluation of the bundled Cinder base', () => {
  const result = expectOk(
    evaluateTheme({
      revision: 'base',
      resolver: CINDER_BASE.resolver,
      documents: CINDER_BASE.documents,
    }),
  );
  const publicEntries = TOKEN_REGISTRY.entries.filter((entry) => entry.public);

  test('evaluates all six contexts, the forced pair computed from source', () => {
    expect(result.contexts.map((context) => context.id)).toEqual(SIX_CONTEXTS);
    expect(Object.keys(result.properties)).toEqual(SIX_CONTEXTS);
    expect(result.diagnostics).toEqual([]);
    expect(result.revision).toBe('base');
    expect(result.provenance.revision).toBe('base');
  });

  test('exports one property per public registry entry and no private variable', () => {
    expect(publicEntries.length).toBeGreaterThan(0);
    const expected = [...new Set(publicEntries.map((entry) => entry.cssProperty))].toSorted();
    for (const id of SIX_CONTEXTS) {
      const properties = Object.keys(result.properties[id]!);
      expect(properties).toEqual(expected);
      expect(properties.some((property) => property.startsWith('--_cinder-'))).toBe(false);
    }
  });

  test('agrees with the generated stylesheet across all six contexts', async () => {
    const css = readFileSync(tokensBaseCssPath, 'utf8');
    const compared = await expectRuntimeMatchesCss(result, css);
    expect(compared).toBe(
      SIX_CONTEXTS.length * new Set(publicEntries.map((e) => e.cssProperty)).size,
    );
  });

  test('agrees with the CLI-generated stylesheet and resolved JSON, regenerated now', async () => {
    const corpus = await loadCorpus();
    const css = await buildTokensBaseCss(corpus.resolver, corpus.documentsByPath);
    expect(css).toBe(readFileSync(tokensBaseCssPath, 'utf8'));
    const generated = await buildResolvedContexts(corpus.resolver, corpus.documentsByPath);
    expect(generated.size).toBe(4);
    for (const [name, text] of generated) {
      expect(text).toBe(readFileSync(`${resolvedDirectory}/${name}.json`, 'utf8'));
    }
  });

  test('resolved tokens match the published resolved-context JSON for the four published contexts', () => {
    const published: Array<[string, string, string]> = [
      ['light', 'light', 'default'],
      ['dark', 'dark', 'default'],
      ['light-reduced-motion', 'light', 'reduced'],
      ['dark-reduced-motion', 'dark', 'reduced'],
    ];
    const contexts = authoringContexts(CINDER_BASE.resolver);
    const documentsByPath = new Map(Object.entries(CINDER_BASE.documents));
    for (const [name, theme, motion] of published) {
      const context = contexts.find((c) => c.theme === theme && c.motion === motion)!;
      const resolved = resolveDocuments(
        authoringLayerStack(CINDER_BASE.resolver, documentsByPath, context).map((l) => l.content),
      );
      for (const path of Object.keys(resolved)) {
        if (cinderExtensions(resolved[path]!)?.['nonRepresentableValue'] === true)
          delete resolved[path];
      }
      const file: unknown = JSON.parse(readFileSync(`${resolvedDirectory}/${name}.json`, 'utf8'));
      expect(JSON.parse(JSON.stringify(resolved))).toEqual(file);
    }
  });

  test('provenance equals the committed catalogue for every token and context', () => {
    expect(result.provenance.tokens['light/default']!.length).toBeGreaterThan(300);
    const records = new Map(AUTHORING_CATALOGUE.records.map((record) => [record.path, record]));
    let compared = 0;
    for (const id of SIX_CONTEXTS) {
      for (const evaluation of result.provenance.tokens[id]!) {
        const record = records.get(evaluation.path);
        if (!record) continue;
        const variant = record.variants.find((candidate) => candidate.contexts.includes(id))!;
        expect(evaluation.provenance).toEqual(variant.provenance);
        compared++;
      }
    }
    expect(compared).toBe(SIX_CONTEXTS.length * AUTHORING_CATALOGUE.records.length);
  });

  test('the catalogue builder over the bundled base reproduces the committed catalogue', () => {
    const rebuilt = buildAuthoringCatalogue(
      CINDER_BASE.resolver,
      new Map(Object.entries(CINDER_BASE.documents)),
    );
    expect(rebuilt).toEqual(AUTHORING_CATALOGUE);
  });

  test('is deterministic: the same sources give the same result', () => {
    const again = evaluateTheme({
      revision: 'base',
      resolver: CINDER_BASE.resolver,
      documents: CINDER_BASE.documents,
    });
    expect(JSON.stringify(again)).toBe(JSON.stringify(result));
  });

  test('does not mutate its input', () => {
    const documents = deepClone(CINDER_BASE.documents);
    const resolver = deepClone(CINDER_BASE.resolver);
    const before = JSON.stringify({ resolver, documents });
    expectOk(evaluateTheme({ revision: 2, resolver, documents }));
    expect(JSON.stringify({ resolver, documents })).toBe(before);
  });

  test('identifies the base by package version and a digest it can recompute', async () => {
    expect(CINDER_BASE.packageVersion).toBe('workspace');
    expect(CINDER_BASE.sourceDigest).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(await computeSourceDigest(CINDER_BASE)).toBe(CINDER_BASE.sourceDigest);
    const reordered = Object.fromEntries(Object.entries(CINDER_BASE.documents).toReversed());
    expect(
      await computeSourceDigest({ resolver: CINDER_BASE.resolver, documents: reordered }),
    ).toBe(CINDER_BASE.sourceDigest);
  });
});

describe('runtime evaluation of the theme-builder fixtures', () => {
  // A modifier may only override base tokens, so the imported (unbound) token the
  // provenance tests trace on its own is not part of an evaluable theme.
  const corpus = cloneCorpus(loadProfileCorpus());
  delete (corpus.documentsByPath.get('profile-light.tokens.json') as Record<string, unknown>)[
    'imported'
  ];
  const result = expectOk(evaluateTheme(sourcesOf(corpus)));

  test('agrees with the CLI-generated stylesheet across all six contexts', async () => {
    const css = await buildTokensBaseCss(corpus.resolver, corpus.documentsByPath);
    const compared = await expectRuntimeMatchesCss(result, css);
    expect(compared).toBeGreaterThan(SIX_CONTEXTS.length * 10);
  });

  test('an override that relies on an inherited type yields identical CLI CSS and runtime properties', async () => {
    // The light, reduced and forced documents state no group `$type`; they inherit
    // `color` and `duration` from the shared set. Neither the CLI nor the runtime
    // needs the override to restate it, and both read the same evaluated type.
    for (const path of ['profile-light.tokens.json', 'profile-motion-reduced.tokens.json']) {
      const document = corpus.documentsByPath.get(path) as Record<string, Record<string, unknown>>;
      const groups = Object.values(document).filter((value) => typeof value === 'object');
      expect(groups.length).toBeGreaterThan(0);
      for (const group of groups) expect('$type' in group).toBe(false);
    }
    const css = await buildTokensBaseCss(corpus.resolver, corpus.documentsByPath);
    const light = await normalizeCssValues(
      cascadeCustomProperties(css, { theme: 'light', motion: 'default' }),
    );
    const dark = await normalizeCssValues(
      cascadeCustomProperties(css, { theme: 'dark', motion: 'default' }),
    );
    const runtime = await normalizeCssValues(
      new Map(Object.entries(result.properties['light/default']!)),
    );
    expect(light.get('--cinder-palette-paper')).toBe(runtime.get('--cinder-palette-paper'));
    expect(runtime.get('--cinder-palette-paper')).not.toBe(dark.get('--cinder-palette-paper'));
  });

  test('cross-context recipe: a theme override stops inheriting the recipe, a motion override replaces it', () => {
    const halo = (id: string) => result.properties[id]!['--cinder-palette-halo'];
    expect(halo('light/default')).toBe(
      'color-mix(in oklch, var(--cinder-palette-ink), transparent 50%)',
    );
    expect(halo('light/reduced')).toBe(halo('light/default'));
    expect(halo('dark/default')).not.toContain('color-mix');
    // Motion is later in resolution order than theme, so it wins in both themes.
    expect(halo('dark/forced-reduced-motion')).toBe(halo('light/forced-reduced-motion'));
    expect(halo('dark/forced-reduced-motion')).not.toBe(halo('dark/default'));
  });

  test('provenance is identical to the catalogue builder for every token and context', () => {
    const catalogue = buildAuthoringCatalogue(corpus.resolver, corpus.documentsByPath);
    for (const record of catalogue.records) {
      for (const variant of record.variants) {
        for (const id of variant.contexts) {
          const evaluation = result.provenance.tokens[id]!.find((t) => t.path === record.path)!;
          expect(evaluation.provenance).toEqual(variant.provenance);
        }
      }
    }
    expect(result.provenance.layerStacks).toEqual(catalogue.layerStacks);
  });

  test('orders tokens by document/layer then path, with each dependent once per context', () => {
    for (const id of SIX_CONTEXTS) {
      const stack = result.provenance.layerStacks[id]!;
      const rank = (document: string) => stack.findIndex((layer) => layer.document === document);
      const tokens = result.provenance.tokens[id]!;
      const keys = tokens.map(
        (token) => [rank(token.provenance.winner.document), token.path] as const,
      );
      expect(keys).toEqual(
        keys.toSorted((a, b) => a[0] - b[0] || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0)),
      );
      for (const token of tokens) {
        const identities = token.dependents.map((dependent) => dependent.path);
        expect(new Set(identities).size).toBe(identities.length);
        expect(identities).not.toContain(token.path);
        const dependentKeys = token.dependents.map((d) => [rank(d.document), d.path] as const);
        expect(dependentKeys).toEqual(
          dependentKeys.toSorted((a, b) => a[0] - b[0] || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0)),
        );
      }
    }
  });

  test('dependency edges and transitive dependents follow aliases, $extends, and recipes', () => {
    const light = result.provenance.tokens['light/default']!;
    const find = (path: string) => light.find((token) => token.path === path)!;
    expect(find('palette.accent-strong').dependencies.map((d) => d.path)).toEqual([
      'palette.accent',
    ]);
    expect(find('palette.accent').dependencies.map((d) => d.path)).toEqual(['palette.paper']);
    // Two hops: accent-strong -> accent -> paper, so paper has both as dependents.
    expect(find('palette.paper').dependents.map((d) => d.path)).toEqual(
      expect.arrayContaining(['palette.accent', 'palette.accent-strong', 'card.background']),
    );
    // An $extends member depends on the declaration it was copied from.
    expect(find('card-compact.background').dependencies.map((d) => d.path)).toContain(
      'card.background',
    );
    expect(find('card.background').dependents.map((d) => d.path)).toContain(
      'card-compact.background',
    );
    // A trusted recipe reads the public properties it names.
    expect(find('palette.halo').dependencies.map((d) => d.path)).toEqual(['palette.ink']);
    expect(find('palette.ink').dependents.map((d) => d.path)).toContain('palette.halo');
    // The dark theme breaks the alias chain, so accent no longer reads paper there.
    const dark = result.provenance.tokens['dark/default']!;
    expect(dark.find((t) => t.path === 'palette.accent')!.dependencies).toEqual([]);
    expect(
      dark.find((t) => t.path === 'palette.accent-strong')!.dependencies.map((d) => d.path),
    ).toEqual(['palette.accent']);
  });

  test('resetting an override returns provenance and properties to the remaining layer', async () => {
    const reset = cloneCorpus(corpus);
    delete (
      reset.documentsByPath.get('profile-light.tokens.json')!['palette'] as Record<string, unknown>
    )['paper'];
    const after = expectOk(evaluateTheme(sourcesOf(reset, 2)));
    const before = result.provenance.tokens['light/default']!.find(
      (t) => t.path === 'palette.paper',
    )!;
    const now = after.provenance.tokens['light/default']!.find((t) => t.path === 'palette.paper')!;
    expect(before.provenance.winner.document).toBe('profile-light.tokens.json');
    expect(now.provenance.winner).toEqual({
      document: 'profile-base.tokens.json',
      path: 'palette.paper',
    });
    expect(now.provenance.layers.map((layer) => layer.document)).toEqual([
      'profile-base.tokens.json',
    ]);
    expect(after.properties['light/default']!['--cinder-palette-paper']).not.toBe(
      result.properties['light/default']!['--cinder-palette-paper'],
    );
    // The dark context never used the removed override.
    expect(after.properties['dark/default']).toEqual(result.properties['dark/default']);
    // The CLI regenerates the same stylesheet the runtime now describes.
    const css = await buildTokensBaseCss(reset.resolver, reset.documentsByPath);
    await expectRuntimeMatchesCss(after, css);
    expect(after.revision).toBe(2);
    expect(after.provenance.revision).toBe(2);
  });

  test('a later modifier takes precedence over an earlier one, in an order the CLI can export', async () => {
    const reorder = cloneCorpus(corpus);
    reorder.resolver.resolutionOrder = [
      { $ref: '#/sets/foundation' },
      { $ref: '#/modifiers/motion' },
      { $ref: '#/modifiers/theme' },
    ];
    // Motion before theme would change which override wins, and the stylesheet
    // always emits theme blocks first, so both the CLI and the runtime refuse it.
    const swapped = evaluateTheme(sourcesOf(reorder, 3));
    expect(swapped.ok).toBe(false);
    expect(swapped.diagnostics[0]).toMatchObject({
      revision: 3,
      path: '$',
      reason: expect.stringContaining('has "motion" before "theme"'),
    });
    expect(
      await throwingRejectionOf(buildTokensBaseCss(reorder.resolver, reorder.documentsByPath)),
    ).toThrow('has "motion" before "theme"');
    const halo = (id: string) =>
      result.provenance.tokens[id]!.find((t) => t.path === 'palette.halo')!.provenance.winner;
    expect(halo('dark/default').document).toBe('profile-dark.tokens.json');
    expect(halo('dark/reduced').document).toBe('profile-dark.tokens.json');
    expect(halo('dark/forced-reduced-motion').document).toBe('profile-motion-forced.tokens.json');
    expect(halo('light/default').document).toBe('profile-base.tokens.json');
  });
});
