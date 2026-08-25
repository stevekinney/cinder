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

  test('the Modal render guard requires hasOpenedOnce, not sessionImage alone', () => {
    // Regression: once currentImage stopped depending on `open`, guarding
    // Modal's render on an image value alone mounted a closed Modal for
    // every never-opened lightbox instance. `hasOpenedOnce` restores lazy
    // mounting: false until the first open, clearing again once Modal's
    // exit transition genuinely finishes (via onExitComplete) rather than
    // staying permanently true forever after the first open.
    //
    // The guard reads `sessionImage` (a snapshot), not `currentImage` (the
    // live array lookup) — see the "images cleared mid-session" tests below
    // for why: a parent clearing `images` during/right after an open session
    // must not destroy the still-open/closing Modal outright.
    expect(source).toContain('{#if hasOpenedOnce && sessionImage}');
  });

  test('hasOpenedOnce is seeded from `open && images.length > 0`, not `open` alone or a hardcoded false', () => {
    // Regression (PR #1422 review): seeding from `open` ALONE meant an
    // instance constructed with `open: true` and an EMPTY `images` array set
    // `hasOpenedOnce = true` even though the template's own mount condition
    // (`{#if hasOpenedOnce && currentImage}`) never actually mounts a Modal
    // in that case (`currentImage` is `undefined` for an empty array) — with
    // no Modal ever mounting, `onExitComplete` (the only other place that
    // clears the flag) never fires, so it stuck at `true` forever. A LATER
    // update supplying non-empty `images` (with the lightbox by then already
    // closed) would mount a Modal that was already CLOSED the instant it
    // appeared, with no exit transition to release it. Gating the seed on
    // `images.length > 0` too matches the template's actual mount condition.
    // Per OVERLAY-POLICY.md's SSR rule, this seeding does not put any dialog
    // markup into server HTML either way — Modal's own `{#if mounted}` gate
    // keeps its overlay surface SSR-empty regardless; see
    // image-lightbox.ssr.test.ts for the executable proof of that contract.
    expect(source).toContain(
      'let hasOpenedOnce = $state(open && untrack(() => images.length) > 0);',
    );
    expect(source).not.toContain('let hasOpenedOnce = $state(false);');
    expect(source).not.toContain('let hasOpenedOnce = $state(open);');
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

  test('open flipping true with an empty images array does not leak a closed Modal once images later become non-empty (PR #1422 review)', async () => {
    // Regression: `open` flipping true while `images` was empty used to set
    // `hasOpenedOnce = true` unconditionally, even though the template's own
    // mount guard (`{#if hasOpenedOnce && currentImage}`) never actually
    // mounts a Modal in that case — `currentImage` is `undefined` for an
    // empty `images` array. With no Modal ever mounting, `onExitComplete`
    // (the only other place that clears `hasOpenedOnce`) never fires, so the
    // flag stuck at `true` forever. If `open` then flipped back to `false`
    // and a LATER update supplied non-empty `images`, the template condition
    // became true and mounted a Modal that was already closed the instant it
    // appeared — a closed <dialog> + SlidingDialogState + useReducedMotion
    // subscription that then persists indefinitely, since a Modal that never
    // actually opens has no exit transition to release it.
    const { container, rerender } = render(ImageLightbox, {
      props: { images: [], initialIndex: 0, open: true },
    });
    await tick();
    // No Modal mounts — there is nothing to show yet.
    expect(container.querySelector('dialog')).toBeNull();

    // The lightbox closes again (still no images) before ever mounting.
    await rerender({ images: [], initialIndex: 0, open: false });
    await tick();
    expect(container.querySelector('dialog')).toBeNull();

    // A later update supplies real images, but the lightbox is already
    // closed by this point (`open: false`) — a fresh, genuinely-closed
    // Modal instance must NOT appear.
    await rerender({ images, initialIndex: 0, open: false });
    await tick();
    expect(container.querySelector('dialog')).toBeNull();
  });

  test('images transitioning from empty to non-empty WHILE still open mounts a genuinely open Modal, not a leaked closed one', async () => {
    // Companion to the test above: when `images` goes from empty to
    // non-empty while `open` is still `true` (rather than after a close),
    // the fix must still mount a real, OPEN Modal — not silently do nothing
    // forever because `hasOpenedOnce` was never set while `images` was
    // empty.
    const { container, rerender } = render(ImageLightbox, {
      props: { images: [], initialIndex: 0, open: true },
    });
    await tick();
    expect(container.querySelector('dialog')).toBeNull();

    await rerender({ images, initialIndex: 0, open: true });
    await tick();

    const dialog = container.querySelector('dialog');
    expect(dialog).not.toBeNull();
    expect(dialog?.hasAttribute('open')).toBe(true);
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('Image A');
  });

  test('clearing images mid-session (or right as it closes) does not destroy the Modal outright — the exit transition still runs and the gate still clears (PR #1422 review)', async () => {
    // Regression: `currentImage` (`images[effectiveIndex]`) previously drove
    // the template's mount guard directly (`{#if hasOpenedOnce &&
    // currentImage}`). A parent clearing `images` while the lightbox was
    // open (or right as it closed) made `currentImage` go `undefined`
    // mid-session — that `{#if}` destroyed the still-open/closing Modal
    // INSTANTLY, skipping the promised exit transition, and `onExitComplete`
    // never got a chance to fire (Modal was torn down out from under it, not
    // exited normally) — so `hasOpenedOnce` never cleared either.
    const { container, rerender } = render(ImageLightbox, {
      props: { images, initialIndex: 0, open: true },
    });
    await tick();
    expect(container.querySelector('dialog')).not.toBeNull();
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('Image A');

    // Parent clears `images` WHILE still open — `currentImage` is now
    // `undefined`, but the Modal must survive, still showing the frozen
    // last-known image (`sessionImage`), not vanish.
    await rerender({ images: [], initialIndex: 0, open: true });
    await tick();
    expect(container.querySelector('dialog')).not.toBeNull();
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('Image A');

    // Now close, with `images` still empty — the exit transition must
    // actually run (not be skipped because there's no "current" image),
    // and once it genuinely finishes, the Modal fully unmounts and the gate
    // (`hasOpenedOnce`) clears — proving `onExitComplete` fired normally
    // rather than the component having been torn down out from under it.
    await rerender({ images: [], initialIndex: 0, open: false });
    // Immediately after the `open` flip, the Modal must still be present —
    // proving the exit transition actually started, not an instant destroy.
    expect(container.querySelector('dialog')).not.toBeNull();

    // Drain enough microtask turns for the exit transition to genuinely
    // finish (same pattern as the "fully unmounts" test above).
    await tick();
    await tick();
    await tick();
    expect(container.querySelector('dialog')).toBeNull();
  });

  test('restoring images after a clear-mid-session close does not resurrect a zombie (already-closed) Modal (PR #1422 review)', async () => {
    // Companion to the test above: once the clear-images-while-open Modal
    // has fully exited (gate cleared), a later `images` update — while the
    // lightbox is STILL CLOSED — must not mount anything. Before this fix,
    // `hasOpenedOnce` stuck at `true` forever in this exact sequence
    // (`images` cleared mid-session prevented the gate from ever clearing),
    // so restoring `images` resurrected a Modal that was already closed the
    // instant it appeared, with no exit transition to release it.
    const { container, rerender } = render(ImageLightbox, {
      props: { images, initialIndex: 0, open: true },
    });
    await tick();
    expect(container.querySelector('dialog')).not.toBeNull();

    await rerender({ images: [], initialIndex: 0, open: true });
    await tick();

    await rerender({ images: [], initialIndex: 0, open: false });
    await tick();
    await tick();
    await tick();
    expect(container.querySelector('dialog')).toBeNull();

    // Restore `images` while STILL CLOSED — must NOT resurrect a Modal.
    await rerender({ images, initialIndex: 0, open: false });
    await tick();
    expect(container.querySelector('dialog')).toBeNull();

    // A genuine fresh open afterward must still work correctly — proving
    // the gate is in a clean, reusable state, not permanently stuck.
    await rerender({ images, initialIndex: 0, open: true });
    await tick();
    const dialog = container.querySelector('dialog');
    expect(dialog).not.toBeNull();
    expect(dialog?.hasAttribute('open')).toBe(true);
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('Image A');
  });

  test('closing, clearing images, then reopening before the exit transition finishes does not show a stale image absent from images (PR #1422 review)', async () => {
    // Regression: close → parent clears `images` → `open` flips back to
    // `true`, all before the prior close's exit transition genuinely
    // finishes. The `if (open)` branch's fresh-open handling previously only
    // skipped setting `hasOpenedOnce` for an empty `images` array — it never
    // touched `sessionImage`, so the PREVIOUS (truthy) snapshot from before
    // the close survived untouched. Reopening also cancels Modal's own close
    // cycle (a fresh `open === true` sync invalidates the in-flight
    // `beginClosing()`/`#finishClosing()` cycle — see
    // `create-sliding-dialog-state.svelte.ts`'s own `syncOpenState()`
    // comments), so no `onExitComplete` was ever coming to clear the stale
    // snapshot either — the lightbox stayed open indefinitely showing an
    // image that was not even in `images` anymore.
    const { container, rerender } = render(ImageLightbox, {
      props: { images, initialIndex: 0, open: true },
    });
    await tick();
    expect(container.querySelector('dialog')).not.toBeNull();
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('Image A');

    // Close.
    await rerender({ images, initialIndex: 0, open: false });

    // Parent clears `images` and reopens before the exit transition (or even
    // a single tick) has a chance to finish — issued back-to-back, without
    // awaiting either, mirroring this file's established technique for
    // proving something did NOT happen as a direct synchronous side effect
    // of a state transition (see the "swap images mid-exit" test above).
    const clearPromise = rerender({ images: [], initialIndex: 0, open: false });
    const reopenPromise = rerender({ images: [], initialIndex: 0, open: true });
    await clearPromise;
    await reopenPromise;
    await tick();

    // The empty-images reopen is not renderable — no stale image (present or
    // absent from the current empty `images`) may still be showing.
    expect(container.querySelector('img')).toBeNull();

    // The gate must not be left leaking a permanently-stuck Modal, either:
    // restoring `images` while still open must resync to a genuinely fresh,
    // correct image — not a zombie stuck on the pre-clear snapshot.
    await rerender({ images, initialIndex: 0, open: true });
    await tick();
    const dialog = container.querySelector('dialog');
    expect(dialog).not.toBeNull();
    expect(dialog?.hasAttribute('open')).toBe(true);
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('Image A');
  });

  test('swapping to a DIFFERENT non-empty images list mid-exit does not visibly swap the fading lightbox to the next session (PR #1422 review)', async () => {
    // Regression: the `currentImage`-mirroring effect (the one that keeps
    // `sessionImage` in sync during LIVE navigation) previously had no
    // dependency on `open` at all — so if a parent swapped `images` to a
    // different non-empty list WHILE the lightbox was still exiting (`open`
    // already `false`, Modal still mounted for the fade), the mirror
    // re-resolved `currentImage` against the NEW list and the still-fading
    // lightbox visibly swapped to whatever image now sat at the same index
    // in the new array — a jarring swap mid-exit, not the frozen image the
    // user was actually looking at when they closed it.
    const otherImages = [
      { src: '/c.jpg', alt: 'Image C' },
      { src: '/d.jpg', alt: 'Image D' },
    ];

    const { container, rerender } = render(ImageLightbox, {
      props: { images, initialIndex: 0, open: true },
    });
    await tick();
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('Image A');

    // Close, then swap to a DIFFERENT non-empty list — both issued
    // back-to-back WITHOUT awaiting either promise first (same technique as
    // the "does not tear down synchronously" test above): this harness's
    // reduced-motion/zero-duration transition path resolves via a queued
    // microtask, and awaiting even one of these calls risks letting that
    // microtask run to completion — at which point the exit has ALREADY
    // genuinely finished and `sessionImage` was cleared via the NORMAL
    // `handleExitComplete` path, which would make this assertion pass for
    // the wrong reason (nothing left to swap into, rather than the swap
    // having been correctly ignored). Checking before any microtask has run
    // proves the `currentImage`-mirroring effect — gated on `open`, already
    // `false` for both updates — never had the chance to (and must not)
    // pick up the new list, regardless of exit-transition progress.
    const closePromise = rerender({ images, initialIndex: 0, open: false });
    const swapPromise = rerender({ images: otherImages, initialIndex: 0, open: false });

    // The frozen image must NOT have swapped to the new list's content.
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('Image A');
    expect(container.querySelector('img')?.getAttribute('src')).toBe('/a.jpg');

    await closePromise;
    await swapPromise;

    // Drain the rest of the exit transition — the Modal fully unmounts once
    // it genuinely finishes, same as the other lazy-mount tests above.
    await tick();
    await tick();
    expect(container.querySelector('dialog')).toBeNull();
  });

  test('an initially-open lightbox driven closed before it ever genuinely opens does not leak a permanently-closed Modal (PR #1422 review)', async () => {
    // Regression: an instance constructed with `open: true` seeds
    // `hasOpenedOnce = true` (see that seed's own comment) so an
    // already-open-on-first-render instance is correct from the start. If a
    // consumer flips `open` back to `false` before Modal's OWN
    // `syncOpenState()` effect ever calls `showModal()`, Modal's dialog
    // never genuinely opens — `syncOpenState()`'s "already closed" branch
    // only sets `renderPanel = false`; it never calls `beginClosing()`
    // (which requires the native dialog to already be open), so
    // `#finishClosing()` never runs and `onExitComplete` NEVER fires. With
    // no callback to clear it, `hasOpenedOnce` would stick at `true`
    // forever — the same leak shape as the empty-images and
    // mid-session-clear bugs, triggered by a cancelled FIRST open instead.
    //
    // HONEST LIMITATION: this test does NOT reproduce the exact race that
    // motivates the fix. `@testing-library/svelte`'s `render()`/`rerender()`
    // both call `flushSync()` internally, so this component's own `$effect`
    // (and, transitively, Modal's `syncOpenState()` effect) has already run
    // at least once with `open === true` by the time `render()` returns —
    // `genuineOpenObserved` is already `true` before the subsequent
    // `rerender({ open: false })` ever executes, so the "cancelled before
    // any genuine open" branch this test exercises is not actually the one
    // the fix guards. Confirmed empirically (temporarily disabling the
    // `hasOpenedOnce && !genuineOpenObserved` guard): this test still passes
    // with the guard removed. A raw `mount()` probe (bypassing
    // testing-library, mutating `open` via a getter/setter prop before the
    // first `flushSync()`) *did* reach the guard with `genuineOpenObserved
    // === false` and confirmed the guard clears `hasOpenedOnce` correctly on
    // that very first effect pass — but also surfaced an unrelated
    // scheduling quirk specific to a bare `mount()` root (outside any parent
    // component's effect tree): the resulting `{#if hasOpenedOnce &&
    // sessionImage}` re-render did not converge even after repeated
    // `flushSync()`/`tick()` calls, unlike every other state transition in
    // this file. That quirk makes bare `mount()` an unreliable vehicle for
    // asserting DOM outcomes here, so it is not used as the regression
    // vehicle either. What FOLLOWS is the closest achievable proxy through
    // the public component API: a fast, ordinary cancel-before-open cycle,
    // asserting the Modal cleanly releases and a later open still works.
    // This guards against a plain regression in the ordinary path; the
    // guard clause itself is additionally locked in place below via a
    // source-contract assertion, since the exact interleaving it exists for
    // cannot be deterministically triggered through this synchronous test
    // harness.
    const { container, rerender } = render(ImageLightbox, {
      props: { images, initialIndex: 0, open: true },
    });

    await rerender({ images, initialIndex: 0, open: false });
    await tick();
    await tick();
    await tick();

    // The gate must have cleared — proven by the fact that the Modal never
    // gets stuck mounted-but-closed: a later close-to-open cycle still
    // mounts a genuinely fresh, genuinely open Modal, not a permanently
    // dead one.
    expect(container.querySelector('dialog')).toBeNull();

    await rerender({ images, initialIndex: 0, open: true });
    await tick();
    const dialog = container.querySelector('dialog');
    expect(dialog).not.toBeNull();
    expect(dialog?.hasAttribute('open')).toBe(true);
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('Image A');
  });

  test('source contract: the cancelled-initial-open guard clears hasOpenedOnce via a local genuineOpenObserved flag, not via SlidingDialogState (PR #1422 review)', () => {
    // Locks in the fix at the source level, since the exact race it guards
    // against (seeded `hasOpenedOnce = true`, cancelled before this
    // component's own effect — and Modal's `syncOpenState()` — ever
    // observes a genuine `open === true` pass) cannot be deterministically
    // triggered through `@testing-library/svelte`'s synchronous
    // `render()`/`rerender()` API (see the honest limitation noted in the
    // behavioral test directly above). This at least ensures the guard
    // clause cannot be silently deleted or reworded away without a test
    // failure calling it out.
    expect(source).toContain('let genuineOpenObserved = false;');
    expect(source).toContain('genuineOpenObserved = true;');
    expect(source).toContain('if (hasOpenedOnce && !genuineOpenObserved) {');
    expect(source).toMatch(
      /if \(hasOpenedOnce && !genuineOpenObserved\) \{\s*hasOpenedOnce = false;\s*sessionImage = null;/,
    );
  });
});
