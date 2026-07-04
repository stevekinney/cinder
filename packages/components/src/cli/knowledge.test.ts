import { describe, expect, it } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CinderKnowledge,
  CinderKnowledgeError,
  loadCinderKnowledge,
  type CinderManifest,
} from './knowledge.ts';
import { validateManifest } from './manifest-validation.ts';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function manifestFixture(): CinderManifest {
  return {
    manifestVersion: 1,
    package: {
      name: '@lostgradient/cinder',
      version: '0.0.0-test',
      framework: 'svelte',
      frameworkVersionRange: '>=5.55.0 <6',
      stylesEntry: '@lostgradient/cinder/styles',
      schemaDialect: 'https://json-schema.org/draft/2020-12/schema',
    },
    categories: {
      navigation: { label: 'Navigation', description: 'Navigation components.' },
    },
    statusLevels: {
      stable: 'Production-ready.',
    },
    overlapFamilies: {
      navigation: ['navigation-bar'],
    },
    components: [
      {
        id: 'navigation-bar',
        name: 'NavigationBar',
        import: '@lostgradient/cinder/navigation-bar',
        exportName: 'NavigationBar',
        category: 'navigation',
        status: 'stable',
        purpose: 'Top-level navigation.',
        tags: ['navigation'],
        useWhen: ['Anchoring app navigation.'],
        avoidWhen: [{ reason: 'Showing breadcrumbs.', alternative: 'breadcrumbs' }],
        related: ['navigation-item'],
        hasConstraints: false,
        hasExamples: true,
        artifacts: {
          schema: '@lostgradient/cinder/navigation-bar/schema',
          variables: '@lostgradient/cinder/navigation-bar/variables',
          examples: '@lostgradient/cinder/navigation-bar/examples',
          constraints: '@lostgradient/cinder/navigation-bar/constraints',
        },
      },
    ],
  };
}

describe('CinderKnowledge', () => {
  it('ranks exact id matches before broader token matches', async () => {
    const knowledge = await loadCinderKnowledge(packageRoot);
    const results = knowledge.search('button', { limit: 5 });

    expect(results[0]?.id).toBe('button');
    expect(results[0]?.matched).toContain('exact');
  });

  it('filters list and search results by category, status, and tag', async () => {
    const knowledge = await loadCinderKnowledge(packageRoot);
    const overlays = knowledge.list({ category: 'overlay', status: 'stable', tag: 'dialog' });
    const modal = overlays.find((component) => component.id === 'modal');

    expect(modal?.category).toBe('overlay');
    expect(modal?.status).toBe('stable');
    expect(modal?.tags).toContain('dialog');
    expect(overlays.every((component) => component.category === 'overlay')).toBe(true);

    const searchResults = knowledge.search('dialog', {
      category: 'overlay',
      status: 'stable',
      limit: 5,
    });

    expect(searchResults.some((component) => component.id === 'modal')).toBe(true);
    expect(searchResults.every((component) => component.category === 'overlay')).toBe(true);
  });

  it('returns suggestions for unknown components', async () => {
    const knowledge = await loadCinderKnowledge(packageRoot);

    await expect(knowledge.show('buton')).rejects.toThrow(CinderKnowledgeError);
    try {
      await knowledge.show('buton');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(CinderKnowledgeError);
      expect((error as CinderKnowledgeError).code).toBe('COMPONENT_NOT_FOUND');
      expect((error as CinderKnowledgeError).suggestions).toContain('button');
    }
  });

  it('reports contract errors for invalid filters, queries, comparisons, and artifacts', async () => {
    const knowledge = await loadCinderKnowledge(packageRoot);

    expect(() => knowledge.list({ category: 'not-a-category' })).toThrow(CinderKnowledgeError);
    expect(() => knowledge.search('button', { status: 'not-a-status' })).toThrow(
      CinderKnowledgeError,
    );
    expect(() => knowledge.search('   ')).toThrow(CinderKnowledgeError);
    expect(() => knowledge.compare(['button'])).toThrow(CinderKnowledgeError);
    await expect(knowledge.artifact('accordion-item', 'examples')).rejects.toThrow(
      CinderKnowledgeError,
    );
  });

  it('exposes deterministic component identifiers for MCP resources', async () => {
    const knowledge = await loadCinderKnowledge(packageRoot);

    expect(knowledge.componentIds()).toContain('button');
    expect(knowledge.componentIds()).toEqual(
      knowledge.manifest.components.map((component) => component.id),
    );
  });

  it('loads component artifacts lazily from manifest sidecars', async () => {
    const knowledge = await loadCinderKnowledge(packageRoot);
    const detail = await knowledge.show('button');
    const schema = await knowledge.artifact('button', 'schema');
    const variables = await knowledge.artifact('button', 'variables');
    const examples = await knowledge.artifact('button', 'examples');
    const constraints = await knowledge.artifact('button', 'constraints');

    expect(detail.component.id).toBe('button');
    expect(isRecord(detail.schema)).toBe(true);
    expect(Array.isArray(detail.variables) || isRecord(detail.variables)).toBe(true);
    expect(detail.examples).toBeDefined();
    expect(detail.constraints).toBeDefined();
    expect(isRecord(schema)).toBe(true);
    expect(Array.isArray(variables) || isRecord(variables)).toBe(true);
    expect(examples).toBeDefined();
    expect(constraints).toBeDefined();
  });

  it('resolves export-name lookups and experimental component sidecars', async () => {
    const temporaryRoot = await mkdtemp(join(tmpdir(), 'cinder-knowledge-'));
    try {
      const componentRoot = join(temporaryRoot, 'src/components/experimental/fake-widget');
      await mkdir(componentRoot, { recursive: true });
      await writeFile(join(componentRoot, 'fake-widget.schema.json'), '{"type":"object"}\n');
      await writeFile(join(componentRoot, 'fake-widget.variables.json'), '[]\n');

      const knowledge = new CinderKnowledge(
        {
          manifestVersion: 1,
          package: {
            name: '@lostgradient/cinder',
            version: '0.0.0-test',
            framework: 'svelte',
            frameworkVersionRange: '>=5.55.0 <6',
            stylesEntry: '@lostgradient/cinder/styles',
            schemaDialect: 'https://json-schema.org/draft/2020-12/schema',
          },
          categories: {
            action: { label: 'Actions', description: 'Action controls.' },
          },
          statusLevels: {
            alpha: 'Experimental.',
          },
          overlapFamilies: {},
          components: [
            {
              id: 'fake-widget',
              name: 'Fake Widget',
              import: '@lostgradient/cinder/experimental/fake-widget',
              exportName: 'FakeWidget',
              category: 'action',
              status: 'alpha',
              purpose: 'Exercises experimental component sidecar resolution.',
              tags: ['fake'],
              useWhen: ['Testing the knowledge service with synthetic artifacts.'],
              avoidWhen: [{ reason: 'Rendering real production interfaces.' }],
              related: [],
              hasConstraints: false,
              hasExamples: false,
              artifacts: {
                schema: '@lostgradient/cinder/experimental/fake-widget/schema',
                variables: '@lostgradient/cinder/experimental/fake-widget/variables',
              },
            },
          ],
        } satisfies CinderManifest,
        temporaryRoot,
      );

      const detail = await knowledge.show('FakeWidget');

      expect(detail.component.id).toBe('fake-widget');
      expect(detail.schema).toEqual({ type: 'object' });
      expect(detail.variables).toEqual([]);
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  });

  it('compares components with overlap-family guidance', async () => {
    const knowledge = await loadCinderKnowledge(packageRoot);
    const comparison = knowledge.compare(['modal', 'drawer']);

    expect(comparison.components.map((component) => component.id)).toEqual(['modal', 'drawer']);
    expect(comparison.sharedOverlapFamilies['overlay']).toEqual(['modal', 'drawer']);
    expect(comparison.guidance.length).toBeGreaterThan(0);
  });

  it('returns best-practice payloads by topic', async () => {
    const knowledge = await loadCinderKnowledge(packageRoot);
    const styles = knowledge.bestPractices('styles');
    const all = knowledge.bestPractices('all');

    expect(styles).toHaveLength(1);
    expect(styles[0]?.topic).toBe('styles');
    expect(all.map((section) => section.topic)).toEqual([
      'imports',
      'styles',
      'metadata',
      'overlap',
    ]);
    expect(() => knowledge.bestPractices('unknown' as never)).toThrow(CinderKnowledgeError);
  });

  it('validates manifest contracts and reports malformed sections at the boundary', () => {
    const manifest = manifestFixture();

    expect(validateManifest(manifest)).toEqual(manifest);
    expect(() => validateManifest(null)).toThrow('components.json must be an object.');
    expect(() => validateManifest({ ...manifest, manifestVersion: 2 })).toThrow(
      'components.json must use manifestVersion 1.',
    );
    expect(() => validateManifest({ ...manifest, package: undefined })).toThrow(
      'components.json is missing package metadata or components.',
    );
    expect(() => validateManifest({ ...manifest, categories: [] })).toThrow(
      'components.json is missing category, status, or overlap metadata.',
    );
    expect(() =>
      validateManifest({
        ...manifest,
        components: [{ ...manifest.components[0], artifacts: { schema: 1 } }],
      }),
    ).toThrow('Every manifest component must include the generated component contract fields.');
  });
});
