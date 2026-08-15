/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';
import { tick } from 'svelte';
import type { FakeClock } from '../../test/fake-clock.ts';
import { installFakeClock } from '../../test/fake-clock.ts';
import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const [{ default: OneWaySyncHarness }, { default: BindableHarness }, { cleanup, render }] =
  await Promise.all([
    import('./markdown-editor-onewaysync-harness.svelte'),
    import('./markdown-editor-bindable-harness.svelte'),
    import('@testing-library/svelte'),
  ]);

/**
 * See `markdown-editor.placeholder.test.ts`'s own docblock for why a fake
 * clock installed BEFORE `render()` (not after) plus a bounded `tick()` +
 * `clock.advance()` loop replaces a real wall-clock wait here: mounting a
 * live editor arms `@milkdown/plugin-listener`'s internal ~200ms debounce
 * regardless of whether anything is typed, and a fixed real wait is the
 * exact pattern this repo's "no timeout/wait-threshold" rule forbids. None
 * of the assertions below depend on that debounce actually firing — see the
 * doc comment on `setMarkdown()` in markdown-editor.svelte for why cinder#1328
 * reproduces with zero elapsed time, not on a debounce race — this is just
 * to drain the timer harmlessly on teardown, matching the rest of this
 * package's editor-mounting suites.
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

function isReady(container: HTMLElement): boolean {
  return container.querySelector('.markdown-editor-wrapper')?.getAttribute('data-ready') === 'true';
}

/**
 * cinder#1328 — `MarkdownEditor.setMarkdown()` used to write its own
 * `$bindable` `value` prop UNCONDITIONALLY, in the same script execution as
 * its caller. `ReviewEditor.setMarkdown()` (review-editor-impl.svelte,
 * ~932-934) writes its OWN `value` immediately before calling this
 * function — a one-way consumer (`value={editorValue}`, not `bind:value`)
 * writing the same prop from two places in one synchronous pass.
 *
 * That pairing corrupts, not just races, Svelte's prop machinery: writing
 * to a bindable's backing derived while it is already `MAYBE_DIRTY` from the
 * parent's own pending change forces it `CLEAN` (`update_derived_status` in
 * `svelte/src/internal/client/reactivity/status.js`) without ever
 * re-executing it, leaving its `WAS_MARKED` propagation flag set. A LATER,
 * unrelated parent-driven value change — `ReviewEditor.reset()`, no matter
 * how much later — finds that flag already set, and `mark_reactions`
 * (`svelte/src/internal/client/reactivity/sources.js`) skips propagating to
 * this prop entirely. The "sync external value changes" effect in
 * markdown-editor.svelte never re-fires, and the live document is stuck.
 * (Working theory, pinned to svelte@5.56.4 — see setMarkdown()'s own doc
 * comment in markdown-editor.svelte for the caveat.)
 *
 * This is NOT a debounce race: it reproduces with zero elapsed time between
 * the two calls, with an added `await tick()` between them, and stays
 * broken indefinitely afterward (confirmed by sweeping 0-1200ms of delay
 * between them in both shapes against the pre-fix code — every point
 * reproduced it). The fix guards the write with a read-compare
 * (`if (value !== content) value = content;`): the read resolves whatever
 * the parent already wrote through the ordinary, non-corrupting path first
 * — the parent's write always happens earlier in the same script, before
 * `setMarkdown()` is even called — so the follow-up write becomes a no-op
 * exactly in the case that used to corrupt the prop. No deferral: a
 * `tick()`-deferred version was tried and rejected because it relocated the
 * same unconditional force-write to a later point where it could still race
 * a not-yet-settled parent write.
 */
describe('MarkdownEditor.setMarkdown() vs. a one-way value prop (cinder#1328)', () => {
  test('a dual write (ReviewEditor.setMarkdown()-shaped) does not block a later reset from reaching the live document', async () => {
    const clock = installFakeClock();
    const result = render(OneWaySyncHarness, {
      props: { initialValue: 'Original content.' },
    });

    try {
      await pollUntil(() => isReady(result.container), clock);

      const component = result.component as unknown as {
        dualWriteSetMarkdown: (content: string) => void;
        setOuterValue: (content: string) => void;
        getLiveMarkdown: () => string;
      };

      // Mirrors ReviewEditor.setMarkdown(): writes the parent's own value
      // AND calls the child's setMarkdown() in the same synchronous pass.
      component.dualWriteSetMarkdown('Imperative content.');

      // Mirrors ReviewEditor.reset(): a later, unrelated one-way value
      // change from the parent. No delay between the two calls — the bug
      // does not need one.
      component.setOuterValue('Reset content.');

      await pollUntil(() => component.getLiveMarkdown().trim() === 'Reset content.', clock);

      // The load-bearing assertion: the LIVE ProseMirror document (what
      // getAst()/the undo stack/a real consumer's rendered DOM read) must
      // reflect the reset.
      expect(component.getLiveMarkdown().trim()).toBe('Reset content.');
    } finally {
      clock.restore();
      result.unmount();
      cleanup();
    }
  });

  test('the same dual write, with an await tick() boundary before the reset, still reaches the live document', async () => {
    // A revert-and-restore round on this fix's first attempt (a
    // `tick()`-deferred write) found it passed the zero-delay case above but
    // failed with exactly one microtask of separation between the two
    // calls — the deferred write itself could still race a not-yet-settled
    // parent write. This pins that specific interleaving so a future
    // "defer instead of guard" rewrite cannot silently reintroduce it.
    const clock = installFakeClock();
    const result = render(OneWaySyncHarness, {
      props: { initialValue: 'Original content.' },
    });

    try {
      await pollUntil(() => isReady(result.container), clock);

      const component = result.component as unknown as {
        dualWriteSetMarkdown: (content: string) => void;
        setOuterValue: (content: string) => void;
        getLiveMarkdown: () => string;
      };

      component.dualWriteSetMarkdown('Imperative content.');
      await tick();
      component.setOuterValue('Reset content.');

      await pollUntil(() => component.getLiveMarkdown().trim() === 'Reset content.', clock);

      expect(component.getLiveMarkdown().trim()).toBe('Reset content.');
    } finally {
      clock.restore();
      result.unmount();
      cleanup();
    }
  });

  test('a plain setMarkdown() call (no matching parent-level write) was never broken, and still is not', async () => {
    // Isolates that cinder#1328 is specifically about the DUAL write, not
    // about calling setMarkdown() at all — a regression guard against a
    // fix that is broader (or narrower) than the actual bug.
    const clock = installFakeClock();
    const result = render(OneWaySyncHarness, {
      props: { initialValue: 'Original content.' },
    });

    try {
      await pollUntil(() => isReady(result.container), clock);

      const component = result.component as unknown as {
        setMarkdownOnEditor: (content: string) => void;
        setOuterValue: (content: string) => void;
        getLiveMarkdown: () => string;
      };

      component.setMarkdownOnEditor('Imperative content.');
      component.setOuterValue('Reset content.');

      await pollUntil(() => component.getLiveMarkdown().trim() === 'Reset content.', clock);

      expect(component.getLiveMarkdown().trim()).toBe('Reset content.');
    } finally {
      clock.restore();
      result.unmount();
      cleanup();
    }
  });

  test('a bind:value consumer sees setMarkdown() reflected SYNCHRONOUSLY, with the literal content (the contract the fix must not change)', () => {
    // No `pollUntil`/`await` around the write-and-read: the fix must not
    // turn this into an async contract (a `tick()`-deferred version of the
    // fix, tried and rejected, would have failed this exact test). No
    // `.trim()` either — asserting the exact literal string proves this
    // still writes the caller's own `content`, not a re-serialization of
    // the live document (which would carry ProseMirror/remark's trailing
    // newline and fail a non-trimmed equality check).
    const clock = installFakeClock();
    const result = render(BindableHarness, {
      props: { initialValue: 'Original content.' },
    });

    try {
      const component = result.component as unknown as {
        setMarkdownOnEditor: (content: string) => void;
        getValue: () => string;
      };

      component.setMarkdownOnEditor('Imperative content.');

      expect(component.getValue()).toBe('Imperative content.');
    } finally {
      clock.restore();
      result.unmount();
      cleanup();
    }
  });
});
