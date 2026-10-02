import { describe, expect, test } from 'bun:test';

// These APIs are published under `./review-editor`, not the package root: the published root is the
// narrower `src/lib/index.ts`, so a self-import through `@lostgradient/editor` fails in the mirror.
import {
  buildFormDataFromValues,
  createReviewEditorState,
  ReviewEditor as ExportedReviewEditor,
  toPersistedThreads,
  toRuntimeThreads,
} from './index.ts';
import ReviewEditor from './review-editor.svelte';

const implementationSource = await Bun.file(
  new URL('./review-editor-impl.svelte', import.meta.url).pathname,
).text();

const wrapperSource = await Bun.file(
  new URL('./review-editor.svelte', import.meta.url).pathname,
).text();

describe('review-editor original bindable regression', () => {
  /**
   * The bug: `original` was a plain prop (`original = ''`), not $bindable.
   * setState() assigned `original = state.original` locally, but the write
   * never propagated to the parent — when the parent re-rendered it reverted
   * the baseline, silently breaking diffStats/hasContentChanges/exportUnifiedDiff.
   *
   * Fix: `original = $bindable('')` in review-editor-impl.svelte (matching
   * value and threads), and `bind:original` forwarded in review-editor.svelte.
   */
  test('review-editor-impl.svelte declares original as $bindable so setState writes propagate to the parent', () => {
    // Must match: original = $bindable('') in the $props() destructure.
    // A plain `original = ''` would fail this assertion.
    expect(implementationSource).toMatch(/original\s*=\s*\$bindable\s*\(\s*['"]{2}\s*\)/);
  });

  test('review-editor.svelte destructures original as $bindable to support two-way binding from callers', () => {
    // The outer wrapper must also declare the prop as $bindable so callers
    // using bind:original on the public ReviewEditor component work correctly.
    expect(wrapperSource).toMatch(/original\s*=\s*\$bindable\s*\(\s*['"]{2}\s*\)/);
  });

  test('review-editor.svelte forwards bind:original to the implementation component', () => {
    // Without bind:original on the inner ReviewEditorImplementation, setState
    // writes to original in the impl never reach the outer wrapper's binding.
    expect(wrapperSource).toMatch(/bind:original/);
  });
});

describe('review-editor public entrypoint', () => {
  test('exports review APIs from workspace source and packed entries', async () => {
    const packageJson = await Bun.file(`${import.meta.dir}/../../../../package.json`).json();
    expect(packageJson.exports['.']).toEqual({
      types: './dist/index.d.ts',
      bun: './src/lib/index.ts',
      browser: './src/lib/index.ts',
      svelte: './src/lib/index.ts',
      import: './dist/index.js',
      default: './dist/index.js',
    });
    expect(ReviewEditor).toBeDefined();
    expect(ExportedReviewEditor).toBeDefined();
    expect(createReviewEditorState).toBeTypeOf('function');
    expect(buildFormDataFromValues).toBeTypeOf('function');
    // Both directions of the persistence round trip must reach the root a
    // consumer restoring a saved ReviewState actually imports from.
    expect(toPersistedThreads).toBeTypeOf('function');
    expect(toRuntimeThreads).toBeTypeOf('function');
  });

  // Moving these APIs onto the published root, or off the subpath, should be a deliberate change.
  test('the published package root does not carry these APIs; only the review-editor subpath does', async () => {
    const publishedRoot = await Bun.file(
      new URL('../../index.ts', import.meta.url).pathname,
    ).text();
    for (const name of [
      'ReviewEditor',
      'createReviewEditorState',
      'buildFormDataFromValues',
      'toPersistedThreads',
      'toRuntimeThreads',
    ]) {
      expect(publishedRoot).not.toContain(name);
    }
  });
});
