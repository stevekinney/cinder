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

import { extractFixtures, loadFixtureFile, resolveFixtureFilePath } from './index.ts';

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

  it('changes the content hash when a referenced host fixture file changes', async () => {
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

    const fixturePath = join(root, 'tabs', 'tabs-fixtures.ts');
    const initial = await loadFixtureFile(fixturePath);
    writeFileSync(join(root, 'tabs', 'keyboard.fixture.svelte'), `<p>Updated fixture</p>\n`);
    const updated = await loadFixtureFile(fixturePath);

    expect(initial.kind).toBe('entry');
    expect(updated.kind).toBe('entry');
    if (initial.kind === 'entry' && updated.kind === 'entry') {
      expect(updated.entry.contentHash).not.toBe(initial.entry.contentHash);
    }
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
