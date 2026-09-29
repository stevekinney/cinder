/**
 * Tests for the static-data fixture extractor.
 *
 * Each test writes fake fixture files into a temporary directory via
 * `mkdtempSync`, then calls `extractFixtures` and asserts the result.
 * The extractor must never execute fixture files — it only parses them
 * statically via the TypeScript compiler API.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';

import { extractFixtures, writeFixtureManifest } from './index.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates a temp directory, writes component directories + fixture files, and
 * returns the root path. */
function createFixtureTree(
  files: Array<{ component: string; filename: string; content: string }>,
): string {
  const root = mkdtempSync(join(tmpdir(), 'extract-fixtures-test-'));
  for (const { component, filename, content } of files) {
    const componentDir = join(root, component);
    mkdirSync(componentDir, { recursive: true });
    writeFileSync(join(componentDir, filename), content, 'utf8');
  }
  return root;
}

// ---------------------------------------------------------------------------
// Test state — clean up temp dirs after each test
// ---------------------------------------------------------------------------

let tempRoots: string[] = [];

beforeEach(() => {
  tempRoots = [];
});

afterEach(() => {
  for (const root of tempRoots) {
    rmSync(root, { recursive: true, force: true });
  }
});

function makeRoot(files: Array<{ component: string; filename: string; content: string }>): string {
  const root = createFixtureTree(files);
  tempRoots.push(root);
  return root;
}

type ManifestEntry = {
  componentName: string;
  fixtures: unknown[];
  metadata: unknown;
};

function isManifest(value: unknown): value is { entries: ManifestEntry[] } {
  if (value === null || typeof value !== 'object' || !('entries' in value)) return false;
  if (!Array.isArray(value.entries)) return false;
  return value.entries.every(
    (entry) =>
      entry !== null &&
      typeof entry === 'object' &&
      'componentName' in entry &&
      typeof entry.componentName === 'string' &&
      'fixtures' in entry &&
      Array.isArray(entry.fixtures) &&
      'metadata' in entry,
  );
}

// ---------------------------------------------------------------------------
// (8) Schema violation propagates (uppercase fixture name)
// ---------------------------------------------------------------------------

describe('schema violation propagation', () => {
  it('surfaces a schema violation when a fixture name contains uppercase', async () => {
    const root = makeRoot([
      {
        component: 'alert',
        filename: 'alert-fixtures.ts',
        content: `
export default [
  { name: 'OpenModal', props: {} },
];
`,
      },
    ]);

    const result = await extractFixtures(root);

    expect(result.entries).toHaveLength(0);
    expect(result.violations.length).toBeGreaterThan(0);
    // The schema violation message from parseFixtureFile should mention kebab-case
    expect(result.violations.some((v) => /kebab/i.test(v))).toBe(true);
  });

  it('surfaces a budget violation when more than 5 fixtures lack an override', async () => {
    const fixtures = Array.from(
      { length: 6 },
      (_, index) => `  { name: 'fixture-${index + 1}', props: {} }`,
    ).join(',\n');

    const root = makeRoot([
      {
        component: 'select',
        filename: 'select-fixtures.ts',
        content: `export default [\n${fixtures}\n];\n`,
      },
    ]);

    const result = await extractFixtures(root);

    expect(result.entries).toHaveLength(0);
    expect(result.violations.some((v) => /budget/i.test(v))).toBe(true);
  });

  it('rejects a fixture name reserved for an interaction fixture resting state', async () => {
    const root = makeRoot([
      {
        component: 'menu',
        filename: 'menu-fixtures.ts',
        content: `
export default [
  { name: 'open', props: {}, interact: [{ action: 'click', target: { testId: 'trigger' } }] },
  { name: 'open-resting', props: {} },
];
`,
      },
    ]);

    const result = await extractFixtures(root);

    expect(result.entries).toHaveLength(0);
    expect(result.violations.some((violation) => /derived resting-state/i.test(violation))).toBe(
      true,
    );
  });
});

// ---------------------------------------------------------------------------
// (9) Multiple files: one valid + one violated
// ---------------------------------------------------------------------------

describe('multiple files isolation', () => {
  it('extracts the valid file entry even when another file has violations', async () => {
    const root = makeRoot([
      {
        component: 'modal',
        filename: 'modal-fixtures.ts',
        content: `export default [{ name: 'open', props: {} }];\n`,
      },
      {
        component: 'tooltip',
        filename: 'tooltip-fixtures.ts',
        content: `export default makeFixtures();\n`,
      },
    ]);

    const result = await extractFixtures(root);

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.componentName).toBe('modal');
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.violations.some((v) => v.includes('tooltip'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// (10) Component name derived from directory name
// ---------------------------------------------------------------------------

describe('component name resolution', () => {
  it('derives componentName from the containing directory', async () => {
    const root = makeRoot([
      {
        component: 'search-field',
        filename: 'search-field-fixtures.ts',
        content: `export default [{ name: 'empty', props: {} }];\n`,
      },
    ]);

    const result = await extractFixtures(root);

    expect(result.entries[0]?.componentName).toBe('search-field');
  });

  it('produces a violation when directory name is invalid', async () => {
    const root = makeRoot([
      {
        component: 'My_Component',
        filename: 'My_Component-fixtures.ts',
        content: `export default [{ name: 'basic', props: {} }];\n`,
      },
    ]);

    const result = await extractFixtures(root);

    expect(result.entries).toHaveLength(0);
    expect(result.violations.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// (11) writeFixtureManifest omits sourcePath
// ---------------------------------------------------------------------------

describe('writeFixtureManifest', () => {
  it('writes a JSON manifest omitting sourcePath from each entry', async () => {
    const root = makeRoot([
      {
        component: 'badge',
        filename: 'badge-fixtures.ts',
        content: `export default [{ name: 'info', props: { variant: 'info' } }];\n`,
      },
    ]);

    const result = await extractFixtures(root);
    expect(result.entries).toHaveLength(1);

    const outputPath = join(root, 'fixture-manifest.json');
    await writeFixtureManifest(result, outputPath);

    const writtenValue: unknown = await Bun.file(outputPath).json();
    if (!isManifest(writtenValue)) {
      throw new Error('Fixture manifest has an invalid shape.');
    }

    expect(writtenValue.entries).toHaveLength(1);
    expect(Object.keys(writtenValue.entries[0] ?? {})).not.toContain('sourcePath');
    expect(writtenValue.entries[0]?.componentName).toBe('badge');
    expect(Array.isArray(writtenValue.entries[0]?.fixtures)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// (12) visualFixtureMetadata named export is parsed and included
// ---------------------------------------------------------------------------

describe('visualFixtureMetadata named export', () => {
  it('accepts and includes fixtureBudgetOverride from visualFixtureMetadata', async () => {
    const fixtures = Array.from(
      { length: 6 },
      (_, index) => `  { name: 'fixture-${index + 1}', props: {} }`,
    ).join(',\n');

    const root = makeRoot([
      {
        component: 'tabs',
        filename: 'tabs-fixtures.ts',
        content: `
export const visualFixtureMetadata = {
  fixtureBudgetOverride: {
    reason: 'All six tab states are visually distinct.',
    approvedBy: 'steve',
  },
};

export default [
${fixtures}
];
`,
      },
    ]);

    const result = await extractFixtures(root);

    expect(result.violations).toHaveLength(0);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.metadata.fixtureBudgetOverride).toBeDefined();
    expect(result.entries[0]?.metadata.fixtureBudgetOverride?.approvedBy).toBe('steve');
  });
});

// ---------------------------------------------------------------------------
// (13) Binary expression (1 + 2) in props → violation
// ---------------------------------------------------------------------------

describe('binary expression in props', () => {
  it('rejects a binary expression used as a prop value', async () => {
    const root = makeRoot([
      {
        component: 'progress',
        filename: 'progress-fixtures.ts',
        content: `
export default [
  { name: 'half', props: { value: 1 + 2 } },
];
`,
      },
    ]);

    const result = await extractFixtures(root);

    expect(result.entries).toHaveLength(0);
    expect(result.violations.some((v) => v.includes('non-literal'))).toBe(true);
  });
});
