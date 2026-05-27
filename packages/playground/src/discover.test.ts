/**
 * Unit tests for `scripts/playground/discover.ts`.
 *
 * Must be run from the repo root so that `process.cwd()` resolves to
 * `/Users/stevekinney/Developer/cinder` and the globs find the real
 * `src/components/` and `scripts/playground/examples/` trees.
 */

import { describe, expect, it } from 'bun:test';

import {
  COMPOSE_ONLY_COMPONENTS,
  discoverAll,
  discoverComponents,
  discoverExamples,
  discoverSidebarComponents,
} from './discover.ts';

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

  it('does not include removed date-picker component', async () => {
    const components = await discoverComponents();
    expect(components).not.toContain('date-picker');
  });
});

describe('discoverExamples', () => {
  it('returns at least one example for the button component', async () => {
    const examples = await discoverExamples('button');
    expect(examples.length).toBeGreaterThanOrEqual(1);
    expect(examples).toContain('primary');
  });

  it('returns an empty array for a nonexistent component without throwing', async () => {
    const examples = await discoverExamples('nonexistent');
    expect(examples).toEqual([]);
  });

  it('returns no standalone examples for navigation-item', async () => {
    const examples = await discoverExamples('navigation-item');
    expect(examples).toEqual([]);
  });

  it('returns no standalone examples for label', async () => {
    const examples = await discoverExamples('label');
    expect(examples).toEqual([]);
  });

  it('returns no standalone examples for date-picker', async () => {
    const examples = await discoverExamples('date-picker');
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

  it('reports exampleCount >= 1 for button', async () => {
    const results = await discoverAll();
    const buttonEntry = results.find((entry) => entry.name === 'button');
    expect(buttonEntry).toBeDefined();
    expect(buttonEntry!.exampleCount).toBeGreaterThanOrEqual(1);
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

  it('does not include removed date-picker component', async () => {
    const results = await discoverAll();
    expect(results.map((entry) => entry.name)).not.toContain('date-picker');
  });
});

describe('discoverSidebarComponents', () => {
  it('returns only component names with at least one example', async () => {
    const all = await discoverAll();
    const sidebar = await discoverSidebarComponents();
    const expected = all.filter(({ exampleCount }) => exampleCount > 0).map(({ name }) => name);
    expect(sidebar).toEqual(expected);
  });

  it('includes button (which has examples)', async () => {
    const sidebar = await discoverSidebarComponents();
    expect(sidebar).toContain('button');
  });

  it('excludes navigation-item because navigation-bar examples cover it', async () => {
    const sidebar = await discoverSidebarComponents();
    expect(sidebar).not.toContain('navigation-item');
  });

  it('excludes label because input and textarea examples cover it', async () => {
    const sidebar = await discoverSidebarComponents();
    expect(sidebar).not.toContain('label');
  });

  it('excludes date-picker because native date inputs replace it', async () => {
    const sidebar = await discoverSidebarComponents();
    expect(sidebar).not.toContain('date-picker');
  });

  it('excludes cinder-provider because it is app-wide context setup, not a visual component', async () => {
    const sidebar = await discoverSidebarComponents();
    expect(sidebar).not.toContain('cinder-provider');
  });

  it('returns an array of strings, no duplicates', async () => {
    const sidebar = await discoverSidebarComponents();
    expect(Array.isArray(sidebar)).toBe(true);
    expect(new Set(sidebar).size).toBe(sidebar.length);
    for (const name of sidebar) {
      expect(typeof name).toBe('string');
    }
  });

  it('excludes compose-only subcomponents that have no example folder', async () => {
    // accordion-item / radio / tab are explicitly compose-only — they should
    // never appear in the sidebar regardless of being present on disk.
    const sidebar = await discoverSidebarComponents();
    const all = await discoverAll();
    for (const { name, exampleCount } of all) {
      if (exampleCount === 0) {
        expect(sidebar).not.toContain(name);
      }
    }
  });

  it('excludes every compose-only leaf in the COMPOSE_ONLY_COMPONENTS set', async () => {
    const sidebar = await discoverSidebarComponents();
    for (const leaf of COMPOSE_ONLY_COMPONENTS) {
      expect(sidebar).not.toContain(leaf);
    }
  });

  it('keeps the sidebar at or below the 90-entry product gate', async () => {
    // The plan named a 70-entry cap based on a 99-component baseline. The
    // repository has grown to 122 components since then; adding the four
    // new parent families (feed, grid-list, stat-group, side-navigation)
    // lands the sidebar around 78. The three chart families (line, bar,
    // area) bumped it to 82; the P5 input/form audit and Selectable,
    // CommandPalette, and CommandMenu carried it to 87. The Container and
    // Collapsible layout/disclosure primitives bring it to 89, so the gate
    // moves to 90 to keep a small buffer before the next bump.
    const sidebar = await discoverSidebarComponents();
    expect(sidebar.length).toBeLessThanOrEqual(90);
  });

  it('keeps the sidebar strictly smaller than the full component list', async () => {
    const sidebar = await discoverSidebarComponents();
    const all = await discoverComponents();
    expect(sidebar.length).toBeLessThan(all.length);
  });

  it('includes every parent compound family covered by namespace exports', async () => {
    const sidebar = await discoverSidebarComponents();
    for (const parent of [
      'accordion',
      'tabs',
      'table',
      'dropdown',
      'tree',
      'feed',
      'grid-list',
      'stat-group',
      'side-navigation',
    ]) {
      expect(sidebar).toContain(parent);
    }
  });

  it('keeps every compose-only leaf discoverable via discoverComponents()', async () => {
    const all = await discoverComponents();
    for (const leaf of COMPOSE_ONLY_COMPONENTS) {
      expect(all).toContain(leaf);
    }
  });
});
