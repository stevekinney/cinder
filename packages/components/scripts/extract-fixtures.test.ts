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

import {
  extractFixtures,
  loadFixtureFile,
  resolveFixtureFilePath,
  writeFixtureManifest,
} from './extract-fixtures.ts';

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

// ---------------------------------------------------------------------------
// (1) Happy path: valid array literal default export
// ---------------------------------------------------------------------------

describe('happy path: valid array literal default export', () => {
  it('parses a minimal fixture file and returns an entry', async () => {
    const root = makeRoot([
      {
        component: 'modal',
        filename: 'modal-fixtures.ts',
        content: `
export default [
  { name: 'open', props: { isOpen: true } },
];
`,
      },
    ]);

    const result = await extractFixtures(root);

    expect(result.violations).toHaveLength(0);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.componentName).toBe('modal');
    expect(result.entries[0]?.fixtures).toHaveLength(1);
    expect(result.entries[0]?.fixtures[0]?.name).toBe('open');
  });

  it('silently skips files with no default export (legacy test-factory fixtures)', async () => {
    // Pre-existing files like chat/message/chat-message-fixtures.ts share the
    // suffix but export factory functions, not a default array. These must be
    // skipped — neither counted as an entry nor flagged as a violation.
    const root = makeRoot([
      {
        component: 'message',
        filename: 'message-fixtures.ts',
        content: `
export function createMessage(overrides) {
  return { id: 'msg-1', ...overrides };
}

export const ASSISTANT_PROMPT = 'Hello';
`,
      },
    ]);

    const result = await extractFixtures(root);

    expect(result.entries).toHaveLength(0);
    expect(result.violations).toHaveLength(0);
  });

  it('parses a fixture file with indirect (identifier) default export', async () => {
    const root = makeRoot([
      {
        component: 'button',
        filename: 'button-fixtures.ts',
        content: `
const fixtures = [
  { name: 'primary', props: { variant: 'primary' } },
];

export default fixtures;
`,
      },
    ]);

    const result = await extractFixtures(root);

    expect(result.violations).toHaveLength(0);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.componentName).toBe('button');
    expect(result.entries[0]?.fixtures[0]?.name).toBe('primary');
  });

  it('returns a content hash for a parsed fixture file', async () => {
    const root = makeRoot([
      {
        component: 'input',
        filename: 'input-fixtures.ts',
        content: `export default [{ name: 'filled', props: { value: 'One' } }];\n`,
      },
    ]);

    const result = await loadFixtureFile(join(root, 'input', 'input-fixtures.ts'));

    expect(result.kind).toBe('entry');
    if (result.kind === 'entry') {
      expect(result.entry.contentHash).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it('resolves the canonical fixture file path for a slug', () => {
    const root = '/tmp/components';
    expect(resolveFixtureFilePath('segmented-control', root)).toBe(
      join(root, 'segmented-control', 'segmented-control-fixtures.ts'),
    );
  });

  it('accepts a host fixture when the host file stays inside the component directory', async () => {
    const root = makeRoot([
      {
        component: 'tabs',
        filename: 'tabs-fixtures.ts',
        content: `export default [{ name: 'keyboard', host: './keyboard.fixture.svelte' }];\n`,
      },
      {
        component: 'tabs',
        filename: 'keyboard.fixture.svelte',
        content: `<p>Keyboard fixture</p>\n`,
      },
    ]);

    const result = await extractFixtures(root);

    expect(result.violations).toHaveLength(0);
    expect(result.entries[0]?.fixtures[0]).toMatchObject({
      name: 'keyboard',
      host: './keyboard.fixture.svelte',
    });
  });

  it('rejects a host fixture that leaves the component directory', async () => {
    const root = makeRoot([
      {
        component: 'tabs',
        filename: 'tabs-fixtures.ts',
        content: `export default [{ name: 'escape', host: '../escape.fixture.svelte' }];\n`,
      },
    ]);

    const result = await extractFixtures(root);

    expect(result.entries).toHaveLength(0);
    expect(result.violations.some((violation) => violation.includes('host'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// (2) Function-call default export → violation, no entry
// ---------------------------------------------------------------------------

describe('function-call default export', () => {
  it('produces a violation and no entry when the default export is a function call', async () => {
    const root = makeRoot([
      {
        component: 'tooltip',
        filename: 'tooltip-fixtures.ts',
        content: `
export default makeFixtures({ count: 3 });
`,
      },
    ]);

    const result = await extractFixtures(root);

    expect(result.entries).toHaveLength(0);
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.violations.some((v) => v.includes('tooltip'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// (3) Spread element in the array → violation
// ---------------------------------------------------------------------------

describe('spread element in the array', () => {
  it('rejects a spread element inside the fixtures array', async () => {
    const root = makeRoot([
      {
        component: 'badge',
        filename: 'badge-fixtures.ts',
        content: `
const extra = [{ name: 'extra', props: {} }];

export default [
  { name: 'default-variant', props: {} },
  ...extra,
];
`,
      },
    ]);

    const result = await extractFixtures(root);

    expect(result.entries).toHaveLength(0);
    expect(result.violations.some((v) => v.includes('spread'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// (4) Imported identifier referenced in props → violation
// ---------------------------------------------------------------------------

describe('imported identifier in props', () => {
  it('rejects props that reference an imported identifier', async () => {
    const root = makeRoot([
      {
        component: 'icon',
        filename: 'icon-fixtures.ts',
        content: `
import { checkIcon } from '../icons/index.ts';

export default [
  { name: 'check', props: { icon: checkIcon } },
];
`,
      },
    ]);

    const result = await extractFixtures(root);

    expect(result.entries).toHaveLength(0);
    expect(result.violations.some((v) => v.includes('checkIcon'))).toBe(true);
  });

  it('rejects props that reference a namespace import member', async () => {
    const root = makeRoot([
      {
        component: 'icon',
        filename: 'icon-fixtures.ts',
        content: `
import * as Icons from '../icons/index.ts';

export default [
  { name: 'check', props: { icon: Icons } },
];
`,
      },
    ]);

    const result = await extractFixtures(root);

    expect(result.entries).toHaveLength(0);
    expect(result.violations.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// (5) Computed property name → violation
// ---------------------------------------------------------------------------

describe('computed property name', () => {
  it('rejects a computed property name inside a props object', async () => {
    const root = makeRoot([
      {
        component: 'chip',
        filename: 'chip-fixtures.ts',
        content: `
const key = 'label';

export default [
  { name: 'basic', props: { [key]: 'Hello' } },
];
`,
      },
    ]);

    const result = await extractFixtures(root);

    expect(result.entries).toHaveLength(0);
    expect(result.violations.some((v) => v.includes('computed'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// (6) Deeply nested all-literal object → accepted
// ---------------------------------------------------------------------------

describe('deeply nested all-literal object', () => {
  it('accepts a fixture with a deeply nested all-literal props object', async () => {
    const root = makeRoot([
      {
        component: 'card',
        filename: 'card-fixtures.ts',
        content: `
export default [
  {
    name: 'with-metadata',
    props: {
      title: 'Hello',
      count: 42,
      enabled: true,
      tags: ['a', 'b', 'c'],
      meta: { created: null, score: 0 },
    },
  },
];
`,
      },
    ]);

    const result = await extractFixtures(root);

    expect(result.violations).toHaveLength(0);
    expect(result.entries).toHaveLength(1);
    const fixture = result.entries[0]?.fixtures[0];
    expect(fixture?.props).toEqual({
      title: 'Hello',
      count: 42,
      enabled: true,
      tags: ['a', 'b', 'c'],
      meta: { created: null, score: 0 },
    });
  });
});

// ---------------------------------------------------------------------------
// (7) Negative number prefix → accepted
// ---------------------------------------------------------------------------

describe('negative number prefix', () => {
  it('accepts a negative numeric literal in props', async () => {
    const root = makeRoot([
      {
        component: 'slider',
        filename: 'slider-fixtures.ts',
        content: `
export default [
  { name: 'negative', props: { value: -10, min: -100 } },
];
`,
      },
    ]);

    const result = await extractFixtures(root);

    expect(result.violations).toHaveLength(0);
    expect(result.entries[0]?.fixtures[0]?.props).toEqual({ value: -10, min: -100 });
  });
});

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

    type ManifestEntry = {
      componentName: string;
      fixtures: unknown[];
      metadata: unknown;
    };
    const written = (await Bun.file(outputPath).json()) as {
      entries: ManifestEntry[];
    };

    expect(written.entries).toHaveLength(1);
    expect(Object.keys(written.entries[0] ?? {})).not.toContain('sourcePath');
    expect(written.entries[0]?.componentName).toBe('badge');
    expect(Array.isArray(written.entries[0]?.fixtures)).toBe(true);
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
