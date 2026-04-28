/**
 * Unit tests for `scripts/playground/discover.ts`.
 *
 * Must be run from the repo root so that `process.cwd()` resolves to
 * `/Users/stevekinney/Developer/cinder` and the globs find the real
 * `src/components/` and `scripts/playground/examples/` trees.
 */

import { describe, expect, it } from 'bun:test';

import { discoverAll, discoverComponents, discoverExamples } from './discover.ts';

describe('discoverComponents', () => {
  it('returns an array of component kebab names', async () => {
    const components = await discoverComponents();
    expect(Array.isArray(components)).toBe(true);
    expect(components.length).toBeGreaterThan(0);
  });

  it('includes button, alert, and modal', async () => {
    const components = await discoverComponents();
    expect(components).toContain('button');
    expect(components).toContain('alert');
    expect(components).toContain('modal');
  });

  it('does not include anything from _internal/', async () => {
    const components = await discoverComponents();
    // All names should be plain kebab identifiers with no path separator
    for (const name of components) {
      expect(name).not.toContain('/');
      expect(name).not.toContain('_internal');
    }
  });

  it('returns names without a .svelte extension', async () => {
    const components = await discoverComponents();
    for (const name of components) {
      expect(name).not.toMatch(/\.svelte$/);
    }
  });

  it('returns a sorted list', async () => {
    const components = await discoverComponents();
    const sorted = [...components].toSorted();
    expect(components).toEqual(sorted);
  });

  it('returns at least 21 components', async () => {
    const components = await discoverComponents();
    expect(components.length).toBeGreaterThanOrEqual(21);
  });
});

describe('discoverExamples', () => {
  it("returns ['primary'] for the button component", async () => {
    const examples = await discoverExamples('button');
    expect(examples).toEqual(['primary']);
  });

  it('returns an empty array for a nonexistent component without throwing', async () => {
    const examples = await discoverExamples('nonexistent');
    expect(examples).toEqual([]);
  });

  it('returns names without the .example.svelte extension', async () => {
    const examples = await discoverExamples('button');
    for (const example of examples) {
      expect(example).not.toMatch(/\.example\.svelte$/);
    }
  });

  it('returns a sorted list', async () => {
    const examples = await discoverExamples('button');
    const sorted = [...examples].toSorted();
    expect(examples).toEqual(sorted);
  });
});

describe('discoverAll', () => {
  it('returns an array of { name, exampleCount } objects', async () => {
    const results = await discoverAll();
    expect(Array.isArray(results)).toBe(true);
    for (const entry of results) {
      expect(typeof entry.name).toBe('string');
      expect(typeof entry.exampleCount).toBe('number');
      expect(entry.exampleCount).toBeGreaterThanOrEqual(0);
    }
  });

  it('reports exampleCount: 1 for button', async () => {
    const results = await discoverAll();
    const buttonEntry = results.find((entry) => entry.name === 'button');
    expect(buttonEntry).toBeDefined();
    expect(buttonEntry!.exampleCount).toBe(1);
  });

  it('covers at least 21 components', async () => {
    const results = await discoverAll();
    expect(results.length).toBeGreaterThanOrEqual(21);
  });

  it('includes entries for button, alert, and modal', async () => {
    const results = await discoverAll();
    const names = results.map((entry) => entry.name);
    expect(names).toContain('button');
    expect(names).toContain('alert');
    expect(names).toContain('modal');
  });
});
