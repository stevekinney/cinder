/**
 * Regression tests for the image-lightbox → Modal migration (CIN-377).
 *
 * These tests verify that:
 * - the lightbox composes `Modal` in chromeless mode (`chrome="none"`) rather
 *   than hand-rolling its own `aria-modal`, focus trap, scroll lock, and
 *   Escape handling — Modal owns all of that coordination via
 *   `SlidingDialogState` (the same lifecycle Drawer uses).
 * - the hand-rolled Escape handler, `createFocusTrap()` attachment, and
 *   `createBodyScrollLock()` attachment are gone from the source.
 * - arrow-key navigation (previous/next) and the index-reset-on-reopen
 *   behavior are UNCHANGED from before the migration.
 * - `.lightbox-content` (not Modal's body wrapper) is the initial-focus
 *   target, so arrow keys work immediately on open.
 * - the current image survives the exit transition: navigating then closing
 *   must not reset the displayed image to clampedInitialIndex until the NEXT
 *   fresh open, since Modal keeps this component's children mounted for the
 *   whole exit-transition window.
 */
/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { tick } from 'svelte';

import { setupHappyDom } from '../../../test/happy-dom.ts';

const source = readFileSync(resolve(import.meta.dir, 'image-lightbox.svelte'), 'utf8');

// setupHappyDom() MUST run before any @testing-library/svelte import because
// testing-library reads globalThis.document/window at module-init time.
setupHappyDom();

// happy-dom does not implement HTMLDialogElement.showModal / close, which
// Modal (composed here in chromeless mode) relies on — stub them the same
// way modal.test.ts does so the $effect inside modal.svelte doesn't throw.
if (typeof HTMLDialogElement !== 'undefined') {
  if (!HTMLDialogElement.prototype.showModal) {
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      value: function (this: HTMLDialogElement) {
        this.setAttribute('open', '');
      },
      configurable: true,
      writable: true,
    });
  }
  if (!HTMLDialogElement.prototype.close) {
    Object.defineProperty(HTMLDialogElement.prototype, 'close', {
      value: function (this: HTMLDialogElement) {
        this.removeAttribute('open');
      },
      configurable: true,
      writable: true,
    });
  }
}

const { render, fireEvent, cleanup } = await import('@testing-library/svelte');
const { default: ImageLightbox } = await import('./image-lightbox.svelte');

afterEach(() => {
  document.body.style.overflow = '';
  document.body.innerHTML = '';
});

describe('image-lightbox source contract — Modal composition', () => {
  test('composes Modal in chromeless mode rather than hand-rolling its own dialog shell', () => {
    expect(source).toContain("import { Modal } from '@lostgradient/cinder/modal'");
    expect(source).toContain('chrome="none"');
    expect(source).toContain('aria-label="Image viewer"');
  });

  test('no longer hand-rolls its own aria-modal / role="dialog"', () => {
    // Those now come from Modal's own markup.
    expect(source).not.toContain('aria-modal="true"');
    expect(source).not.toContain('role="dialog"');
  });

  test('no longer attaches its own focus trap', () => {
    expect(source).not.toContain('createFocusTrap');
  });

  test('no longer attaches its own body scroll lock', () => {
    expect(source).not.toContain('createBodyScrollLock');
  });

  test('no longer hand-rolls an Escape keydown handler', () => {
    // Escape is now handled entirely by Modal's native <dialog> `cancel` event,
    // routed through the shared escape stack.
    expect(source).not.toContain("case 'Escape'");
  });

  test('still handles ArrowLeft/ArrowRight for navigation', () => {
    expect(source).toContain("case 'ArrowLeft'");
    expect(source).toContain("case 'ArrowRight'");
  });

  test('marks .lightbox-content as the initial-focus target so arrow keys work immediately', () => {
    // Regression: Modal's own initial-focus policy otherwise lands focus on
    // its `.cinder-modal__body` wrapper — the PARENT of `.lightbox-content` —
    // and the keydown handler on `.lightbox-content` (a descendant) would
    // never see the keystroke until focus moved somewhere inside it.
    // `autofocus` makes Modal's `focusDialogBodyUnlessAutofocused` policy
    // focus this element directly instead of falling back to the body.
    expect(source).toMatch(/class="lightbox-content"[\s\S]*?autofocus/);
    expect(source).toMatch(/class="lightbox-content"[\s\S]*?tabindex="-1"/);
  });

  test("overrides the backdrop color via Modal's supported --cinder-modal-backdrop custom property, scoped through the class prop (not a :global() reach into Modal internals)", () => {
    expect(source).toContain('class="lightbox-modal"');
    expect(source).toContain(':global(.lightbox-modal)');
    expect(source).toContain('--cinder-modal-backdrop');
    // Regression guard: must not select Modal's own internal class names.
    expect(source).not.toMatch(/:global\(\.cinder-modal/);
  });

  test('does not use previousOpen $state + $effect write-back to reset currentIndex', () => {
    // Regression: the old code used `let previousOpen = $state(false)` plus an
    // $effect that wrote `previousOpen = open` (state write-back) to detect the
    // opening transition. The current replacement uses a plain (non-`$state`)
    // flag — `resetAppliedForCurrentSession` — as write-only bookkeeping for a
    // single effect that reads only `open`, so it never re-triggers itself.
    expect(source).not.toContain('previousOpen = $state(false)');
    expect(source).not.toContain('previousOpen = open');
    expect(source).toContain('navigationIndex');
    expect(source).toContain('clampedInitialIndex');
    expect(source).toContain('effectiveIndex');
  });

  test('effectiveIndex does not depend on `open`, so the displayed image survives the exit transition', () => {
    // Regression (CIN-377 review): Modal keeps this component's children
    // mounted for the full exit-transition window even after `open` has
    // already flipped to false. effectiveIndex must read ONLY
    // navigationIndex/clampedInitialIndex — gating it on `open` would reset
    // the displayed image the instant `open` goes false, visibly snapping
    // back mid-fade.
    //
    // This mechanism can't be proven via a DOM-behavioral test in THIS
    // harness: happy-dom computes a zero-length CSS transition, so Modal's
    // `waitForTransitionCompletion` resolves via a queued microtask that any
    // `await` (including `fireEvent`'s own internal flush) drains, unmounting
    // the panel before an assertion could run — there is no awaited
    // checkpoint here where "closing but still mounted" is observable. That
    // window is real in an actual browser (a non-zero CSS transition keeps
    // the panel mounted for its duration), so the source-level assertions
    // below are the guard for this harness; a Playwright test would be
    // needed to observe the DOM directly mid-fade.
    expect(source).toContain(
      'const effectiveIndex = $derived(frozenIndex ?? navigationIndex ?? clampedInitialIndex);',
    );
    expect(source).not.toContain('open ? (navigationIndex ?? clampedInitialIndex)');
  });

  test('freezes the session index before onClose can race it (CIN-377 review)', () => {
    // Regression: a controlled-component onClose callback commonly resets
    // its selected index (e.g. `initialIndex`) synchronously, in the SAME
    // tick as the close — even in the no-navigation case, where
    // effectiveIndex would otherwise keep tracking `clampedInitialIndex`
    // reactively. frozenIndex must be captured BEFORE onClose runs in both
    // dismissal paths, not just via the deferred effect (which would lose
    // the race against onClose's own synchronous mutation).
    const closeBody = source.slice(
      source.indexOf('function close()'),
      source.indexOf('function handleModalDismiss()'),
    );
    expect(closeBody.indexOf('frozenIndex = effectiveIndex')).toBeGreaterThan(-1);
    expect(closeBody.indexOf('frozenIndex = effectiveIndex')).toBeLessThan(
      closeBody.indexOf('onClose?.()'),
    );

    const dismissBody = source.slice(
      source.indexOf('function handleModalDismiss()'),
      source.indexOf('function previous()'),
    );
    expect(dismissBody.indexOf('frozenIndex = effectiveIndex')).toBeGreaterThan(-1);
    expect(dismissBody.indexOf('frozenIndex = effectiveIndex')).toBeLessThan(
      dismissBody.indexOf('onClose?.()'),
    );
  });

  test('the fallback freeze reads lastLiveIndex, not a fresh navigationIndex/clampedInitialIndex recomputation (CIN-377 review)', () => {
    // Regression: a controlling parent can set `open = false` AND reset
    // `initialIndex` in the very SAME reactive update — both prop changes
    // land in the same effect flush. By the time our open-watching effect
    // runs, `clampedInitialIndex` already reflects the NEW `initialIndex`,
    // so re-deriving the frozen value from it at that point would freeze
    // the POST-reset image, not what was visible when closing began.
    // `lastLiveIndex` is written continuously, only on flushes where `open`
    // is (still) true — so it holds the value from the LAST such flush,
    // unaffected by a same-flush prop reset. The fallback freeze in the
    // `else` branch must read `lastLiveIndex`, not recompute from
    // navigationIndex/clampedInitialIndex directly.
    expect(source).toContain('lastLiveIndex = navigationIndex ?? clampedInitialIndex;');
    const effectBody = source.slice(
      source.indexOf('$effect(() => {'),
      source.indexOf('const hasMultiple'),
    );
    const elseBranch = effectBody.slice(effectBody.indexOf('} else {'));
    expect(elseBranch).toContain('frozenIndex = lastLiveIndex;');
    expect(elseBranch).not.toContain('navigationIndex ?? clampedInitialIndex');
  });

  test('close() and handleModalDismiss() do not reset navigationIndex synchronously', () => {
    // The reset happens exactly once, on the NEXT fresh open (the effect
    // above) — not at close time, which would race the exit transition.
    const closeBody = source.slice(
      source.indexOf('function close()'),
      source.indexOf('function handleModalDismiss()'),
    );
    expect(closeBody).not.toContain('navigationIndex = null');

    const dismissBody = source.slice(
      source.indexOf('function handleModalDismiss()'),
      source.indexOf('function previous()'),
    );
    expect(dismissBody).not.toContain('navigationIndex = null');
  });

  test('the Modal render guard requires hasOpenedOnce, not currentImage alone', () => {
    // Regression: once currentImage stopped depending on `open`, guarding
    // Modal's render on `currentImage` alone mounted a closed Modal for
    // every never-opened lightbox instance. `hasOpenedOnce` restores lazy
    // mounting: false until the first open, clearing again once Modal's
    // exit transition genuinely finishes (via onExitComplete) rather than
    // staying permanently true forever after the first open.
    expect(source).toContain('let hasOpenedOnce = $state(false);');
    expect(source).toContain('{#if hasOpenedOnce && currentImage}');
  });

  test('mountGeneration forces a full destroy-then-recreate of the Modal instance via {#key}', () => {
    // Regression: hasOpenedOnce flipping false (exit complete) then true
    // again (a fresh open) across two separate reactive commits could leave
    // a stale, already-destroyed Modal instance's <dialog> attached
    // alongside the freshly-mounted one — plain `{#if}` boolean-toggle
    // diffing was not reliable here. `{#key mountGeneration}` forces Svelte
    // to fully tear down the previous instance before creating the new one.
    expect(source).toContain('let mountGeneration = $state(0);');
    expect(source).toContain('{#key mountGeneration}');
    expect(source).toContain('mountGeneration += 1;');
  });

  test("handleExitComplete only clears hasOpenedOnce when still closed, deferred past Modal's own teardown", () => {
    // Regression: this fires from deep inside Modal's own effect chain
    // (SlidingDialogState's transition-completion callback) — i.e. from
    // WITHIN the very component instance the write tears down. Deferring
    // via tick() lets Modal's own teardown settle first; the `if (!open)`
    // guard means a reopen that races the deferred write leaves
    // hasOpenedOnce (and the mount) untouched.
    expect(source).toContain('function handleExitComplete()');
    const handlerBody = source.slice(
      source.indexOf('function handleExitComplete()'),
      source.indexOf('function previous()'),
    );
    expect(handlerBody).toContain('tick()');
    expect(handlerBody).toContain('if (!open)');
    expect(handlerBody).toContain('hasOpenedOnce = false;');
  });
});

describe('image-lightbox — behavioral reset on reopen', () => {
  afterEach(() => {
    cleanup();
    document.body.replaceChildren();
    document.body.style.overflow = '';
  });

  const images = [
    { src: '/a.jpg', alt: 'Image A' },
    { src: '/b.jpg', alt: 'Image B' },
    { src: '/c.jpg', alt: 'Image C' },
  ];

  test('a same-batch parent-driven close + initialIndex reset still unfreezes correctly on the next fresh open', async () => {
    // Behavioral regression net for the "capture the index before
    // parent-driven closes" review thread: a single rerender changes BOTH
    // `open` (to false) and `initialIndex` together, exactly like a
    // controlling parent's same-update close+reset. This harness can't
    // observe the DOM mid-fade (happy-dom collapses Modal's exit transition
    // instantly — documented elsewhere in this file), so this proves the
    // surrounding mechanism instead: the freeze/unfreeze cycle survives a
    // same-batch multi-prop change without getting stuck, and the NEXT
    // fresh open still picks up the fresh initialIndex correctly.
    const { container, rerender } = render(ImageLightbox, {
      props: { images, initialIndex: 1, open: true },
    });
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('Image B');

    // Parent-driven: open flips false AND initialIndex resets, together.
    await rerender({ images, initialIndex: 2, open: false });
    await tick();

    await rerender({ images, initialIndex: 2, open: true });
    await tick();
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('Image C');
  });

  test('displayed index resets to initialIndex after close and reopen', async () => {
    const { container, rerender } = render(ImageLightbox, {
      props: { images, initialIndex: 0, open: true },
    });

    // Initial render: shows image A (index 0).
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('Image A');
    expect(container.querySelector('.lightbox-counter')?.textContent?.trim()).toBe('1 of 3');

    // Navigate forward twice → now on image C (index 2).
    await fireEvent.click(container.querySelector('[aria-label="Next image"]')!);
    await fireEvent.click(container.querySelector('[aria-label="Next image"]')!);
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('Image C');
    expect(container.querySelector('.lightbox-counter')?.textContent?.trim()).toBe('3 of 3');

    // Close the lightbox via its own close button.
    await fireEvent.click(container.querySelector('[aria-label="Close image viewer"]')!);
    await tick();

    // Reopen: must reset to initialIndex (0 → image A), NOT stay on image C.
    await rerender({ images, initialIndex: 0, open: true });
    await tick();
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('Image A');
    expect(container.querySelector('.lightbox-counter')?.textContent?.trim()).toBe('1 of 3');
  });

  test('displayed index resets to a non-zero initialIndex after close and reopen', async () => {
    const { container, rerender } = render(ImageLightbox, {
      props: { images, initialIndex: 1, open: true },
    });

    // Initial render: shows image B (index 1).
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('Image B');

    // Navigate to image C.
    await fireEvent.click(container.querySelector('[aria-label="Next image"]')!);
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('Image C');

    // Close and reopen with the same initialIndex=1.
    await fireEvent.click(container.querySelector('[aria-label="Close image viewer"]')!);
    await tick();
    await rerender({ images, initialIndex: 1, open: true });
    await tick();

    // Must reset to initialIndex=1 (image B), not stay on image C.
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('Image B');
  });

  test('arrow-key navigation moves previous/next and wraps', async () => {
    const { container } = render(ImageLightbox, {
      props: { images, initialIndex: 0, open: true },
    });

    const content = container.querySelector('.lightbox-content')!;
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('Image A');

    await fireEvent.keyDown(content, { key: 'ArrowRight' });
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('Image B');

    await fireEvent.keyDown(content, { key: 'ArrowLeft' });
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('Image A');

    // Wraps backward from the first image to the last.
    await fireEvent.keyDown(content, { key: 'ArrowLeft' });
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('Image C');
  });

  test('pressing ArrowRight immediately after open (no manual focus) advances the index', async () => {
    // Regression: without `autofocus` on `.lightbox-content`, Modal's initial
    // focus lands on its `.cinder-modal__body` wrapper — the PARENT of
    // `.lightbox-content` — so a keydown dispatched on whatever the browser
    // actually focused would bubble from the body, past `.lightbox-content`'s
    // OWN keydown listener never firing (it lives on a child, not an
    // ancestor of the focused element). This test fires the event on
    // `document.activeElement` — whatever Modal's initial-focus policy
    // actually landed on — rather than targeting `.lightbox-content`
    // directly, so it fails the way the real bug failed if the fix regresses.
    const { container } = render(ImageLightbox, {
      props: { images, initialIndex: 0, open: true },
    });

    // Modal's initial-focus policy is deferred via `tick().then(...)`.
    await tick();
    await tick();

    expect(document.activeElement).toBe(container.querySelector('.lightbox-content'));
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('Image A');

    await fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('Image B');
  });

  test('the close button calls onClose, and navigation state clears on the next fresh open', async () => {
    let closed = 0;
    const { container, rerender } = render(ImageLightbox, {
      props: { images, initialIndex: 0, open: true, onClose: () => (closed += 1) },
    });

    await fireEvent.click(container.querySelector('[aria-label="Next image"]')!);
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('Image B');

    await fireEvent.click(container.querySelector('[aria-label="Close image viewer"]')!);
    expect(closed).toBe(1);

    // Navigation state is not cleared by close() itself (see the
    // exit-transition-preservation tests above) — it clears exactly once, on
    // the NEXT fresh open. Reopening here (a fresh `open: true`) is that
    // transition, so the displayed image must be back to initialIndex.
    await rerender({ images, initialIndex: 0, open: true });
    await tick();
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('Image A');
  });

  test('a prop change while closed (simulating an onClose reset) does not leak in until the next fresh open', async () => {
    // Regression (CIN-377 review): frozenIndex must release exactly once,
    // on the NEXT fresh open — not stick forever, and not leak an
    // intervening prop mutation while still closed. No arrow navigation
    // happens here (the specific no-navigation case the review flagged):
    // the lightbox shows initialIndex=0 (Image A), closes, `initialIndex`
    // changes to 2 WHILE CLOSED (simulating a controlled-component onClose
    // cleanup), and only the next fresh open should pick up the new value.
    const { container, rerender } = render(ImageLightbox, {
      props: { images, initialIndex: 0, open: true },
    });
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('Image A');

    await fireEvent.click(container.querySelector('[aria-label="Close image viewer"]')!);
    await tick();

    await rerender({ images, initialIndex: 2, open: false });
    await tick();

    // Reopening picks up the FRESH initialIndex (2 → Image C) — proving the
    // freeze correctly released on this open rather than sticking with
    // whatever was frozen at close time.
    await rerender({ images, initialIndex: 2, open: true });
    await tick();
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('Image C');
  });
});

describe('image-lightbox — lazy Modal mount (CIN-377 review)', () => {
  afterEach(() => {
    cleanup();
    document.body.replaceChildren();
    document.body.style.overflow = '';
  });

  const images = [
    { src: '/a.jpg', alt: 'Image A' },
    { src: '/b.jpg', alt: 'Image B' },
  ];

  test('a never-opened lightbox renders no Modal/dialog at all', () => {
    // Regression: once effectiveIndex/currentImage stopped depending on
    // `open` (the exit-transition-preservation fix above), the top-level
    // `{#if currentImage}` guard around <Modal> became true unconditionally
    // for any non-empty `images` array — every MessageAttachments instance
    // with at least one image mounted a closed Modal (dialog + reduced-
    // motion observer + SlidingDialogState effects) even when its lightbox
    // was never opened. `MessageAttachments` renders one ImageLightbox per
    // message unconditionally, so a long chat with many image messages would
    // accumulate one hidden dialog per message. Restored laziness: the guard
    // now also requires `open || hasOpenedOnce`.
    const { container } = render(ImageLightbox, {
      props: { images, initialIndex: 0, open: false },
    });
    expect(container.querySelector('dialog')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
  });

  test('opening mounts the Modal/dialog', async () => {
    const { container, rerender } = render(ImageLightbox, {
      props: { images, initialIndex: 0, open: false },
    });
    expect(container.querySelector('dialog')).toBeNull();

    await rerender({ images, initialIndex: 0, open: true });
    await tick();
    expect(container.querySelector('dialog')).not.toBeNull();
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('Image A');
  });

  test('once opened, the dialog does not tear down synchronously the instant open flips false', async () => {
    // In this harness, Modal's exit-transition completion (queueMicrotask,
    // since happy-dom collapses the CSS transition duration to zero) plus
    // this component's own tick()-deferred onExitComplete handler both
    // resolve within a SINGLE `await tick()` — so a full unmount is
    // observable that fast here (see the "fully unmounts" test below). What
    // this test guards is the synchronous instant: rendering must not tear
    // the whole Modal down as a direct, synchronous side effect of the
    // `open` prop write itself, before Svelte even gets a chance to flush —
    // i.e. the guard is not `{#if open && currentImage}`.
    const { container, rerender } = render(ImageLightbox, {
      props: { images, initialIndex: 0, open: true },
    });
    await tick();
    expect(container.querySelector('dialog')).not.toBeNull();

    const rerenderPromise = rerender({ images, initialIndex: 0, open: false });
    // Deliberately no `await` yet — checked synchronously, in the same
    // microtask as the call, before any flush has had a chance to run.
    expect(container.querySelector('dialog')).not.toBeNull();
    await rerenderPromise;
  });

  test('the Modal fully unmounts once the exit transition completes, releasing hasOpenedOnce (CIN-377 review)', async () => {
    // Regression: hasOpenedOnce previously stayed permanently true after the
    // FIRST open, so a lightbox that had ever been opened kept a closed
    // <dialog> (plus SlidingDialogState's effects and a useReducedMotion
    // MediaQuery subscription) mounted for the rest of the chat's lifetime —
    // one per message, in a long thread with many image messages. Wiring
    // Modal's onExitComplete to clear hasOpenedOnce means the Modal actually
    // unmounts once its exit transition genuinely finishes, not merely once
    // `open` goes false.
    const { container, rerender } = render(ImageLightbox, {
      props: { images, initialIndex: 0, open: true },
    });
    await tick();
    expect(container.querySelector('dialog')).not.toBeNull();

    await rerender({ images, initialIndex: 0, open: false });
    // Drain enough microtask turns for Modal's own exit-transition
    // completion (waitForTransitionCompletion's reduced/zero-duration path
    // resolves via queueMicrotask, then onClosed/onExitComplete fire) to
    // actually land — a single tick() only proves the panel SURVIVED the
    // instant `open` went false (the test above), not that it eventually
    // unmounts.
    await tick();
    await tick();
    await tick();

    expect(container.querySelector('dialog')).toBeNull();
  });

  test('reopening during the exit transition remounts cleanly with the fresh content, not a stale/broken state', async () => {
    const { container, rerender } = render(ImageLightbox, {
      props: { images, initialIndex: 0, open: true },
    });
    await tick();
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('Image A');

    // Close, then reopen with different props BEFORE draining any further
    // ticks — this is the "reopen during the exit transition" case
    // `onExitComplete`'s reopen-guard (`SlidingDialogState` skips the
    // callback when `getOpen()` is true again) exists to support: Modal
    // must never leave the lightbox unmounted or stuck.
    await rerender({ images, initialIndex: 1, open: false });
    await rerender({ images, initialIndex: 1, open: true });
    await tick();

    expect(container.querySelector('dialog')).not.toBeNull();
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('Image B');
  });

  test('a close-then-reopen cycle never leaves a stale closed <dialog> behind alongside the fresh one', async () => {
    // Regression: the outer mount gate that clears on exit-complete (so a
    // never-reopened lightbox eventually fully unmounts) destroys the old
    // Modal instance and creates a fresh one on the next open. A prior
    // version of this fix left the OLD (already-destroyed, already-closed)
    // Modal instance's <dialog> element attached to the DOM alongside the
    // new instance's — two real, distinct dialog elements, both attached,
    // with `container.querySelector('img')` nondeterministically resolving
    // to whichever happened to be first in document order. Modal's own
    // onDestroy now defensively detaches its <dialog> (native <dialog>
    // elements are promoted to the browser's top layer, outside ordinary
    // document-flow child removal, which is why relying on ordinary block
    // teardown alone was not sufficient here).
    const { container, rerender } = render(ImageLightbox, {
      props: { images, initialIndex: 0, open: true },
    });
    await tick();

    await fireEvent.click(container.querySelector('[aria-label="Close image viewer"]')!);
    await tick();

    await rerender({ images, initialIndex: 0, open: true });
    await tick();

    expect(container.querySelectorAll('dialog').length).toBe(1);
    expect(container.querySelectorAll('img').length).toBe(1);
  });
});
