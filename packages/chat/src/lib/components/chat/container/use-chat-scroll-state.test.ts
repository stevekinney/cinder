/**
 * Tests for use-chat-scroll-state.svelte.ts.
 *
 * Focused on the withForcedLayout backstop timing (private helper, exercised
 * through scrollToBottom): a scroll animation that runs LONGER than the
 * backstop duration must never have data-cinder-force-visible restored out
 * from under it mid-flight — that would re-enable content-visibility:auto on
 * off-screen rows before the scroll settles, reproducing the exact jerk the
 * mechanism exists to prevent.
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

describe('useChatScrollState — withForcedLayout backstop', () => {
  test('sets data-cinder-force-visible for the duration of scrollToBottom', () => {
    const state = useChatScrollState();
    const viewport = createViewport();
    state.scrollToBottom(viewport);
    expect(viewport.hasAttribute('data-cinder-force-visible')).toBe(true);
    viewport.dispatchEvent(new Event('scrollend'));
    viewport.remove();
  });

  test('a scrollend event removes data-cinder-force-visible immediately', () => {
    const state = useChatScrollState();
    const viewport = createViewport();
    state.scrollToBottom(viewport);
    viewport.dispatchEvent(new Event('scrollend'));
    expect(viewport.hasAttribute('data-cinder-force-visible')).toBe(false);
    viewport.remove();
  });

  test('repeated scroll ticks past the backstop duration keep it set (no premature restore mid-animation)', () => {
    jest.useFakeTimers();
    const state = useChatScrollState();
    const viewport = createViewport();
    state.scrollToBottom(viewport);

    // Simulate an animation still actively progressing well past the 500ms
    // non-reduced-motion backstop duration: a scroll tick every 90ms for
    // 630ms. Each tick re-arms the backstop before the current arm can fire,
    // so it must never restore the optimization while ticks keep arriving.
    for (let i = 0; i < 7; i++) {
      jest.advanceTimersByTime(90);
      viewport.dispatchEvent(new Event('scroll'));
      expect(viewport.hasAttribute('data-cinder-force-visible')).toBe(true);
    }
  });

  test('once scroll ticks stop arriving, the backstop eventually restores it', () => {
    jest.useFakeTimers();
    const state = useChatScrollState();
    const viewport = createViewport();
    state.scrollToBottom(viewport);
    viewport.dispatchEvent(new Event('scroll'));
    expect(viewport.hasAttribute('data-cinder-force-visible')).toBe(true);

    // No further ticks — the backstop (500ms, non-reduced-motion) should fire.
    jest.advanceTimersByTime(499);
    expect(viewport.hasAttribute('data-cinder-force-visible')).toBe(true);
    jest.advanceTimersByTime(1);
    expect(viewport.hasAttribute('data-cinder-force-visible')).toBe(false);
  });

  test('a zero-distance scroll (already at bottom, no scroll/scrollend events) still restores via the backstop', () => {
    jest.useFakeTimers();
    const state = useChatScrollState();
    const viewport = createViewport();
    state.scrollToBottom(viewport);
    // No events dispatched at all — only the initial backstop arm can save us.
    jest.advanceTimersByTime(499);
    expect(viewport.hasAttribute('data-cinder-force-visible')).toBe(true);
    jest.advanceTimersByTime(1);
    expect(viewport.hasAttribute('data-cinder-force-visible')).toBe(false);
  });

  test('a second scrollToBottom before the first settles cancels the first session (no premature restore from the stale backstop)', () => {
    jest.useFakeTimers();
    // Regression guard: overlapping calls (e.g. a double-click on jump-to-
    // latest, or auto-scroll firing mid-animation) used to leave the OLDER
    // session's listeners/backstop live. When the OLDER session's backstop
    // fired on its own original schedule, it stripped the attribute even
    // though the NEWER session's own (later) backstop hadn't fired yet.
    //
    // No scroll ticks are dispatched here deliberately: re-arming would mask
    // the bug, since (without the fix) a tick re-arms BOTH sessions'
    // listeners identically and neither timer ever gets to fire on its own.
    // This test instead lets each session's timer run to its own deadline
    // untouched, so only the fix (cancelling the older session outright)
    // prevents the stale one from firing.
    const state = useChatScrollState();
    const viewport = createViewport();

    state.scrollToBottom(viewport); // session A: backstop armed for ~500ms from t=0
    jest.advanceTimersByTime(50);
    state.scrollToBottom(viewport); // session B: backstop armed for ~500ms from t=50

    // At t≈520ms: session A's original (500ms) deadline has passed, but
    // session B's (550ms) has not. The attribute must still be present —
    // proving session A's backstop was actually cancelled, not just racing.
    jest.advanceTimersByTime(470);
    expect(viewport.hasAttribute('data-cinder-force-visible')).toBe(true);

    // Session B's own backstop eventually fires and restores it.
    jest.advanceTimersByTime(29);
    expect(viewport.hasAttribute('data-cinder-force-visible')).toBe(true);
    jest.advanceTimersByTime(1);
    expect(viewport.hasAttribute('data-cinder-force-visible')).toBe(false);
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

  test('scrollToBottom supersedes a stale scrollToTop guard instead of leaving it to expire on its own schedule', () => {
    // Regression guard (Codex review on #787): "Clear stale top-scroll guards
    // before bottom jumps" — a bottom-directed jump whose own target already
    // matches the auto-stick effect (so it needs no guard of its own) must
    // still cancel an EARLIER guard from a top-scroll, or that stale guard
    // keeps suppressing auto-stick corrections for messages appended after
    // the user's intent already changed.
    jest.useFakeTimers();
    const state = useChatScrollState();
    const viewport = createViewport();

    state.scrollToTop(viewport);
    expect(state.isUserScrolling).toBe(true);

    state.scrollToBottom(viewport);
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
