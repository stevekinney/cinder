/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';
import { tick } from 'svelte';
import type { FakeClock } from '../../test/fake-clock.ts';
import { installFakeClock } from '../../test/fake-clock.ts';
import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const [{ default: MarkdownEditor }, { cleanup, render }] = await Promise.all([
  import('./markdown-editor.svelte'),
  import('@testing-library/svelte'),
]);

/**
 * `@milkdown/plugin-listener`'s `markdownUpdated` dispatch is internally
 * debounced 200ms (lodash-es, `node_modules/@milkdown/plugin-listener/lib/index.js`
 * around line 76) — separate from and invisible to `editor.ts`'s own
 * `changeDebounceMs`, armed by mounting the editor alone (not just by
 * editing it). Left unhandled, it fires later against a torn-down context
 * ("Context editorView not found").
 *
 * An earlier version of this file drained this with a real 250ms
 * `setTimeout` wait per test. Two independent PR reviews correctly flagged
 * that as exactly what this repo's "no timeout/wait-threshold" rule
 * prohibits, regardless of how the constant was justified — a fixed
 * wall-clock wait is still a fixed wall-clock wait. The actual fix: install
 * the fake clock BEFORE `render()`, not after. `@testing-library/svelte`'s
 * `render()` is what arms the debounce (mounting alone is enough — no edit
 * required), so if the clock is already installed at that point, the
 * debounce's `setTimeout` call is captured as a FAKE, never-auto-firing
 * timer rather than a real one. It is never advanced (nothing in these
 * tests needs it to fire), so `FakeClock.restore()` in `finally` simply
 * discards it — the callback never runs at all, against a live or a
 * torn-down context, rather than being raced against either.
 *
 * The tradeoff: `@testing-library/svelte`'s `waitFor` polls on the REAL
 * `setInterval`/`setTimeout`, which the installed fake clock also captures,
 * so it can no longer be used once the clock is installed. `pollUntil`
 * below replaces it with a bounded loop over `tick()` (flushes Svelte's own
 * pending effects) and `clock.advance(20)` (fires whatever the mounted
 * editor scheduled through the now-fake `setTimeout` — including
 * happy-dom's `requestAnimationFrame` polyfill, which the other two
 * editor-mounting suites in this package already rely on this same
 * mechanism to drive). Bounded by iteration count, not wall time, so it
 * cannot itself become a padded wait.
 */
function pollUntil(condition: () => boolean, clock: FakeClock): Promise<void> {
  const maxIterations = 200;
  return (async () => {
    for (let i = 0; i < maxIterations; i++) {
      if (condition()) return;
      await tick();
      clock.advance(20);
    }
    throw new Error(`pollUntil: condition did not become true within ${maxIterations} iterations`);
  })();
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
    const clock = installFakeClock();
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
      await pollUntil(() => {
        try {
          return Boolean(result.getByRole('textbox', { name: 'Placeholder test editor' }));
        } catch {
          return false;
        }
      }, clock);

      const view = result.getByRole('textbox', { name: 'Placeholder test editor' });

      await pollUntil(
        () => view.querySelector('p')?.classList.contains('is-editor-empty') === true,
        clock,
      );

      // The custom property the CSS `::before` rule reads must be set on the
      // host that actually carries it (the wrapper div, not the inner
      // contenteditable `view` — cascading custom properties are inherited,
      // but `.style` only reflects an element's OWN inline style).
      const wrapper = result.container.querySelector<HTMLElement>('#placeholder-test');
      expect(wrapper?.style.getPropertyValue('--editor-placeholder')).toBe("'Start reviewing'");
    } finally {
      clock.restore();
      result.unmount();
      cleanup();
    }
  });

  test('a populated document is not decorated, and carries no placeholder custom property', async () => {
    const clock = installFakeClock();
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
      await pollUntil(() => {
        try {
          return Boolean(result.getByRole('textbox', { name: 'Placeholder populated editor' }));
        } catch {
          return false;
        }
      }, clock);

      const view = result.getByRole('textbox', { name: 'Placeholder populated editor' });
      const firstParagraph = view.querySelector('p');
      expect(firstParagraph?.classList.contains('is-editor-empty')).toBe(false);

      const wrapper = result.container.querySelector<HTMLElement>('#placeholder-test-populated');
      // Gated on document emptiness (cinder#1306's cosmetic half): a
      // populated document should not carry a dead inline custom property.
      expect(wrapper?.style.getPropertyValue('--editor-placeholder')).toBe('');
    } finally {
      clock.restore();
      result.unmount();
      cleanup();
    }
  });

  test('clearing content through the imperative setMarkdown() re-arms the placeholder gate immediately, not just eventually', async () => {
    // A PR review on this fix flagged that the placeholder gate reads the
    // `value` PROP, which the exported `setMarkdown()` imperative setter
    // used to bypass when an editor was already mounted (it only assigned
    // `value` in the not-yet-mounted branch). It does not stay wrong
    // forever — `onchange` (line ~487) eventually re-syncs `value` for ANY
    // document change, including a `setMarkdown()`-originated one, once
    // `@milkdown/plugin-listener`'s internal debounce and this component's
    // own `changeDebounceMs` both elapse — so a test that polls for the
    // fixed state with a generous budget (like the other tests in this
    // file) passes with or without this fix and proves nothing. The actual
    // defect is a TRANSIENT one: for that debounce window (a few hundred ms
    // by default), the gate is wrong even though the live document is
    // already empty. So this asserts immediately after `setMarkdown()`,
    // advancing the clock only 10ms total — comfortably inside every
    // debounce involved — to flush ProseMirror's own (synchronous,
    // non-debounced) decoration update without ever reaching the
    // `onchange` fallback that would mask the bug.
    const clock = installFakeClock();
    const result = render(MarkdownEditor, {
      props: {
        id: 'placeholder-test-imperative-clear',
        label: 'Placeholder imperative-clear editor',
        showToolbar: false,
        value: 'Real content already here.',
        placeholder: 'Start reviewing',
      },
    });

    try {
      await pollUntil(() => {
        try {
          return Boolean(
            result.getByRole('textbox', { name: 'Placeholder imperative-clear editor' }),
          );
        } catch {
          return false;
        }
      }, clock);

      // The textbox role appears in the DOM slightly before this
      // component's own `editorState` (set inside its `onready` callback)
      // does — waiting only for the role, as the other tests in this file
      // do, calls `setMarkdown()` while `editorState` is still null, which
      // silently takes the ALREADY-correct `else` branch and never
      // exercises the bug this test exists to catch. `data-ready` on the
      // wrapper flips in that same `onready` callback, so it is the actual
      // signal this test needs.
      await pollUntil(
        () =>
          result.container.querySelector('.markdown-editor-wrapper')?.getAttribute('data-ready') ===
          'true',
        clock,
      );

      const view = result.getByRole('textbox', {
        name: 'Placeholder imperative-clear editor',
      });
      expect(view.querySelector('p')?.classList.contains('is-editor-empty')).toBe(false);

      result.component['setMarkdown']('');

      // Small, fixed iteration budget (not a wall-clock wait): flushes
      // Svelte's own microtask-based reactivity and ProseMirror's
      // synchronous decoration recompute, well short of the ~200ms+
      // listener debounce that would let the `onchange` fallback mask this
      // specific bug.
      for (let i = 0; i < 5; i++) {
        await tick();
        clock.advance(2);
      }

      expect(view.querySelector('p')?.classList.contains('is-editor-empty')).toBe(true);

      const wrapper = result.container.querySelector<HTMLElement>(
        '#placeholder-test-imperative-clear',
      );
      expect(wrapper?.style.getPropertyValue('--editor-placeholder')).toBe("'Start reviewing'");
    } finally {
      clock.restore();
      result.unmount();
      cleanup();
    }
  });

  test('typing into an empty editor clears the decoration (the placeholder disappears once there is content)', async () => {
    const clock = installFakeClock();
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
      await pollUntil(() => {
        try {
          return Boolean(result.getByRole('textbox', { name: 'Placeholder live editor' }));
        } catch {
          return false;
        }
      }, clock);

      const view = result.getByRole('textbox', { name: 'Placeholder live editor' });
      await pollUntil(
        () => view.querySelector('p')?.classList.contains('is-editor-empty') === true,
        clock,
      );

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

      await pollUntil(
        () => view.querySelector('p')?.classList.contains('is-editor-empty') === false,
        clock,
      );

      const wrapper = result.container.querySelector<HTMLElement>('#placeholder-test-live');
      expect(wrapper?.style.getPropertyValue('--editor-placeholder')).toBe('');
    } finally {
      clock.restore();
      result.unmount();
      cleanup();
    }
  });
});
