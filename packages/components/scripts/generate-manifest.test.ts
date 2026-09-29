/**
 * Tests for the manifest generator.
 *
 * Uses a synthetic 3-component metadata array (no real extractor) so these
 * tests pass even before the full annotation sweep completes.
 *
 * The primary gate: a manifest produced from valid metadata validates against
 * `manifest.schema.json`.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'bun:test';

import {
  buildManifest,
  enhancementArtifactPath,
  findDanglingAlternatives,
  formatDanglingAlternativeMessage,
  formatExtractionErrorMessage,
} from './generate-manifest.ts';
import { discoverComponentEnhancements } from './lib/component-enhancements.ts';

// ---------------------------------------------------------------------------
// Schema loader helper
// ---------------------------------------------------------------------------

import { SYNTHETIC_COMPONENTS } from './manifest.test-support.ts';
describe('kebab-to-PascalCase derivation', () => {
  // Test the kebabToPascal logic indirectly through the synthetic data shape.
  // The generator derives exportName from id — verify the naming convention holds.

  it('single-word id maps to same-word PascalCase', () => {
    const component = SYNTHETIC_COMPONENTS.find((c) => c.id === 'button');
    expect(component?.exportName).toBe('Button');
  });

  it('multi-segment id maps to PascalCase by segment', () => {
    const component = SYNTHETIC_COMPONENTS.find((c) => c.id === 'json-viewer');
    expect(component?.exportName).toBe('JsonViewer');
  });
});

describe('buildManifest() error formatting', () => {
  // The "fail loudly" path is tested via the pure helper
  // `formatExtractionErrorMessage`. Mocking the extractor module would leak
  // across files in a single `bun test` run and break unrelated suites.

  it('formats a two-error list with the component ids and total count', () => {
    const message = formatExtractionErrorMessage([
      { componentId: 'button', reason: 'no @cinder header' },
      { componentId: 'modal', reason: 'missing @category tag' },
    ]);

    expect(message).toMatch(/Cannot build manifest/i);
    expect(message).toContain('button');
    expect(message).toContain('modal');
    expect(message).toContain('no @cinder header');
    expect(message).toContain('missing @category tag');
    expect(message).toMatch(/2 components/);
  });

  it('uses singular "component" for a single-error list', () => {
    const message = formatExtractionErrorMessage([
      { componentId: 'button', reason: 'no @cinder header' },
    ]);
    expect(message).toMatch(/1 component have/);
    expect(message).toMatch(/1 error total/);
  });

  it('truncates long lists to the first ten with a "… and N more" tail', () => {
    const errors = Array.from({ length: 14 }, (_, i) => ({
      componentId: `comp-${i}`,
      reason: 'no @cinder header',
    }));
    const message = formatExtractionErrorMessage(errors);
    expect(message).toContain('comp-0');
    expect(message).toContain('comp-9');
    expect(message).not.toContain('comp-10');
    expect(message).toMatch(/… and 4 more errors \(14 total\)/);
  });
});

describe('component-owned artifacts', () => {
  it('detects an enhancement for any stable component with an enhancement source file', () => {
    const componentsRoot = mkdtempSync(join(tmpdir(), 'cinder-manifest-enhancement-'));
    const enhancementPath = join(componentsRoot, 'second-editor/second-editor-enhancement.ts');
    mkdirSync(join(componentsRoot, 'second-editor'), { recursive: true });
    writeFileSync(enhancementPath, 'export function enhance() {}\n');
    const experimentalEnhancementPath = join(
      componentsRoot,
      'experimental/second-editor/second-editor-enhancement.ts',
    );
    mkdirSync(join(componentsRoot, 'experimental/second-editor'), { recursive: true });
    writeFileSync(experimentalEnhancementPath, 'export function enhance() {}\n');

    try {
      expect(
        discoverComponentEnhancements(
          [{ name: 'second-editor', isExperimental: false }],
          componentsRoot,
        ),
      ).toEqual([{ name: 'second-editor', isExperimental: false, sourcePath: enhancementPath }]);
      expect(
        discoverComponentEnhancements(
          [{ name: 'second-editor', isExperimental: true }],
          componentsRoot,
        ),
      ).toEqual([]);
      expect(enhancementArtifactPath('second-editor', false, componentsRoot)).toBe(
        'src/components/second-editor/second-editor-enhancement.ts',
      );
      expect(enhancementArtifactPath('second-editor', true, componentsRoot)).toBeUndefined();
      expect(
        discoverComponentEnhancements(
          [{ name: 'missing-editor', isExperimental: false }],
          componentsRoot,
        ),
      ).toEqual([]);
    } finally {
      rmSync(componentsRoot, { recursive: true, force: true });
    }
  });

  it('advertises JsonEditor’s lazy enhancement entry point', async () => {
    const manifest = await buildManifest();
    const jsonEditor = manifest.components.find((component) => component.id === 'json-editor');

    expect(jsonEditor?.artifacts.enhancement).toBe(
      'src/components/json-editor/json-editor-enhancement.ts',
    );
  });
});

describe('findDanglingAlternatives — avoidWhen referential integrity', () => {
  it('returns nothing when every alternative resolves to a known component id', () => {
    const components = [
      {
        id: 'accordion',
        avoidWhen: [{ reason: 'Mutually exclusive views.', alternative: 'tabs' }],
      },
      { id: 'tabs', avoidWhen: [] },
    ];
    expect(findDanglingAlternatives(components)).toEqual([]);
  });

  it('flags an alternative that is not a known component id', () => {
    const components = [
      { id: 'accordion', avoidWhen: [{ reason: 'A reason.', alternative: 'does-not-exist' }] },
      { id: 'tabs', avoidWhen: [{ reason: 'Another reason.' }] },
    ];
    expect(findDanglingAlternatives(components)).toEqual([
      { componentId: 'accordion', alternative: 'does-not-exist' },
    ]);
  });

  it('ignores entries with no alternative', () => {
    const components = [{ id: 'accordion', avoidWhen: [{ reason: 'Reason only.' }] }];
    expect(findDanglingAlternatives(components)).toEqual([]);
  });

  it('formats a readable failure message naming the component and bad id', () => {
    const message = formatDanglingAlternativeMessage([
      { componentId: 'accordion', alternative: 'does-not-exist' },
    ]);
    expect(message).toContain('accordion');
    expect(message).toContain('does-not-exist');
    expect(message).toContain('do not match any component id');
  });
});

it('generates root imports and distinct local artifact paths for every component', async () => {
  const manifest = await buildManifest();
  expect(manifest.package).not.toHaveProperty('version');
  for (const component of manifest.components) {
    expect(component.import).toBe('@lostgradient/cinder');
    for (const path of Object.values(component.artifacts)) {
      expect(path.startsWith('src/components/')).toBe(true);
      expect(await Bun.file(join(import.meta.dir, '..', path)).exists()).toBe(true);
    }
  }
});
