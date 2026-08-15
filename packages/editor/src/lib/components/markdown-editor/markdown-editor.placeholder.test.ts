/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';
import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const [{ default: MarkdownEditor }, { cleanup, render, waitFor }] = await Promise.all([
  import('./markdown-editor.svelte'),
  import('@testing-library/svelte'),
]);

/**
 * `@milkdown/plugin-listener`'s `markdownUpdated` dispatch is internally
 * debounced 200ms (lodash-es, `node_modules/@milkdown/plugin-listener/lib/index.js`
 * around line 76) — separate from and invisible to `editor.ts`'s own
 * `changeDebounceMs`, armed by mounting the editor alone (not just by
 * editing it).
 *
 * This file cannot settle that debounce with a fake clock the way the other
 * two editor-mounting suites do (editor/editor.tab-escape-keymap.test.ts,
 * anchor-decorations-a11y.test.ts): those install the clock BEFORE the
 * mutation that arms the debounce, so `advance()` fires the real pending
 * timer. Here, `render()` itself (via `@testing-library/svelte`) arms the
 * debounce with lodash's REAL `setTimeout` before any fake clock could be
 * installed, and `waitFor`'s own polling needs real timers throughout each
 * test — installing a fake clock at any point that would still catch the
 * armed timer would also break the `waitFor` calls that precede it.
 *
 * So this drains real wall-clock time instead — per test, BEFORE
 * `result.unmount()`, not after and not batched into a single end-of-file
 * wait. An earlier version of this file waited once in `afterAll`, after
 * every test had already unmounted: that let the debounce fire against an
 * ALREADY-destroyed context, which still throws "Context editorView not
 * found" — containment without a fix, just relocating the same crash from
 * "during the next file" to "during this file's own teardown". Waiting
 * before unmount, while the editor's context is still alive, lets
 * `serializer(doc)` actually succeed instead of throwing — the same
 * "settle it while the context is still alive" principle as the fake-clock
 * fix in the other two files, just with a real timer because a fake one
 * can't reach a timer armed before it existed. This is not a padded
 * timeout: 250ms is Milkdown's own fixed 200ms constant plus a fixed
 * margin, applied once per test to cross a specific, cited debounce, not a
 * threshold tuned to make a flake pass.
 */
async function settleListenerDebounce(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 250));
}

/**
 * cinder#1306 — `placeholder` was written as an inline `--editor-placeholder`
 * custom property unconditionally, but the `is-editor-empty` decoration the
 * `::before` rule depends on never reached the DOM: `placeholderPlugin`
 * (createLazyProsePlugin, milkdown-plugin-runtime.ts) raced
 * `EditorState.create()`'s one-time snapshot of `prosePluginsCtx` and
 * usually lost, so the plugin was silently absent from the live editor.
 *
 * This mounts a REAL MarkdownEditor (`showToolbar: false` avoids an
 * unrelated @lostgradient/cinder Dropdown/DropdownTrigger crash that this
 * package's happy-dom harness hits for the formatting toolbar — reproduces
 * with zero placeholder involvement, not something this fix touches) and
 * reads the actual rendered DOM: the plugin's `decorations()` return value
 * alone would not have caught this, since the bug was never running at all,
 * not running and returning the wrong thing.
 *
 * WHAT THIS FILE CAN AND CANNOT PROVE. The bug is a race between a dynamic
 * `import('@milkdown/kit/core')` and `EditorState.create()`'s one-time
 * `prosePluginsCtx` snapshot, and that race is environment-timing-dependent:
 * measured directly (revert milkdown-plugin-runtime.ts/editor.ts, rerun),
 * this suite stays GREEN even without the fix — bun's dynamic import for an
 * already-loaded module resolves fast enough here that the plugin wins the
 * race anyway. So this file is a mechanism/contract check (the fixed code
 * produces the right DOM), not proof the bug reproduces or that the fix
 * closes it — that proof is real-browser-only, in
 * packages/testing/tests/markdown-editor-placeholder.playwright.ts, verified
 * red without the fix and green with it against this playground's actual
 * Vite/Chromium module graph.
 */
describe('MarkdownEditor placeholder (cinder#1306)', () => {
  test('an empty document is decorated with is-editor-empty, so the placeholder can actually paint', async () => {
    const result = render(MarkdownEditor, {
      props: {
        id: 'placeholder-test',
        label: 'Placeholder test editor',
        showToolbar: false,
        value: '',
        placeholder: 'Start reviewing',
      },
    });

    try {
      await waitFor(() => {
        expect(result.getByRole('textbox', { name: 'Placeholder test editor' })).toBeTruthy();
      });

      const view = result.getByRole('textbox', { name: 'Placeholder test editor' });

      await waitFor(() => {
        const firstParagraph = view.querySelector('p');
        expect(firstParagraph?.classList.contains('is-editor-empty')).toBe(true);
      });

      // The custom property the CSS `::before` rule reads must be set on the
      // host that actually carries it (the wrapper div, not the inner
      // contenteditable `view` — cascading custom properties are inherited,
      // but `.style` only reflects an element's OWN inline style).
      const wrapper = result.container.querySelector<HTMLElement>('#placeholder-test');
      expect(wrapper?.style.getPropertyValue('--editor-placeholder')).toBe("'Start reviewing'");
    } finally {
      await settleListenerDebounce();
      result.unmount();
      cleanup();
    }
  });

  test('a populated document is not decorated, and carries no placeholder custom property', async () => {
    const result = render(MarkdownEditor, {
      props: {
        id: 'placeholder-test-populated',
        label: 'Placeholder populated editor',
        showToolbar: false,
        value: 'Real content already here.',
        placeholder: 'Start reviewing',
      },
    });

    try {
      await waitFor(() => {
        expect(result.getByRole('textbox', { name: 'Placeholder populated editor' })).toBeTruthy();
      });

      const view = result.getByRole('textbox', { name: 'Placeholder populated editor' });
      const firstParagraph = view.querySelector('p');
      expect(firstParagraph?.classList.contains('is-editor-empty')).toBe(false);

      const wrapper = result.container.querySelector<HTMLElement>('#placeholder-test-populated');
      // Gated on document emptiness (cinder#1306's cosmetic half): a
      // populated document should not carry a dead inline custom property.
      expect(wrapper?.style.getPropertyValue('--editor-placeholder')).toBe('');
    } finally {
      await settleListenerDebounce();
      result.unmount();
      cleanup();
    }
  });

  test('typing into an empty editor clears the decoration (the placeholder disappears once there is content)', async () => {
    const result = render(MarkdownEditor, {
      props: {
        id: 'placeholder-test-live',
        label: 'Placeholder live editor',
        showToolbar: false,
        value: '',
        placeholder: 'Start reviewing',
      },
    });

    try {
      await waitFor(() => {
        expect(result.getByRole('textbox', { name: 'Placeholder live editor' })).toBeTruthy();
      });

      const view = result.getByRole('textbox', { name: 'Placeholder live editor' });
      await waitFor(() => {
        expect(view.querySelector('p')?.classList.contains('is-editor-empty')).toBe(true);
      });

      // Drive the SAME external-update path a consumer's own state update
      // would: rerender with a new `value` prop, which markdown-editor.svelte
      // syncs into the live editor via `editorState.setMarkdown(...)`.
      result.rerender({
        id: 'placeholder-test-live',
        label: 'Placeholder live editor',
        showToolbar: false,
        value: 'Now there is content.',
        placeholder: 'Start reviewing',
      });

      await waitFor(() => {
        expect(view.querySelector('p')?.classList.contains('is-editor-empty')).toBe(false);
      });

      const wrapper = result.container.querySelector<HTMLElement>('#placeholder-test-live');
      expect(wrapper?.style.getPropertyValue('--editor-placeholder')).toBe('');
    } finally {
      await settleListenerDebounce();
      result.unmount();
      cleanup();
    }
  });
});
