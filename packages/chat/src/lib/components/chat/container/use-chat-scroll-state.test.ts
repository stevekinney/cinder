/**
 * Tests for use-chat-scroll-state.svelte.ts.
 *
 * The `withForcedLayout — release ownership (CIN-418, second round)` describe
 * block below is focused on WHO releases `data-cinder-force-visible` and
 * WHEN. Release used to be `withForcedLayout`'s own responsibility, armed on
 * its own `scrollend` listener with a scroll-quiet timeout backstop — that
 * listener had no destination check, so a STALE `scrollend` from an
 * unrelated, still-settling scroll session (e.g. a mount-time auto-scroll
 * whose tail is still in flight when `scrollToTop()` is called immediately
 * after) would strip the attribute a few frames into the real animation,
 * long before it actually finished. Confirmed against real GitHub Actions
 * WebKit: the attribute was observed present immediately after a
 * `scrollToTop()` click in only ~1/6 of runs. Release now belongs solely to
 * the enclosing `withUserScrollGuard` session, which already has correct,
 * destination-aware staleness handling (#1236) — these tests pin that a
 * stale scrollend can no longer strip the attribute, and that the genuine
 * one still does.
 */

/// <reference lib="dom" />
import { afterEach, describe, expect, jest, test } from 'bun:test';

import { setupHappyDom } from '../../../test/happy-dom.ts';

setupHappyDom();

const { useChatScrollState } = await import('./use-chat-scroll-state.svelte.ts');

afterEach(() => {
  if (jest.isFakeTimers()) {
    jest.useRealTimers();
  }
  document.body.innerHTML = '';
});

function createViewport(): HTMLElement {
  const viewport = document.createElement('div');
  Object.defineProperty(viewport, 'scrollHeight', { value: 2000, configurable: true });
  Object.defineProperty(viewport, 'scrollTop', { value: 0, writable: true, configurable: true });
  Object.defineProperty(viewport, 'clientHeight', { value: 400, configurable: true });
  // happy-dom doesn't implement scrollTo's layout side effects; a no-op stub
  // is enough since this suite only cares about the force-visible lifecycle.
  viewport.scrollTo = () => {};
  document.body.appendChild(viewport);
  return viewport;
}

/** A transcript short enough to fit entirely within the viewport — it can never leave the bottom. */
function createShortViewport(): HTMLElement {
  const viewport = document.createElement('div');
  Object.defineProperty(viewport, 'scrollHeight', { value: 200, configurable: true });
  Object.defineProperty(viewport, 'scrollTop', { value: 0, writable: true, configurable: true });
  Object.defineProperty(viewport, 'clientHeight', { value: 400, configurable: true });
  viewport.scrollTo = () => {};
  document.body.appendChild(viewport);
  return viewport;
}

function createIntersectionObserverEntry(
  isIntersecting: boolean,
  target: Element = document.createElement('div'),
): IntersectionObserverEntry {
  const bounds = target.getBoundingClientRect();
  return {
    time: 0,
    target,
    rootBounds: null,
    boundingClientRect: bounds,
    intersectionRect: isIntersecting ? bounds : new DOMRect(),
    isIntersecting,
    intersectionRatio: isIntersecting ? 1 : 0,
  };
}

describe('useChatScrollState — withForcedLayout release ownership (CIN-418, second round)', () => {
  test('sets data-cinder-force-visible synchronously for a scrollToBottom call', () => {
    const state = useChatScrollState();
    const viewport = createViewport();
    state.scrollToBottom(viewport);
    expect(viewport.hasAttribute('data-cinder-force-visible')).toBe(true);
    viewport.remove();
  });

  test('a STALE scrollend (not at the guard destination) does not strip the attribute — the CIN-418 race', () => {
    // Reproduces the mechanism confirmed against real GitHub Actions WebKit:
    // an unrelated scroll session's tail-end scrollend (e.g. a mount-time
    // auto-scroll-to-bottom still settling) arrives while THIS session's
    // forced-layout window is active. Before the fix, withForcedLayout's own
    // `scrollend` listener had no destination check, so it could not tell
    // this apart from its own animation completing and stripped the
    // attribute regardless — measured present in only ~1/6 of real runs.
    const state = useChatScrollState();
    const viewport = createViewport(); // scrollTop 0, scrollHeight 2000, clientHeight 400
    (viewport as { scrollTop: number }).scrollTop = 1600;

    state.scrollToTop(viewport); // destination: 0
    expect(viewport.hasAttribute('data-cinder-force-visible')).toBe(true);

    // Stale scrollend from an unrelated, still-settling session — the
    // viewport hasn't actually moved toward the top yet.
    viewport.dispatchEvent(new Event('scrollend'));
    expect(viewport.hasAttribute('data-cinder-force-visible')).toBe(true);
    expect(state.isUserScrolling).toBe(true);

    // The real animation reaches the top; its OWN scrollend both settles the
    // guard and releases the forced-layout window it was holding.
    (viewport as { scrollTop: number }).scrollTop = 0;
    viewport.dispatchEvent(new Event('scrollend'));
    expect(viewport.hasAttribute('data-cinder-force-visible')).toBe(false);
    expect(state.isUserScrolling).toBe(false);
  });

  test('a genuine scrollend at the destination releases the attribute', () => {
    const state = useChatScrollState();
    const viewport = createViewport();
    state.scrollToBottom(viewport);
    (viewport as { scrollTop: number }).scrollTop = 1600; // scrollHeight(2000) - clientHeight(400)
    viewport.dispatchEvent(new Event('scrollend'));
    expect(viewport.hasAttribute('data-cinder-force-visible')).toBe(false);
  });

  test('the scroll-quiet backstop still releases the attribute when no scrollend ever arrives at the destination', () => {
    // A cancelled or never-completing animation must not leave the
    // attribute (and the content-visibility override it forces) stuck
    // forever. The guard's own scroll-quiet backstop is the fallback here,
    // same as it already is for isUserScrolling — this is the ONE place
    // release still happens off a timer, and it's the guard's timer, not a
    // separate one withForcedLayout arms for itself.
    jest.useFakeTimers();
    const state = useChatScrollState();
    const viewport = createViewport(); // scrollTo is a no-op stub — scrollTop never moves
    state.scrollToBottom(viewport);
    expect(viewport.hasAttribute('data-cinder-force-visible')).toBe(true);

    jest.advanceTimersByTime(499);
    expect(viewport.hasAttribute('data-cinder-force-visible')).toBe(true);
    jest.advanceTimersByTime(1);
    expect(viewport.hasAttribute('data-cinder-force-visible')).toBe(false);
  });

  test('an overlapping scrollToTop supersedes a still-forced scrollToBottom session and keeps the attribute set throughout', () => {
    // The successor session reuses the same forced-layout window rather than
    // tearing it down and reapplying it — the attribute must never flicker
    // off between the two calls, only the successor's own settlement
    // releases it.
    jest.useFakeTimers();
    const state = useChatScrollState();
    const viewport = createViewport();

    state.scrollToBottom(viewport);
    expect(viewport.hasAttribute('data-cinder-force-visible')).toBe(true);

    jest.advanceTimersByTime(50);
    state.scrollToTop(viewport); // supersedes the bottom session; still forced
    expect(viewport.hasAttribute('data-cinder-force-visible')).toBe(true);

    (viewport as { scrollTop: number }).scrollTop = 0;
    viewport.dispatchEvent(new Event('scrollend'));
    expect(viewport.hasAttribute('data-cinder-force-visible')).toBe(false);
  });

  test('destroy releases an in-flight forced-layout window', () => {
    const state = useChatScrollState();
    const viewport = createViewport();
    state.scrollToBottom(viewport);
    expect(viewport.hasAttribute('data-cinder-force-visible')).toBe(true);
    state.destroy();
    expect(viewport.hasAttribute('data-cinder-force-visible')).toBe(false);
  });

  test('clearUserScrollGuard releases an in-flight forced-layout window', () => {
    const state = useChatScrollState();
    const viewport = createViewport();
    state.scrollToTop(viewport);
    expect(viewport.hasAttribute('data-cinder-force-visible')).toBe(true);
    state.clearUserScrollGuard();
    expect(viewport.hasAttribute('data-cinder-force-visible')).toBe(false);
  });

  test('finishUserScrollGuard reads the destination against forced (real) geometry, then releases the attribute', () => {
    // Regression guard: releasing the forced-layout window BEFORE reading
    // the declared destination would snap scrollHeight back to the
    // content-visibility estimate and make a bottom-directed destination()
    // read short.
    const state = useChatScrollState();
    const viewport = document.createElement('div');
    Object.defineProperty(viewport, 'scrollTop', {
      value: 0,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(viewport, 'clientHeight', { value: 400, configurable: true });
    Object.defineProperty(viewport, 'scrollHeight', {
      configurable: true,
      get() {
        // Only the real (forced) height while the attribute is set — the
        // content-visibility estimate otherwise.
        return viewport.hasAttribute('data-cinder-force-visible') ? 2000 : 350;
      },
    });
    const scrollCalls: number[] = [];
    viewport.scrollTo = ((options?: ScrollToOptions | number) => {
      const top = typeof options === 'number' ? options : (options?.top ?? 0);
      scrollCalls.push(top);
      (viewport as { scrollTop: number }).scrollTop = top;
    }) as typeof viewport.scrollTo;
    document.body.appendChild(viewport);

    state.jumpToLatest(viewport);
    expect(scrollCalls).toEqual([2000]);

    state.finishUserScrollGuard();
    expect(scrollCalls.at(-1)).toBe(2000);
    expect(viewport.hasAttribute('data-cinder-force-visible')).toBe(false);

    viewport.remove();
  });
});

describe('useChatScrollState — isUserScrolling guard (regression for #774)', () => {
  // #774: the exported `scrollToTop()` (chat.svelte) called
  // `chatVirtualizer.scrollToOffset(0, ...)` directly instead of going through
  // a guard that sets `isUserScrolling`, unlike `jumpToLatest`. The
  // auto-stick-to-bottom `$effect.pre` in chat.svelte skips its correction
  // whenever `isUserScrolling` is true, so any programmatic scroll that
  // doesn't set it gets fought by that effect on every virtualizer
  // remeasurement. These tests pin the guard contract directly.

  test('scrollToTop sets isUserScrolling for the duration of the scroll, then clears it', () => {
    jest.useFakeTimers();
    const state = useChatScrollState();
    const viewport = createViewport();

    expect(state.isUserScrolling).toBe(false);
    state.scrollToTop(viewport);
    expect(state.isUserScrolling).toBe(true);

    jest.advanceTimersByTime(499);
    expect(state.isUserScrolling).toBe(true);
    jest.advanceTimersByTime(1);
    expect(state.isUserScrolling).toBe(false);
  });

  test('withUserScrollGuard sets isUserScrolling around an arbitrary scroll action (the virtualized scrollToOffset path)', () => {
    jest.useFakeTimers();
    const state = useChatScrollState();
    let called = false;

    expect(state.isUserScrolling).toBe(false);
    state.withUserScrollGuard(null, () => {
      // Runs synchronously inside the guard, mirroring
      // `chatVirtualizer.scrollToOffset(0, ...)` in chat.svelte.
      called = true;
      expect(state.isUserScrolling).toBe(true);
    });
    expect(called).toBe(true);
    expect(state.isUserScrolling).toBe(true);

    jest.advanceTimersByTime(500);
    expect(state.isUserScrolling).toBe(false);
  });

  test('withUserScrollGuard uses the shorter reduced-motion duration when the user prefers reduced motion', () => {
    jest.useFakeTimers();
    const originalMatchMedia = window.matchMedia;
    // Stub matchMedia so `prefers-reduced-motion: reduce` reports as active —
    // happy-dom's real matchMedia always reports `matches: false`, which is
    // why this branch needs an explicit stub rather than relying on the
    // environment default (used by the 500ms test above).
    window.matchMedia = ((query: string) =>
      ({
        matches: query.includes('prefers-reduced-motion'),
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        // Legacy MediaQueryList API — included alongside the modern
        // addEventListener/removeEventListener pair in case the Svelte
        // MediaQuery build in use prefers it.
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => true,
      }) as unknown as MediaQueryList) as typeof window.matchMedia;

    try {
      const state = useChatScrollState();
      state.withUserScrollGuard(null, () => {});
      expect(state.isUserScrolling).toBe(true);

      jest.advanceTimersByTime(49);
      expect(state.isUserScrolling).toBe(true);
      jest.advanceTimersByTime(1);
      expect(state.isUserScrolling).toBe(false);
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  test('isUserScrolling never gets stuck true across repeated guarded scrolls', () => {
    jest.useFakeTimers();
    const state = useChatScrollState();
    const viewport = createViewport();

    state.scrollToTop(viewport);
    jest.advanceTimersByTime(500);
    expect(state.isUserScrolling).toBe(false);

    // A second, independent guarded scroll must also resolve back to false —
    // proving the flag resets on its own timer rather than requiring some
    // other code path to clear it.
    state.withUserScrollGuard(viewport, () => {});
    expect(state.isUserScrolling).toBe(true);
    jest.advanceTimersByTime(500);
    expect(state.isUserScrolling).toBe(false);
  });

  test('a second overlapping guarded scroll cancels the first, so the first timer cannot clear isUserScrolling early', () => {
    // Regression guard: two guarded scrolls close together (e.g. two quick
    // Home presses, or scrollToTop() called twice) used to leave the OLDER
    // session's timer live. When it fired on its own (earlier) schedule, it
    // flipped isUserScrolling back to false while the NEWER scroll's
    // animation was still in progress — reintroducing the auto-stick-to-
    // bottom race this guard exists to prevent.
    jest.useFakeTimers();
    const state = useChatScrollState();

    state.withUserScrollGuard(null, () => {}); // session A: backstop armed for ~500ms from t=0
    jest.advanceTimersByTime(50);
    state.withUserScrollGuard(null, () => {}); // session B: backstop armed for ~500ms from t=50

    // At t≈520ms: session A's original (500ms) deadline has passed, but
    // session B's (550ms) has not. isUserScrolling must still be true —
    // proving session A's timer was actually cancelled, not just racing.
    jest.advanceTimersByTime(470);
    expect(state.isUserScrolling).toBe(true);

    // Session B's own timer eventually fires and clears it.
    jest.advanceTimersByTime(29);
    expect(state.isUserScrolling).toBe(true);
    jest.advanceTimersByTime(1);
    expect(state.isUserScrolling).toBe(false);
  });

  test('jumpToLatest and scrollToTop share the same cancellable guard, so one cannot clear isUserScrolling out from under the other', () => {
    // Regression guard (Codex review on #787): jumpToLatest used to run its
    // own independent isUserScrolling timer, uncoordinated with
    // withUserScrollGuard's cancellation. A jumpToLatest() immediately
    // followed by scrollToTop() (e.g. a fast double-tap) would let
    // jumpToLatest's OLDER, uncancelled timer clear isUserScrolling while
    // scrollToTop's animation was still running, letting the auto-stick
    // effect re-engage mid-scroll.
    jest.useFakeTimers();
    const state = useChatScrollState();
    const viewport = createViewport();

    state.jumpToLatest(viewport); // session A: timer armed for ~500ms from t=0
    jest.advanceTimersByTime(50);
    state.scrollToTop(viewport); // session B: timer armed for ~500ms from t=50

    // At t≈520ms: session A's original (500ms) deadline has passed, but
    // session B's (550ms) has not. isUserScrolling must still be true.
    jest.advanceTimersByTime(470);
    expect(state.isUserScrolling).toBe(true);

    jest.advanceTimersByTime(30);
    expect(state.isUserScrolling).toBe(false);
  });

  test('scrollToTop sets atBottom to false synchronously, before the real scroll listener would recompute it', () => {
    // Regression guard (Codex review on #787): a message that arrives in the
    // same tick as a guarded scrollToTop() used to read a stale
    // `atBottom: true` (only the async, rAF-deferred scroll listener updated
    // it), so the unread indicator could silently skip a message that
    // arrived while the viewport had already left the bottom.
    const state = useChatScrollState();
    const viewport = createViewport();

    expect(state.atBottom).toBe(true);
    state.scrollToTop(viewport);
    expect(state.atBottom).toBe(false);
  });

  test('sentinel observations are coalesced until a programmatic scroll settles', () => {
    jest.useFakeTimers();
    let reachedBottom = 0;
    const state = useChatScrollState({
      onReachBottom: () => {
        reachedBottom += 1;
      },
    });
    const viewport = createViewport();
    const visibleSentinelEntry = createIntersectionObserverEntry(true);
    const hiddenSentinelEntry = createIntersectionObserverEntry(false);

    state.scrollToTop(viewport);
    expect(state.atBottom).toBe(false);
    expect(state.isUserScrolling).toBe(true);

    // IntersectionObserver can deliver an entry queued while the bottom
    // sentinel was still visible, before the smooth scroll moved it away.
    state.handleSentinelEntry(visibleSentinelEntry);

    expect(state.atBottom).toBe(false);
    expect(reachedBottom).toBe(0);

    // The sentinel then leaves the viewport as the scroll progresses. Its
    // latest observation must replace the stale visible one.
    state.handleSentinelEntry(hiddenSentinelEntry);
    jest.advanceTimersByTime(500);
    expect(state.atBottom).toBe(false);
    expect(reachedBottom).toBe(0);
  });

  test('a scroll lasting longer than the backstop cannot replay stale sentinel state mid-animation', () => {
    jest.useFakeTimers();
    let reachedBottom = 0;
    const state = useChatScrollState({
      onReachBottom: () => {
        reachedBottom += 1;
      },
    });
    const viewport = createViewport();

    state.setAtBottom(false);
    state.withUserScrollGuard(viewport, () => {});
    state.handleSentinelEntry(createIntersectionObserverEntry(true));

    // Keep the animation active well beyond the original fixed 500ms guard.
    // Every real scroll tick must re-arm settlement instead of letting the
    // initial visible observation replay on its original wall-clock deadline.
    for (let index = 0; index < 3; index += 1) {
      jest.advanceTimersByTime(400);
      viewport.dispatchEvent(new Event('scroll'));
      expect(state.isUserScrolling).toBe(true);
      expect(state.atBottom).toBe(false);
      expect(reachedBottom).toBe(0);
    }

    // The final observer state is hidden. It owns the transition only after
    // the viewport has actually stopped producing scroll events.
    state.handleSentinelEntry(createIntersectionObserverEntry(false));
    jest.advanceTimersByTime(499);
    expect(state.isUserScrolling).toBe(true);
    expect(state.atBottom).toBe(false);
    jest.advanceTimersByTime(1);
    expect(state.isUserScrolling).toBe(false);
    expect(state.atBottom).toBe(false);
    expect(reachedBottom).toBe(0);
  });

  test('scrollend rechecks sentinel geometry before a delayed final observer entry arrives', () => {
    jest.useFakeTimers();
    let reachedBottom = 0;
    const state = useChatScrollState({
      onReachBottom: () => {
        reachedBottom += 1;
      },
    });
    const viewport = createViewport();
    const sentinel = document.createElement('div');
    viewport.appendChild(sentinel);
    viewport.getBoundingClientRect = () =>
      ({
        top: 0,
        right: 400,
        bottom: 400,
        left: 0,
        width: 400,
        height: 400,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;
    let sentinelTop = 350;
    sentinel.getBoundingClientRect = () =>
      ({
        top: sentinelTop,
        right: 400,
        bottom: sentinelTop + 1,
        left: 0,
        width: 400,
        height: 1,
        x: 0,
        y: sentinelTop,
        toJSON: () => ({}),
      }) as DOMRect;

    state.setAtBottom(false);
    state.withUserScrollGuard(viewport, () => {});
    state.handleSentinelEntry(createIntersectionObserverEntry(true, sentinel));

    // The scroll finishes with the sentinel outside the viewport, but
    // scrollend wins the event-loop race against IntersectionObserver's final
    // hidden notification. Settlement must inspect current geometry instead
    // of replaying the queued visible snapshot.
    sentinelTop = 1_000;
    viewport.dispatchEvent(new Event('scrollend'));
    expect(state.isUserScrolling).toBe(false);
    expect(state.atBottom).toBe(false);
    expect(reachedBottom).toBe(0);

    state.handleSentinelEntry(createIntersectionObserverEntry(false, sentinel));
    expect(state.atBottom).toBe(false);
    expect(reachedBottom).toBe(0);
  });

  test('a sentinel that remains visible during the guard is applied once the scroll settles', () => {
    jest.useFakeTimers();
    let reachedBottom = 0;
    const state = useChatScrollState({
      onReachBottom: () => {
        reachedBottom += 1;
      },
    });
    const viewport = createViewport();

    state.setAtBottom(false);
    state.withUserScrollGuard(viewport, () => {});
    state.handleSentinelEntry(createIntersectionObserverEntry(true));

    expect(state.atBottom).toBe(false);
    expect(reachedBottom).toBe(0);

    // IntersectionObserver does not repeat an unchanged intersection after
    // the guard expires, so the coalesced latest entry must be applied here.
    jest.advanceTimersByTime(500);
    expect(state.atBottom).toBe(true);
    expect(reachedBottom).toBe(1);
  });

  test('a stale scrollend away from the settle target does not settle the guard (regression for #1236)', () => {
    // In a real browser, a transcript pinned at the bottom routinely has an
    // auto-stick instant correction's scroll/scrollend pair still in flight
    // when scrollToTop() arms its guard. That scrollend fires with the
    // viewport still at the bottom — nowhere near the guard's target (0) —
    // and used to settle the guard milliseconds into the animation, letting
    // the auto-stick effect re-pin the viewport on the next remeasurement.
    jest.useFakeTimers();
    const state = useChatScrollState();
    const viewport = createViewport();
    (viewport as { scrollTop: number }).scrollTop = 1600;

    state.scrollToTop(viewport);
    expect(state.isUserScrolling).toBe(true);

    // Stale scrollend from the earlier bottom correction: viewport still at
    // the bottom. Must NOT settle the guard.
    viewport.dispatchEvent(new Event('scrollend'));
    expect(state.isUserScrolling).toBe(true);

    // The animation reaches the top; ITS scrollend settles the guard.
    (viewport as { scrollTop: number }).scrollTop = 0;
    viewport.dispatchEvent(new Event('scrollend'));
    expect(state.isUserScrolling).toBe(false);
  });

  test('jumpToLatest retargets when appended content grows the bottom during smooth scrolling', () => {
    jest.useFakeTimers();
    const state = useChatScrollState();
    const viewport = createViewport();
    const scrollCalls: number[] = [];
    viewport.scrollTo = ((options?: ScrollToOptions | number) => {
      scrollCalls.push(typeof options === 'number' ? options : (options?.top ?? 0));
    }) as typeof viewport.scrollTo;

    state.jumpToLatest(viewport);
    expect(scrollCalls).toEqual([2000]);

    // The browser's smooth-scroll target was clamped to the old bottom.
    // Appending a message grows the scroll extent before that animation ends.
    Object.defineProperty(viewport, 'scrollHeight', { configurable: true, value: 2200 });
    (viewport as { scrollTop: number }).scrollTop = 1600;
    viewport.dispatchEvent(new Event('scrollend'));

    // The old target is stale; the guard must retarget instead of settling
    // above the newly appended latest message.
    expect(state.isUserScrolling).toBe(true);
    expect(scrollCalls).toEqual([2000, 2200]);

    (viewport as { scrollTop: number }).scrollTop = 1800;
    viewport.dispatchEvent(new Event('scrollend'));
    expect(state.isUserScrolling).toBe(false);
  });

  test('jumpToLatest does not re-issue scroll when the bottom target is unchanged', () => {
    jest.useFakeTimers();
    const state = useChatScrollState();
    const viewport = createViewport();
    const scrollCalls: number[] = [];
    viewport.scrollTo = ((options?: ScrollToOptions | number) => {
      scrollCalls.push(typeof options === 'number' ? options : (options?.top ?? 0));
    }) as typeof viewport.scrollTo;

    state.jumpToLatest(viewport);
    expect(scrollCalls).toEqual([2000]);

    // The bottom has not grown; this mismatch can represent an animation
    // cancelled by user input. Keep the guard armed, but do not force a new
    // downward scroll in the non-virtualized path.
    (viewport as { scrollTop: number }).scrollTop = 1200;
    viewport.dispatchEvent(new Event('scrollend'));

    expect(state.isUserScrolling).toBe(true);
    expect(scrollCalls).toEqual([2000]);

    jest.advanceTimersByTime(500);
    expect(state.isUserScrolling).toBe(false);
  });

  test('a guard whose target is never reached still settles via the scroll-quiet backstop', () => {
    jest.useFakeTimers();
    const state = useChatScrollState();
    const viewport = createViewport();
    (viewport as { scrollTop: number }).scrollTop = 1600;

    state.scrollToTop(viewport);
    // A stale scrollend re-arms the backstop rather than settling.
    viewport.dispatchEvent(new Event('scrollend'));
    expect(state.isUserScrolling).toBe(true);

    // The animation is cancelled (e.g. by user input) and no further events
    // arrive: the backstop must still clear the guard.
    jest.advanceTimersByTime(499);
    expect(state.isUserScrolling).toBe(true);
    jest.advanceTimersByTime(1);
    expect(state.isUserScrolling).toBe(false);
  });

  test('settlement recomputes atBottom from final geometry instead of trusting a stale mid-animation value', () => {
    // The scroll listener's recompute is rAF-deferred, so `atBottom` can
    // still describe a transient near-bottom position at the instant a
    // guarded scroll-to-top settles. Settlement must re-derive it from the
    // live geometry so a remeasurement landing right after cannot re-engage
    // the auto-stick effect against stale state (#1236).
    jest.useFakeTimers();
    const state = useChatScrollState();
    const viewport = createViewport();
    (viewport as { scrollTop: number }).scrollTop = 1600;

    state.scrollToTop(viewport);
    expect(state.atBottom).toBe(false);
    // A stale scroll event's recompute flips atBottom back to true while the
    // animation is in flight (simulated directly — the real recompute is
    // rAF-deferred).
    state.setAtBottom(true);

    // The animation reaches the top and settles: atBottom must reflect the
    // final position (1600px away from the bottom), not the stale flip.
    (viewport as { scrollTop: number }).scrollTop = 0;
    viewport.dispatchEvent(new Event('scrollend'));
    expect(state.isUserScrolling).toBe(false);
    expect(state.atBottom).toBe(false);
  });

  test('settlement recomputes showJumpButton with the final geometry', async () => {
    const state = useChatScrollState();
    const viewport = createViewport();
    const detach = state.createScrollAttachment()(viewport);
    (viewport as { scrollTop: number }).scrollTop = 1600;

    state.scrollToTop(viewport);
    // A stale scroll tick from the previous bottom correction is processed
    // while the smooth scroll is still at the bottom. Its deferred rAF leaves
    // showJumpButton false even though the eventual top position must show it.
    viewport.dispatchEvent(new Event('scroll'));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    (viewport as { scrollTop: number }).scrollTop = 0;
    viewport.dispatchEvent(new Event('scrollend'));

    expect(state.atBottom).toBe(false);
    expect(state.showJumpButton).toBe(true);
    detach?.();
  });

  test('settlement emits one final scroll state change for bindable consumers', () => {
    const stateChanges: Array<{ atBottom: boolean; scrollTop: number; scrollHeight: number }> = [];
    const state = useChatScrollState({
      onScrollStateChange: (event) => stateChanges.push(event),
    });
    const viewport = createViewport();
    (viewport as { scrollTop: number }).scrollTop = 1600;

    state.scrollToTop(viewport);
    (viewport as { scrollTop: number }).scrollTop = 0;
    viewport.dispatchEvent(new Event('scrollend'));

    expect(stateChanges).toEqual([{ atBottom: false, scrollTop: 0, scrollHeight: 2000 }]);
  });

  test('scrollToTop preserves atBottom when the viewport cannot actually leave the bottom', () => {
    // Regression guard (Codex review on #787): a transcript short enough to
    // fit entirely within the viewport (scrollHeight <= clientHeight) is
    // always "at the bottom" by definition — scrollTo({ top: 0 }) is a no-op
    // there. Unconditionally flipping atBottom would desync it from the real
    // (unchanged) scroll position, and a message appended right after would
    // be wrongly marked unread.
    const state = useChatScrollState();
    const viewport = createShortViewport();

    expect(state.atBottom).toBe(true);
    state.scrollToTop(viewport);
    expect(state.atBottom).toBe(true);
  });

  test('withUserScrollGuard arms its cleanup timer after action() completes, not before', () => {
    // Regression guard (Codex review on #787): jumpToLatest's action includes
    // a synchronous forced-layout pass that reflows every row before issuing
    // the smooth scroll — on a large transcript that can consume a real slice
    // of wall-clock time. Arming the cleanup timer BEFORE action() runs would
    // start that clock too early, letting the guard expire mid-animation.
    jest.useFakeTimers();
    const state = useChatScrollState();
    let clearedDuringAction = false;

    state.withUserScrollGuard(null, () => {
      // Simulate action() itself consuming the guard's entire duration. If
      // the timer had been armed before action() ran, this would fire it
      // while still inside action() — proving the bug.
      jest.advanceTimersByTime(500);
      clearedDuringAction = !state.isUserScrolling;
    });

    expect(clearedDuringAction).toBe(false);
    expect(state.isUserScrolling).toBe(true);

    // The timer only starts counting once action() returns.
    jest.advanceTimersByTime(500);
    expect(state.isUserScrolling).toBe(false);
  });

  test('clearUserScrollGuard immediately clears isUserScrolling and cancels the pending timer', () => {
    jest.useFakeTimers();
    const state = useChatScrollState();
    const viewport = createViewport();

    state.scrollToTop(viewport);
    expect(state.isUserScrolling).toBe(true);

    state.clearUserScrollGuard();
    expect(state.isUserScrolling).toBe(false);

    // The original timer must be genuinely cancelled — advancing past its
    // deadline must not throw or do anything surprising.
    expect(() => jest.advanceTimersByTime(600)).not.toThrow();
    expect(state.isUserScrolling).toBe(false);
  });

  test('scrollToBottom supersedes a stale scrollToTop guard with its own, rather than leaving the old one to expire on its own schedule', () => {
    // Regression guard (Codex review on #787), updated for CIN-418: a
    // bottom-directed scroll must still cancel an EARLIER guard from a
    // top-scroll, or that stale guard's own timer could clear
    // `isUserScrolling` out from under the new scrollToBottom animation.
    // Before CIN-418, scrollToBottom wasn't guarded at all, so superseding
    // meant clearing to no-guard; scrollToBottom is now itself guarded (so
    // it gets the same scrollend-driven final recompute scrollToTop/
    // jumpToLatest already had), so superseding now means its OWN guard
    // replaces the stale one — proven the same way the other overlapping-
    // guard regressions in this file are: the OLDER session's original
    // timer must not fire on its own schedule.
    jest.useFakeTimers();
    const state = useChatScrollState();
    const viewport = createViewport();

    state.scrollToTop(viewport); // session A: backstop armed for ~500ms from t=0
    expect(state.isUserScrolling).toBe(true);

    jest.advanceTimersByTime(50);
    state.scrollToBottom(viewport); // session B: backstop armed for ~500ms from t=50
    expect(state.isUserScrolling).toBe(true);

    // At t≈520ms: session A's original (500ms) deadline has passed, but
    // session B's (550ms) has not. isUserScrolling must still be true —
    // proving session A's timer was actually cancelled, not just racing.
    jest.advanceTimersByTime(470);
    expect(state.isUserScrolling).toBe(true);

    // Session B's own timer eventually settles it.
    jest.advanceTimersByTime(30);
    expect(state.isUserScrolling).toBe(false);
  });

  test('destroy cancels an in-flight user-scroll-guard timer so it cannot fire after teardown', () => {
    jest.useFakeTimers();
    const state = useChatScrollState();
    const viewport = createViewport();

    state.scrollToTop(viewport);
    expect(state.isUserScrolling).toBe(true);

    state.destroy();
    expect(state.isUserScrolling).toBe(false);

    // The original timer must not resurrect isUserScrolling once its
    // original deadline passes.
    jest.advanceTimersByTime(600);
    expect(state.isUserScrolling).toBe(false);
  });

  test('destroy cancels an in-flight withForcedLayout session without throwing when its backstop would have fired', () => {
    jest.useFakeTimers();
    const state = useChatScrollState();
    const viewport = createViewport();

    state.scrollToBottom(viewport);
    expect(viewport.hasAttribute('data-cinder-force-visible')).toBe(true);

    state.destroy();

    // The cancelled backstop must not fire (or throw) once its original
    // deadline passes.
    expect(() => jest.advanceTimersByTime(600)).not.toThrow();
  });
});

describe('useChatScrollState — finishUserScrollGuard (regression for #1237)', () => {
  // #1237: a load-earlier click while a smooth scroll-to-top glide was still
  // animating used to capture a mid-flight scroll snapshot, and the glide's
  // animation (absolute target 0) then raced the instant history-restore
  // corrections — whichever landed last won. finishUserScrollGuard lets the
  // capture path complete the guarded scroll instantly at its declared
  // destination first, so there is nothing left to race.

  function createTrackingViewport(): {
    viewport: HTMLElement;
    scrollCalls: { top: number; behavior: ScrollBehavior | undefined }[];
  } {
    const viewport = document.createElement('div');
    Object.defineProperty(viewport, 'scrollHeight', { value: 2000, configurable: true });
    Object.defineProperty(viewport, 'scrollTop', { value: 0, writable: true, configurable: true });
    Object.defineProperty(viewport, 'clientHeight', { value: 400, configurable: true });
    const scrollCalls: { top: number; behavior: ScrollBehavior | undefined }[] = [];
    viewport.scrollTo = ((options?: ScrollToOptions | number, y?: number) => {
      const top =
        typeof options === 'number' ? (typeof y === 'number' ? y : options) : (options?.top ?? 0);
      scrollCalls.push({
        top,
        behavior: typeof options === 'object' ? options?.behavior : undefined,
      });
      (viewport as { scrollTop: number }).scrollTop = top;
    }) as typeof viewport.scrollTo;
    document.body.appendChild(viewport);
    return { viewport, scrollCalls };
  }

  test('finishing a scrollToTop guard lands the viewport at the top instantly and clears the guard', () => {
    jest.useFakeTimers();
    const state = useChatScrollState();
    const { viewport, scrollCalls } = createTrackingViewport();
    (viewport as unknown as { scrollTop: number }).scrollTop = 1200;

    state.scrollToTop(viewport);
    expect(state.isUserScrolling).toBe(true);
    // Mimic the glide being partway to the top when history is requested.
    (viewport as unknown as { scrollTop: number }).scrollTop = 700;

    expect(state.finishUserScrollGuard()).toBe(true);
    expect(state.isUserScrolling).toBe(false);
    const finishingCall = scrollCalls.at(-1);
    expect(finishingCall?.top).toBe(0);
    expect(finishingCall?.behavior).toBe('instant');
    expect(viewport.scrollTop).toBe(0);
  });

  test('finishing a jumpToLatest guard lands the viewport at the bottom', () => {
    jest.useFakeTimers();
    const state = useChatScrollState();
    const { viewport, scrollCalls } = createTrackingViewport();

    state.jumpToLatest(viewport);
    expect(state.isUserScrolling).toBe(true);

    expect(state.finishUserScrollGuard()).toBe(true);
    expect(state.isUserScrolling).toBe(false);
    const finishingCall = scrollCalls.at(-1);
    expect(finishingCall?.top).toBe(2000);
    expect(finishingCall?.behavior).toBe('instant');
  });

  test('finishing a guard with no declared destination pins the current position (still aborting the animation)', () => {
    jest.useFakeTimers();
    const state = useChatScrollState();
    const { viewport, scrollCalls } = createTrackingViewport();
    (viewport as unknown as { scrollTop: number }).scrollTop = 640;

    state.withUserScrollGuard(viewport, () => {});
    expect(state.isUserScrolling).toBe(true);

    expect(state.finishUserScrollGuard()).toBe(true);
    expect(state.isUserScrolling).toBe(false);
    const finishingCall = scrollCalls.at(-1);
    expect(finishingCall?.top).toBe(640);
    expect(finishingCall?.behavior).toBe('instant');
  });

  test('finishing with no active guard is a no-op that reports false', () => {
    jest.useFakeTimers();
    const state = useChatScrollState();
    const { scrollCalls } = createTrackingViewport();

    expect(state.finishUserScrollGuard()).toBe(false);
    expect(scrollCalls).toHaveLength(0);
  });

  test('a finished guard leaves no timer behind that could resurrect isUserScrolling', () => {
    jest.useFakeTimers();
    const state = useChatScrollState();
    const { viewport } = createTrackingViewport();

    state.scrollToTop(viewport);
    state.finishUserScrollGuard();
    expect(state.isUserScrolling).toBe(false);

    expect(() => jest.advanceTimersByTime(600)).not.toThrow();
    expect(state.isUserScrolling).toBe(false);
  });
});

describe('useChatScrollState — content-visibility churn during scroll-to-top/bottom (CIN-418)', () => {
  // CIN-418: off-screen `.chat-message` rows use `content-visibility: auto`
  // with a `contain-intrinsic-size` estimate. When a scroll-to-top/bottom
  // animation runs long enough (CI CPU pressure), rows scrolled past
  // re-collapse to the estimate and rows newly in view expand to real height,
  // shifting `scrollHeight` by hundreds of px mid-flight. Two asymmetries in
  // the settle logic let that churn leave `atBottom` wrong at the end:
  //
  // 1. `scrollToBottom()` never went through `withUserScrollGuard`, so it had
  //    no `scrollend`-driven final `recomputeFromViewport` — only the
  //    passive, rAF-batched `scroll` listener, which can lag/coalesce under
  //    load and never fire again after the last geometry change.
  // 2. `scrollToTop()` went through the guard but never forced layout, so a
  //    `scrollend` arriving while bottom rows are transiently collapsed
  //    (content-visibility churn, not a genuinely short transcript) reads a
  //    collapsed `scrollHeight <= clientHeight` and `isAtBottom` reports
  //    "fits in viewport" — true — even though the real, expanded transcript
  //    does not fit and the viewport is actually at the top.

  test('scrollToBottom recomputes atBottom from final geometry after scrollend, not only from the passive scroll listener (regression for CIN-418)', () => {
    // Reproduces the scrollToBottom side of CIN-418 deterministically: the
    // animation's own scrollend is the last recompute opportunity if the
    // final passive `scroll` tick doesn't survive rAF batching before it —
    // exactly the CI-CPU-pressure scenario the diagnostic run observed
    // (4/5 flakes were scrollToBottom, atBottom stuck false).
    const state = useChatScrollState();
    const viewport = createViewport(); // scrollTop 0, scrollHeight 2000, clientHeight 400
    state.setAtBottom(false);

    state.scrollToBottom(viewport);

    // The animation actually reaches the bottom, but — simulating a
    // coalesced/lagged passive scroll listener — no further 'scroll' event
    // fires before 'scrollend'. Only a scrollend-driven recompute can catch
    // this.
    (viewport as { scrollTop: number }).scrollTop = 1600; // scrollHeight(2000) - clientHeight(400)
    viewport.dispatchEvent(new Event('scrollend'));

    expect(state.atBottom).toBe(true);
  });

  test('scrollToTop is unaffected by transient content-visibility collapse of bottom rows during the animation (regression for CIN-418)', () => {
    // Reproduces the scrollToTop side of CIN-418: bottom rows collapse to
    // their content-visibility estimate mid-scroll (scrollHeight briefly
    // reads smaller than clientHeight — indistinguishable from a genuinely
    // short transcript to `isAtBottom` unless layout is forced for the
    // animation's duration, the same treatment scrollToBottom/jumpToLatest
    // already get).
    const state = useChatScrollState();
    const viewport = document.createElement('div');
    let churnCollapsed = false;
    Object.defineProperty(viewport, 'scrollHeight', {
      configurable: true,
      get() {
        // While layout is forced (data-cinder-force-visible set), every row
        // is held at real height regardless of content-visibility churn —
        // that's the mechanism under test. Only when the attribute is absent
        // can a transient collapse be observed.
        if (viewport.hasAttribute('data-cinder-force-visible')) return 2000;
        return churnCollapsed ? 350 : 2000;
      },
    });
    Object.defineProperty(viewport, 'scrollTop', {
      value: 1600,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(viewport, 'clientHeight', { value: 400, configurable: true });
    viewport.scrollTo = () => {};
    document.body.appendChild(viewport);

    state.scrollToTop(viewport);
    expect(state.atBottom).toBe(false);

    // Mid-animation content-visibility churn collapses the (now off-screen)
    // bottom rows just as the animation reaches the top.
    churnCollapsed = true;
    (viewport as { scrollTop: number }).scrollTop = 0;
    viewport.dispatchEvent(new Event('scrollend'));

    // The transcript never actually got shorter than the viewport — this
    // must not read as "fits in viewport, therefore at bottom".
    expect(state.atBottom).toBe(false);

    viewport.remove();
  });
});
