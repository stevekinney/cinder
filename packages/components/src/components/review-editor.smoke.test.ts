import { describe, expect, test } from 'bun:test';

describe('review-editor public entrypoint', () => {
  test('exports the component from the package subpath and root barrel', async () => {
    const packageJson = await Bun.file(`${import.meta.dir}/../../package.json`).json();
    const [{ default: ReviewEditor }, reviewEditorModule] = await Promise.all([
      import('./review-editor.svelte'),
      import('./review-editor/index.ts'),
    ]);

    expect(packageJson.exports['./review-editor']).toEqual({
      svelte: './src/components/review-editor.svelte',
      types: './dist/components/review-editor.svelte.d.ts',
    });
    expect(ReviewEditor).toBeDefined();
    expect(reviewEditorModule.ReviewEditor).toBeDefined();
    expect(reviewEditorModule.createReviewEditorState).toBeTypeOf('function');
    expect(reviewEditorModule.buildFormDataFromValues).toBeTypeOf('function');
  });
});
