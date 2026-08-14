/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

/**
 * `snapshotMode` promises no selection highlights and a pixel-stable surface.
 * Its rule was authored as `[data-snapshot-mode] *`, and inside a Svelte
 * `<style>` a bare `*` compiles to `:where(.svelte-…)` — so the descendant half
 * could only ever match elements the component itself rendered. `.milkdown` and
 * `.ProseMirror` are created at runtime by Milkdown with no scope class, so the
 * rule never reached the editor content in ANY engine.
 *
 * Chromium looked correct only because Blink inherits `user-select`, which
 * css-ui-4 defines as non-inherited; Gecko implements it as such, which is why
 * Firefox is the engine that surfaced this.
 *
 * WHY THIS IS A SOURCE ASSERTION. The defect is in how Svelte scopes the
 * selector, so it lives in the authored CSS — by the time happy-dom is involved
 * there is no cascade to observe, and it models neither `::selection` nor
 * scoped-style compilation. Asserting the authored form pins the exact thing
 * that was wrong. The behavioral half — that a drag no longer paints a
 * selection — is pinned in a consumer's real-browser suite across three engines,
 * which is where it is observable and where the bug was found.
 */
const FILES = [
  ['markdown-editor', 'markdown-editor/markdown-editor.svelte', '.markdown-editor-wrapper'],
  ['review-editor', 'review-editor/review-editor-impl.svelte', '.review-editor-container'],
] as const;

describe('snapshotMode CSS reaches the editor content', () => {
  for (const [label, path, container] of FILES) {
    test(`${label}: the descendant rule escapes Svelte's scoping`, async () => {
      const source = await Bun.file(new URL(`./${path}`, import.meta.url)).text();

      expect(source).toContain(`${container}[data-snapshot-mode] :global(*)`);
      // The bare form is what Svelte scopes into uselessness. Asserting its
      // absence is what makes a revert fail here rather than silently.
      expect(source).not.toContain(`${container}[data-snapshot-mode] * {`);
    });

    test(`${label}: the selection itself is painted transparent`, async () => {
      // `user-select: none` alone does not deliver the promise: a real drag
      // selected and repainted in Chromium AND Firefox even where the property
      // computed to `none`, because ProseMirror's contenteditable stays
      // selectable regardless. Suppressing the paint is what makes it stable.
      const source = await Bun.file(new URL(`./${path}`, import.meta.url)).text();

      expect(source).toContain(`${container}[data-snapshot-mode] :global(::selection)`);
      expect(source).toMatch(/::selection\)\s*\{\s*background:\s*transparent/);
    });
  }
});
