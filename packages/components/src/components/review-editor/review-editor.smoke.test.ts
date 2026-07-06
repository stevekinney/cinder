import { describe, expect, test } from 'bun:test';

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
  test('exports the component from the package subpath', async () => {
    const packageJson = await Bun.file(`${import.meta.dir}/../../../package.json`).json();
    const [{ default: ReviewEditor }, reviewEditorModule] = await Promise.all([
      import('./review-editor.svelte'),
      import('./index.ts'),
    ]);

    // After the per-directory migration, the public subpath keeps source
    // conditions for browser/Svelte tooling and a `node` condition for SSR.
    // `types` stays first per TypeScript nodenext requirements.
    expect(packageJson.exports['./review-editor']).toEqual({
      types: './dist/components/review-editor/index.d.ts',
      browser: './src/components/review-editor/index.ts',
      node: './dist/server/components/review-editor/index.js',
      svelte: './src/components/review-editor/index.ts',
      import: './src/components/review-editor/index.ts',
      default: './dist/components/review-editor/index.js',
    });
    expect(ReviewEditor).toBeDefined();
    expect(reviewEditorModule.ReviewEditor).toBeDefined();
    expect(reviewEditorModule.createReviewEditorState).toBeTypeOf('function');
    expect(reviewEditorModule.buildFormDataFromValues).toBeTypeOf('function');
  });
});
