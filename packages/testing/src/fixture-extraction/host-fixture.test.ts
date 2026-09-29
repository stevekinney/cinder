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

import { extractFixtures } from './index.ts';

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
