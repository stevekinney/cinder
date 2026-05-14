import { describe, expect, it } from 'bun:test';

import { decide } from './changed-components.ts';

describe('changed-components decide()', () => {
  it('returns filtered list for a single component change', () => {
    const result = decide(['packages/components/src/components/accordion.svelte']);
    expect(result).toEqual({ mode: 'filtered', components: ['accordion'] });
  });

  it('returns filtered list for multiple components, sorted and deduped', () => {
    const result = decide([
      'packages/components/src/components/button.svelte',
      'packages/components/src/components/accordion.svelte',
      'packages/components/src/components/button.test.ts',
      'packages/playground/src/examples/accordion/basic.example.svelte',
    ]);
    expect(result).toEqual({ mode: 'filtered', components: ['accordion', 'button'] });
  });

  it('matches .a11y.md, .test.ts, and .type-test.ts siblings', () => {
    const result = decide([
      'packages/components/src/components/accordion.a11y.md',
      'packages/components/src/components/button-group.test.ts',
      'packages/components/src/components/button-group.type-test.ts',
    ]);
    expect(result).toEqual({ mode: 'filtered', components: ['accordion', 'button-group'] });
  });

  it('returns full when an _internal helper is touched', () => {
    const result = decide([
      'packages/components/src/_internal/focus.ts',
      'packages/components/src/components/button.svelte',
    ]);
    expect(result.mode).toBe('full');
  });

  it('returns full when a utilities/* file is touched', () => {
    const result = decide(['packages/components/src/utilities/class-names.ts']);
    expect(result.mode).toBe('full');
  });

  it('returns full for changes in editor / markdown / commentary / diff packages', () => {
    for (const file of [
      'packages/editor/src/index.ts',
      'packages/markdown/src/parse.ts',
      'packages/commentary/src/index.ts',
      'packages/diff/src/render.ts',
    ]) {
      expect(decide([file]).mode).toBe('full');
    }
  });

  it('returns full when the playground server is touched', () => {
    const result = decide(['packages/playground/src/server.ts']);
    expect(result.mode).toBe('full');
  });

  it('returns full when the changed-set is empty', () => {
    expect(decide([]).mode).toBe('full');
    expect(decide(['', '   ', '\n']).mode).toBe('full');
  });

  it('ignores workflow + testing-package files but falls back to full if nothing else changed', () => {
    const result = decide([
      '.github/workflows/browser-tests.yaml',
      'packages/testing/playwright.config.ts',
    ]);
    expect(result.mode).toBe('full');
  });

  it('treats workflow + testing files as ignorable when paired with component changes', () => {
    const result = decide([
      '.github/workflows/browser-tests.yaml',
      'packages/testing/playwright.config.ts',
      'packages/components/src/components/badge.svelte',
    ]);
    expect(result).toEqual({ mode: 'filtered', components: ['badge'] });
  });

  it('returns full for a root-level file like package.json', () => {
    const result = decide(['package.json']);
    expect(result.mode).toBe('full');
  });

  it('returns full for bun.lock changes', () => {
    const result = decide(['bun.lock']);
    expect(result.mode).toBe('full');
  });
});
