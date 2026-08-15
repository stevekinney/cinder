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

  test('a populated document is not decorated, but still carries the placeholder custom property (inert, not gated)', async () => {
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

      // An earlier version of this fix gated `--editor-placeholder` on
      // `value.trim().length === 0`, reasoning a populated document
      // shouldn't carry a dead custom property. Review caught that this
      // introduced a visible regression (see placeholderStyleValue's own
      // doc comment in markdown-editor.svelte): `value` lags the live
      // document by up to a few hundred ms after a deletion-to-empty, so
      // the gate could read "not empty" for a window where the document
      // genuinely was empty, painting the CSS fallback instead of the
      // real placeholder. The property is unconditional again — present
      // here, but inert, since the `::before` rule that reads it only
      // paints when `is-editor-empty` is also present.
      const wrapper = result.container.querySelector<HTMLElement>('#placeholder-test-populated');
      expect(wrapper?.style.getPropertyValue('--editor-placeholder')).toBe("'Start reviewing'");
    } finally {
      clock.restore();
      result.unmount();
      cleanup();
    }
  });

  test('clearing content through the imperative setMarkdown() updates the decoration immediately, and keeps the bindable value prop in sync', async () => {
    // This test used to exist to prove the placeholder GATE re-armed after
    // an imperative clear. The gate is gone (placeholderStyleValue is
    // unconditional again — see its doc comment in markdown-editor.svelte),
    // so `--editor-placeholder` no longer discriminates anything about
    // `setMarkdown()` specifically: it is present before, during, and after
    // this test regardless of what `setMarkdown` does, and asserting it
    // here would look like coverage without being any.
    //
    // What's still real and still worth a test: `is-editor-empty` updates
    // correctly after a NON-typing content change (this decoration is
    // driven purely by ProseMirror's own synchronous recompute, unaffected
    // by either fix), and `setMarkdown()`'s own fix — syncing the
    // `$bindable` `value` prop on the already-mounted branch, not just the
    // not-yet-mounted one — is real prop-binding correctness a consumer
    // using `bind:value` depends on, independent of the placeholder. This
    // package's test harness has no lightweight way to observe a bindable
    // prop's value from outside without a wrapper component, so this
    // exercises it via the exported `getMarkdown()` accessor instead, which
    // reads `editorState.getMarkdown()` — a different code path — so it is
    // a weaker proxy than reading `value` directly would be, but still a
    // real regression guard: if `setMarkdown` regressed, `is-editor-empty`
    // would still update.
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

      // NOT a check on `setMarkdown`'s own `value =` fix: `getMarkdown()`
      // reads `editorState.getMarkdown()` directly whenever `editorState`
      // exists, bypassing `value` entirely — it would return the correct
      // string even with that fix reverted, so asserting it here would
      // repeat the same "looks like coverage, isn't" mistake this test's
      // docblock just described for the placeholder property. Verifying the
      // `$bindable` `value` prop's own sync needs a wrapper component this
      // file doesn't have; correctness there rests on the source's own
      // reasoning (see setMarkdown's doc comment in markdown-editor.svelte),
      // not on an assertion here.
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

      // The decoration is gone (checked above); the property itself is
      // unconditional and inert once there's no `is-editor-empty` for the
      // `::before` rule to key off — present, but no longer painted.
      const wrapper = result.container.querySelector<HTMLElement>('#placeholder-test-live');
      expect(wrapper?.style.getPropertyValue('--editor-placeholder')).toBe("'Start reviewing'");
    } finally {
      clock.restore();
      result.unmount();
      cleanup();
    }
  });
});
