/**
 * cinder#1306 — `MarkdownEditor`'s `placeholder` prop was written as an
 * inline `--editor-placeholder` custom property unconditionally, but the
 * `is-editor-empty` decoration the `::before` rule depends on never reached
 * the DOM: `placeholderPlugin` raced `EditorState.create()`'s one-time
 * snapshot of `prosePluginsCtx` (Milkdown's `editorState` internal plugin)
 * and lost, so the plugin was silently absent from every live editor.
 *
 * This is a real-browser spec rather than living only in
 * packages/editor's own happy-dom suite (which also covers this — see
 * markdown-editor.placeholder.test.ts) because the race is
 * environment-timing-dependent: measured directly, bun's dynamic
 * `import('@milkdown/kit/core')` for an already-loaded module resolves fast
 * enough that the happy-dom test does NOT reproduce the bug (passes
 * identically with the fix reverted), while the same reverted source,
 * rebuilt and loaded through this playground's real Vite/Chromium module
 * graph, reliably does. A test that cannot fail is not coverage; this one
 * can, because it exercises the actual bundled, actual-browser code path the
 * bug depends on.
 *
 * Only the FIRST test below is load-bearing for the bug itself, verified by
 * reverting milkdown-plugin-runtime.ts/editor.ts, rebuilding, and rerunning
 * against this same playground: it goes red (empty `class=""`, no
 * `is-editor-empty`) without the fix. The second test does not discriminate
 * bug-from-fix on its own — without the fix, `is-editor-empty` is never
 * present to begin with, so "not present after typing" holds trivially
 * either way — it's kept as a companion regression guard against a
 * DIFFERENT failure mode (the decoration surviving a keystroke it should
 * clear on), not as a second proof of this issue.
 */
import { expect, test } from '@playwright/test';
import { PLAYGROUND_URL } from '../src/helpers/playground-url.ts';

const ROUTE = `${PLAYGROUND_URL}/page/markdown-editor?snapshot=1`;
// packages/playground/src/examples/markdown-editor/empty.example.svelte
const EXAMPLE_MOUNT = '#example-mount-empty';

test.describe('MarkdownEditor placeholder (cinder#1306)', () => {
  test('an empty document is decorated with is-editor-empty, and the placeholder custom property is set', async ({
    page,
  }) => {
    await page.goto(ROUTE, { waitUntil: 'load' });
    await page.waitForSelector('#app > *', { state: 'visible', timeout: 20_000 });

    const mount = page.locator(EXAMPLE_MOUNT);
    const paragraph = mount.locator('.ProseMirror p').first();
    await expect(paragraph).toHaveClass(/is-editor-empty/);

    const wrapper = mount.locator('[role="application"]').first();
    const placeholderVar = await wrapper.evaluate((element) =>
      getComputedStyle(element).getPropertyValue('--editor-placeholder'),
    );
    expect(placeholderVar.trim()).toBe("'Start writing your release notes…'");

    // The requested fix in full: the placeholder must actually PAINT, not
    // just carry the right class/property — read via the `::before`
    // pseudo-element's computed content, the same way the issue's own repro
    // isolated the CSS as already-correct ("Adding the class by hand makes
    // the very same ::before resolve to the placeholder text").
    const beforeContent = await paragraph.evaluate(
      (element) => getComputedStyle(element, '::before').content,
    );
    expect(beforeContent).toBe('"Start writing your release notes…"');
  });

  test('typing clears the decoration and the placeholder stops painting', async ({ page }) => {
    await page.goto(ROUTE, { waitUntil: 'load' });
    await page.waitForSelector('#app > *', { state: 'visible', timeout: 20_000 });

    const mount = page.locator(EXAMPLE_MOUNT);
    const editable = mount.getByRole('textbox').first();
    await editable.click();
    await page.keyboard.type('Now there is content.');

    const paragraph = mount.locator('.ProseMirror p').first();
    await expect(paragraph).not.toHaveClass(/is-editor-empty/);

    const beforeContent = await paragraph.evaluate(
      (element) => getComputedStyle(element, '::before').content,
    );
    expect(beforeContent).toBe('none');
  });
});
