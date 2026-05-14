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

  it('ignores workflow + own-script files but falls back to full if nothing else changed', () => {
    const result = decide([
      '.github/workflows/browser-tests.yaml',
      'packages/testing/scripts/changed-components.ts',
      'packages/testing/scripts/changed-components.test.ts',
    ]);
    expect(result.mode).toBe('full');
  });

  it('treats workflow + own-script files as ignorable when paired with component changes', () => {
    const result = decide([
      '.github/workflows/browser-tests.yaml',
      'packages/testing/scripts/changed-components.ts',
      'packages/components/src/components/badge.svelte',
    ]);
    expect(result).toEqual({ mode: 'filtered', components: ['badge'] });
  });

  it('returns full when packages/testing/playwright.config.ts is touched', () => {
    // The Playwright config affects every test run; changes here must
    // trigger the full matrix, not be silently ignored.
    const result = decide(['packages/testing/playwright.config.ts']);
    expect(result.mode).toBe('full');
  });

  it('returns full when a packages/testing fixture is touched', () => {
    // Fixtures (component-page.ts, theme.ts, etc.) affect every test.
    const result = decide(['packages/testing/src/fixtures/component-page.ts']);
    expect(result.mode).toBe('full');
  });

  it('returns full when packages/testing/tests/* is touched', () => {
    // The spec file itself drives the matrix; changes there can affect
    // every component's run.
    const result = decide(['packages/testing/tests/components.spec.ts']);
    expect(result.mode).toBe('full');
  });

  it('returns full for a root-level file like package.json', () => {
    const result = decide(['package.json']);
    expect(result.mode).toBe('full');
  });

  it('returns full for bun.lock changes', () => {
    const result = decide(['bun.lock']);
    expect(result.mode).toBe('full');
  });

  it('falls back to full when an extracted slug is not in the manifest', () => {
    // A cross-cutting helper directory under examples that happens to
    // match the slug regex must not silently be treated as a component.
    const knownSlugs = new Set(['accordion', 'button']);
    const result = decide(['packages/playground/src/examples/shared/helper.svelte'], knownSlugs);
    expect(result.mode).toBe('full');
    if (result.mode === 'full') {
      expect(result.reason).toContain('shared');
    }
  });

  it('keeps filtered mode when every extracted slug is in the manifest', () => {
    const knownSlugs = new Set(['accordion', 'button', 'badge']);
    const result = decide(['packages/components/src/components/accordion.svelte'], knownSlugs);
    expect(result).toEqual({ mode: 'filtered', components: ['accordion'] });
  });

  it('falls back to full when a deleted component slug is extracted', () => {
    // A PR that removes `view-switcher.svelte` will have the deleted file
    // path in `git diff --name-only`. The manifest no longer contains it,
    // so the suite must run in full mode rather than throw at slug
    // validation in components.spec.ts.
    const knownSlugs = new Set(['accordion', 'button']);
    const result = decide(['packages/components/src/components/view-switcher.svelte'], knownSlugs);
    expect(result.mode).toBe('full');
  });
});
