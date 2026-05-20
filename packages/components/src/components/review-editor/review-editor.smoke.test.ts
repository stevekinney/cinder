import { describe, expect, test } from 'bun:test';

describe('review-editor public entrypoint', () => {
  test('exports the component from the package subpath and root barrel', async () => {
    const packageJson = await Bun.file(`${import.meta.dir}/../../../package.json`).json();
    const [{ default: ReviewEditor }, reviewEditorModule] = await Promise.all([
      import('./review-editor.svelte'),
      import('./index.ts'),
    ]);

    // After the per-directory migration, the public subpath resolves to the
    // directory's index.ts via the `svelte` condition. Track 3 added the
    // `node` and `default` conditions pointing at the per-component build
    // outputs; `types` is first per TypeScript nodenext requirements.
    expect(packageJson.exports['./review-editor']).toEqual({
      types: './dist/components/review-editor/index.d.ts',
      svelte: './src/components/review-editor/index.ts',
      node: './dist/server/components/review-editor/index.js',
      default: './dist/components/review-editor/index.js',
    });
    expect(ReviewEditor).toBeDefined();
    expect(reviewEditorModule.ReviewEditor).toBeDefined();
    expect(reviewEditorModule.createReviewEditorState).toBeTypeOf('function');
    expect(reviewEditorModule.buildFormDataFromValues).toBeTypeOf('function');
  });
});
