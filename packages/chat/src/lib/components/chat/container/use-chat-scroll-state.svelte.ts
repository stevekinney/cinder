/**
 * Runes helper for chat scroll state management.
 *
 * Manages:
 * - atBottom state for auto-scroll decisions
 * - showJumpButton state for jump-to-latest visibility
 * - Scroll event listener attachment
 * - IntersectionObserver for bottom sentinel
 * - Imperative scroll methods
 */

import type { Attachment } from 'svelte/attachments';
import { useReducedMotion } from '../../../utilities/use-reduced-motion.svelte.ts';
import type { ChatScrollStateChangeEvent } from './chat-events.ts';
import {
  isAtBottom as checkIsAtBottom,
  DEFAULT_SCROLL_CONFIGURATION,
  shouldShowJumpToLatest,
} from './scroll-utilities.ts';

// ==========================================================================
// Types
// ==========================================================================

// Re-export the event type from chat.svelte for API consistency
export type { ChatScrollStateChangeEvent as ScrollStateChangeEvent } from './chat-events.ts';

/** Options for the scroll state helper */
export interface UseChatScrollStateOptions {
  /** Pixels from bottom to consider "at bottom" (default: 150) */
  bottomThreshold?: number;
  /** Getter for bottom threshold to avoid stale local references */
  getBottomThreshold?: () => number;
  /** Pixels scrolled before showing jump button (default: 200) */
  jumpThreshold?: number;
  /** Getter for jump threshold to avoid stale local references */
  getJumpThreshold?: () => number;
  /**
   * Callback when scroll state changes.
   *
   * **Important:** Always read values from the event argument, not from bindings.
   * The callback fires before bindable props are synchronized, so bindings may
   * contain stale values during the callback.
   */
  onScrollStateChange?: (event: ChatScrollStateChangeEvent) => void;
  /** Callback when scroll reaches bottom (for clearing unread state) */
  onReachBottom?: () => void;
}

/** Return type for the scroll state helper */
export interface UseChatScrollStateReturn {
  /** Whether the viewport is at or near the bottom */
  readonly atBottom: boolean;
  /** Whether the jump-to-latest button should be visible */
  readonly showJumpButton: boolean;
  /** Whether user is in a smooth scroll animation (used by parent for auto-scroll logic) */
  readonly isUserScrolling: boolean;
  /** Set atBottom state directly */
  setAtBottom(value: boolean): void;
  /** Recompute bottom and jump-button state from the viewport's current geometry. */
  recomputeFromViewport(viewport: HTMLElement | null): void;
  /** Create a scroll event listener attachment for the viewport */
  createScrollAttachment(): Attachment<HTMLElement>;
  /**
   * Create an IntersectionObserver for the bottom sentinel.
   * Returns a cleanup function, or undefined if elements are missing.
   */
  createSentinelObserver(
    viewport: HTMLElement | null,
    sentinel: HTMLElement | null,
  ): (() => void) | undefined;
  /**
   * IntersectionObserver callback for the bottom sentinel element.
   * Use with useIntersection for attachment-based wiring:
   * `{@attach useIntersection(scrollState.handleSentinelEntry, { root: viewport, ... })}`.
   */
  handleSentinelEntry(entry: IntersectionObserverEntry): void;
  /** Scroll to the bottom of the viewport */
  scrollToBottom(viewport: HTMLElement | null): void;
  /** Scroll to the top of the viewport */
  scrollToTop(viewport: HTMLElement | null): void;
  /**
   * Jump to the latest message with animation.
   * Handles smooth scroll and focuses the last message after animation.
   */
  jumpToLatest(viewport: HTMLElement | null, onComplete?: () => void): void;
  /**
   * Run a programmatic scroll `action` while suppressing the auto-stick-to-bottom
   * effect, mirroring the guard `jumpToLatest` already applies. Sets
   * `isUserScrolling` until the viewport emits `scrollend` or stops emitting
   * scroll events for the reduced-motion-aware backstop interval, then clears
   * it. A new call cancels any prior in-flight guard's listeners and backstop.
   * `onSettled`, if given, runs only when this guard settles (not if a later
   * guard cancels it first). Use this for any caller-driven scroll
   * (e.g. a virtualized `scrollToOffset`/`scrollToIndex` call) that isn't
   * already routed through `scrollToBottom`/`scrollToTop`/`jumpToLatest`.
   *
   * `destination`, if given, declares where this guarded scroll is headed
   * (scrollToTop → 0, jumpToLatest → the bottom) and serves two consumers:
   *
   * - `finishUserScrollGuard` completes the scroll instantly at the
   *   destination instead of leaving its animation racing a later instant
   *   scroll (#1237).
   * - `scrollend` settlement becomes destination-aware: a `scrollend` whose
   *   scroll position is not within a few pixels of the (viewport-clamped)
   *   destination is treated as STALE — the tail end of an earlier scroll
   *   (e.g. an auto-stick bottom correction issued just before this guard
   *   was armed) whose scroll/scrollend pair lands after `action()` starts
   *   its own animation (#1236). Such an event re-arms the scroll-quiet
   *   backstop instead of settling, so the guard holds until the viewport
   *   either reaches the destination or genuinely stops scrolling.
   *
   * It is read lazily so a destination like "the bottom" is computed against
   * the scroll extent at read time, not at guard start.
   */
  withUserScrollGuard(
    viewport: HTMLElement | null,
    action: () => void,
    onSettled?: () => void,
    destination?: () => number,
  ): void;
  /**
   * Instantly complete any in-flight `withUserScrollGuard`/`jumpToLatest`
   * session: clear the guard, then issue an instant scroll to the session's
   * declared `destination` (or pin the current position when the session
   * declared none). The instant scroll aborts the browser's smooth-scroll
   * animation, so nothing keeps animating toward a stale target afterwards.
   *
   * Call this before taking a scroll snapshot that must not race a
   * still-animating programmatic scroll — e.g. the history-prepend capture
   * (#1237): a load-earlier click mid scroll-to-top glide used to leave the
   * glide's compositor animation (absolute target 0) racing the instant
   * restore corrections, and whichever landed last won.
   *
   * Returns true when an active guarded session was finished.
   */
  finishUserScrollGuard(): boolean;
  /**
   * Immediately cancel any in-flight `withUserScrollGuard`/`jumpToLatest`
   * session and clear `isUserScrolling`, without arming a replacement timer.
   *
   * Call this before a scroll whose OWN target doesn't need the guard (its
   * destination already matches what the auto-stick-to-bottom effect wants,
   * so there's no risk of the effect fighting it) but that should nonetheless
   * supersede an earlier guarded scroll heading somewhere else — e.g. a
   * virtualized jump-to-latest/scroll-to-bottom issued while a scroll-to-top
   * guard is still active. Without this, the stale top-scroll guard would
   * keep suppressing the auto-stick correction for up to its remaining
   * duration even though the user's intent has already changed, so a message
   * appended in that window could stay out of view.
   */
  clearUserScrollGuard(): void;
  /** Get the appropriate scroll behavior based on user preference */
  getScrollBehavior(): ScrollBehavior;
  /**
   * Cancel any in-flight `withForcedLayout`/`withUserScrollGuard` session
   * (timers and listeners) and clear `isUserScrolling`. Call on teardown so
   * neither can fire after the consumer has unmounted.
   */
  destroy(): void;
}

// ==========================================================================
// Utilities
// ==========================================================================

/**
 * How far (px) a scrollend's position may sit from a guard's settle target and
 * still count as "arrived". Covers fractional scroll positions and the ±1px
 * rounding browsers apply to programmatic targets; anything farther is a stale
 * scrollend from an earlier scroll, not this guard's own completion (#1236).
 */
const SETTLE_TARGET_TOLERANCE = 2;

// ==========================================================================
// Helper
// ==========================================================================

/**
 * Creates reactive state and methods for managing chat scroll behavior.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { useChatScrollState } from './use-chat-scroll-state.svelte.ts';
 *
 *   const scrollState = useChatScrollState({
 *     bottomThreshold: 150,
 *     jumpThreshold: 200,
 *     onScrollStateChange: (event) => console.log('Scroll:', event),
 *     onReachBottom: () => unreadState.markAllAsRead(),
 *   });
 *
 *   const scrollAttachment = scrollState.createScrollAttachment();
 *
 *   // Wire the bottom sentinel with useIntersection via {@attach}. Wrap in $derived so
 *   // the observer is stable across re-renders (recreated only when root/threshold change).
 *   const sentinelAttach = $derived(
 *     useIntersection(scrollState.handleSentinelEntry, {
 *       root: viewport,
 *       rootMargin: `0px 0px 150px 0px`,
 *     }),
 *   );
 * </script>
 *
 * <div bind:this={viewport} {@attach scrollAttachment}>
 *   <!-- content -->
 *   <div {@attach sentinelAttach}></div>
 * </div>
 *
 * {#if scrollState.showJumpButton}
 *   <button onclick={() => scrollState.jumpToLatest(viewport)}>
 *     Jump to latest
 *   </button>
 * {/if}
 * ```
 */
export function useChatScrollState(options?: UseChatScrollStateOptions): UseChatScrollStateReturn {
  const {
    bottomThreshold = DEFAULT_SCROLL_CONFIGURATION.bottomThreshold,
    getBottomThreshold,
    jumpThreshold = DEFAULT_SCROLL_CONFIGURATION.jumpThreshold,
    getJumpThreshold,
    onScrollStateChange,
    onReachBottom,
  } = options ?? {};

  // Shared reduced-motion preference (OVERLAY-POLICY: use the shared hook, not inline matchMedia).
  const reducedMotion = useReducedMotion();

  /**
   * Returns the appropriate scroll behavior based on user preference.
   * Respects prefers-reduced-motion by using 'auto' instead of 'smooth'.
   */
  function getScrollBehavior(): ScrollBehavior {
    return reducedMotion.current ? 'auto' : 'smooth';
  }

  // Reactive state
  let atBottom = $state(true);
  let showJumpButton = $state(false);

  // Non-reactive bookkeeping
  let scrollTicking = false;
  let isUserScrolling = false; // Prevents auto-scroll from interrupting user-initiated smooth scroll
  // IntersectionObserver does not repeat an unchanged observation after a
  // guard settles. Preserve the latest entry received during the guard, then
  // re-read its target geometry at settlement so callback ordering cannot
  // replay a stale intersection snapshot.
  let pendingSentinelEntry: IntersectionObserverEntry | null = null;
  // Release function for the currently-applied forced-layout attribute, if
  // any. Ownership of WHEN this fires belongs to the enclosing
  // `withUserScrollGuard` session (its `settle`/`finishUserScrollGuard`/
  // `clearUserScrollGuard`/`destroy`), not to `withForcedLayout` itself — see
  // withForcedLayout below for why a self-restoring `scrollend` listener was
  // unsafe (CIN-418, second round).
  let activeForcedLayoutRelease: (() => void) | null = null;
  // Cancel function for the in-flight withUserScrollGuard session, if any. A
  // new session cancels the previous one's timer before starting its own:
  // without it, an earlier overlapping guarded scroll's timer could flip
  // isUserScrolling back to false while a later guarded scroll's animation is
  // still in progress. Note this deliberately does NOT release
  // activeForcedLayoutRelease — a superseding session reuses/re-applies the
  // same forced-layout window on the same viewport rather than tearing it
  // down and reapplying it.
  let activeUserScrollGuardCancel: (() => void) | null = null;
  let activeUserScrollViewport: HTMLElement | null = null;
  // Where the in-flight guarded scroll is headed, when its initiator declared
  // one (scrollToTop → 0, jumpToLatest → the bottom). Read lazily so
  // "the bottom" is computed against the scroll extent at finish time, not at
  // guard start. Used by finishUserScrollGuard to complete the scroll
  // instantly instead of leaving its animation racing a later instant scroll.
  let activeUserScrollGuardDestination: (() => number) | null = null;

  /**
   * Set atBottom state directly.
   */
  function setAtBottom(value: boolean): void {
    atBottom = value;
  }

  /**
   * Create a scroll event listener attachment for the viewport.
   */
  function createScrollAttachment(): Attachment<HTMLElement> {
    return (element) => {
      function handleScroll() {
        if (scrollTicking) return;

        scrollTicking = true;
        requestAnimationFrame(() => {
          const state = {
            scrollTop: element.scrollTop,
            scrollHeight: element.scrollHeight,
            clientHeight: element.clientHeight,
          };

          const scrolledToBottom = checkIsAtBottom(
            state,
            getBottomThreshold?.() ?? bottomThreshold,
          );
          const shouldShowJump = shouldShowJumpToLatest(
            state,
            getJumpThreshold?.() ?? jumpThreshold,
          );

          // Update reactive state
          atBottom = scrolledToBottom;
          showJumpButton = shouldShowJump;

          // Clear unread when scrolled to bottom
          if (scrolledToBottom) {
            onReachBottom?.();
          }

          // Emit scroll state change
          onScrollStateChange?.({
            atBottom: scrolledToBottom,
            scrollTop: state.scrollTop,
            scrollHeight: state.scrollHeight,
          });

          scrollTicking = false;
        });
      }

      element.addEventListener('scroll', handleScroll, { passive: true });
      return () => element.removeEventListener('scroll', handleScroll);
    };
  }

  /**
   * IntersectionObserver callback for the bottom sentinel element.
   * Exposed for use with useIntersection attachment-based wiring.
   */
  function applySentinelVisibility(sentinelVisible: boolean): void {
    if (sentinelVisible && !atBottom) {
      atBottom = true;
      onReachBottom?.();
    }
  }

  /**
   * Re-derive atBottom from the viewport's live geometry when a guarded scroll
   * settles. The scroll listener's recompute is rAF-deferred, so at the exact
   * moment a guard drops, `atBottom` may still describe a transient
   * mid-animation position (e.g. "near the bottom" read milliseconds into a
   * scroll-to-top). State is refreshed from final geometry, and reaching the
   * bottom fires `onReachBottom` when the state transitions there.
   */
  function recomputeFromViewport(viewport: HTMLElement | null): void {
    if (viewport === null) return;
    const state = {
      scrollTop: viewport.scrollTop,
      scrollHeight: viewport.scrollHeight,
      clientHeight: viewport.clientHeight,
    };
    const scrolledToBottom = checkIsAtBottom(state, getBottomThreshold?.() ?? bottomThreshold);
    showJumpButton = shouldShowJumpToLatest(state, getJumpThreshold?.() ?? jumpThreshold);
    if (scrolledToBottom && !atBottom) {
      atBottom = true;
      onReachBottom?.();
    } else if (!scrolledToBottom && atBottom) {
      atBottom = false;
    }
    onScrollStateChange?.({
      atBottom: scrolledToBottom,
      scrollTop: state.scrollTop,
      scrollHeight: state.scrollHeight,
    });
  }

  function applyPendingSentinelEntry(viewport: HTMLElement | null): void {
    if (pendingSentinelEntry === null) return;
    const entry = pendingSentinelEntry;
    pendingSentinelEntry = null;

    let sentinelVisible = entry.isIntersecting;
    if (viewport !== null && entry.target instanceof Element && entry.target.isConnected) {
      const sentinelBounds = entry.target.getBoundingClientRect();
      const viewportBounds = viewport.getBoundingClientRect();
      const bottomMargin = getBottomThreshold?.() ?? bottomThreshold;
      sentinelVisible =
        sentinelBounds.bottom >= viewportBounds.top &&
        sentinelBounds.top <= viewportBounds.bottom + bottomMargin &&
        sentinelBounds.right >= viewportBounds.left &&
        sentinelBounds.left <= viewportBounds.right;
    }

    applySentinelVisibility(sentinelVisible);
  }

  function handleSentinelEntry(entry: IntersectionObserverEntry): void {
    // A smooth programmatic scroll can receive observations for transient
    // positions before it settles. Coalesce them rather than applying them
    // immediately: the latest observation owns the state once the guard ends,
    // including the case where the sentinel remains visible and the observer
    // will not emit the same unchanged intersection again.
    if (isUserScrolling) {
      pendingSentinelEntry = entry;
      return;
    }

    applySentinelVisibility(entry.isIntersecting);
  }

  /**
   * Create an IntersectionObserver for the bottom sentinel.
   * @deprecated Prefer `{@attach useIntersection(scrollState.handleSentinelEntry, { root: viewport, rootMargin })}` on the sentinel element.
   */
  function createSentinelObserver(
    viewport: HTMLElement | null,
    sentinel: HTMLElement | null,
  ): (() => void) | undefined {
    if (!viewport || !sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        handleSentinelEntry(entry);
      },
      {
        root: viewport,
        threshold: 0,
        rootMargin: `0px 0px ${getBottomThreshold?.() ?? bottomThreshold}px 0px`,
      },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }

  /**
   * Forces every row to lay out at its real height before a programmatic
   * scroll, for the caller's `withUserScrollGuard` session to release once
   * ITS settlement logic (not this function's own timers) decides the
   * animation is really done.
   *
   * Off-screen `.chat-message` rows use `content-visibility: auto` with a
   * 180px estimate (`contain-intrinsic-size`) until they're painted. Calling
   * `scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' })` captures a
   * target computed from those estimates; as the animation scrolls estimated
   * rows into view, they resize to their real height, which shifts content
   * under the fixed pixel target mid-flight — visible as a jerk right as the
   * scroll finishes, and (CIN-418) a `scrollHeight` that can read back below
   * `clientHeight` right as the guard settles, misread as "short transcript,
   * already at the bottom". Forcing layout up front
   * (`data-cinder-force-visible`) makes both the initial target and every
   * later geometry read accurate.
   *
   * This function used to restore the optimization itself, on its own
   * `scrollend` listener with a scroll-quiet timeout backstop. That was
   * CIN-418's actual bug (confirmed against real GitHub Actions WebKit,
   * where the synthetic fake-viewport unit harness below did not reproduce
   * it): a *stale* `scrollend` — the tail of an unrelated, still-in-flight
   * scroll session, e.g. a mount-time auto-scroll-to-bottom still settling
   * when a `scrollToTop()` call fires immediately after — is exactly the
   * kind of event this listener could not distinguish from its own
   * animation's completion, because it had no destination check and no
   * staleness handling the way `withUserScrollGuard`'s own `scrollend`
   * listener does. `{ once: true }` meant it fired at most once and then
   * stayed fired: the attribute would get stripped a few frames into the
   * REAL animation, un-forced `content-visibility: auto` churn would resume
   * mid-flight, WebKit would stall the animation part-way under CI CPU
   * pressure, and the guard's own (correct, destination-aware) settlement
   * logic would then read final geometry against a still-estimated
   * `scrollHeight` and land on the wrong `atBottom`. Measured: the attribute
   * was observed present immediately after a `scrollToTop()` click in only
   * ~1/6 of real CI runs.
   *
   * There is now exactly one settlement authority — the enclosing guard —
   * and exactly one release path per session, so a stale event from a
   * DIFFERENT session can no longer strip this one's forced-layout window.
   * A caller that applies this more than once within the same guard session
   * (e.g. `withUserScrollGuard`'s bottom-grew re-issue) is idempotent: the
   * attribute is already set, and this just re-forces layout for the new
   * target.
   */
  function withForcedLayout(viewport: HTMLElement, scroll: () => void): void {
    viewport.setAttribute('data-cinder-force-visible', '');
    // Force a synchronous layout so scrollHeight (read inside `scroll`)
    // reflects every row's real height, not the content-visibility estimate.
    void viewport.offsetHeight;

    activeForcedLayoutRelease = () => {
      activeForcedLayoutRelease = null;
      viewport.removeAttribute('data-cinder-force-visible');
    };

    scroll();
  }

  /**
   * Scroll to the bottom of the viewport.
   *
   * Routed through `withUserScrollGuard` (CIN-418) so it gets the same
   * `scrollend`-driven final `recomputeFromViewport` that
   * `scrollToTop`/`jumpToLatest` already get. Without it, `atBottom` depended
   * solely on the passive `scroll` listener's rAF-batched recompute — under
   * `content-visibility: auto` row virtualization, off-screen rows collapse
   * to their `contain-intrinsic-size` estimate and newly-visible rows expand
   * to real height continuously during the animation, which can shift
   * `scrollHeight` by hundreds of px mid-flight and coalesce/lag the passive
   * listener's last recompute under load (observed on CI WebKit, ~20% of
   * runs). `withUserScrollGuard`'s own `scrollend` handler is the backstop
   * that still recomputes from final geometry even if that happens.
   */
  function scrollToBottom(viewport: HTMLElement | null): void {
    if (!viewport) return;
    withUserScrollGuard(
      viewport,
      () => {
        withForcedLayout(viewport, () => {
          viewport.scrollTo({ top: viewport.scrollHeight, behavior: getScrollBehavior() });
        });
      },
      undefined,
      () => viewport.scrollHeight,
    );
  }

  /**
   * Run a programmatic scroll `action` while suppressing the auto-stick-to-bottom
   * effect. See `UseChatScrollStateReturn.withUserScrollGuard` for details.
   *
   * `onSettled`, if given, runs once the guard's own timer fires (i.e. once
   * `isUserScrolling` has been cleared) — NOT when a later overlapping guard
   * cancels this one first. `jumpToLatest` uses it for its post-scroll focus
   * behavior, sharing the same single cancellable timer that `isUserScrolling`
   * itself is cleared by, so overlapping guarded scrolls of ANY kind (jump-to-
   * latest, scroll-to-top, jump-to-start) can never leave a stale timer behind
   * that clears the flag mid-animation for a different call.
   */
  function withUserScrollGuard(
    viewport: HTMLElement | null,
    action: () => void,
    onSettled?: () => void,
    destination?: () => number,
  ): void {
    // Cancel any previous in-flight guard first: without this, an earlier
    // overlapping guarded scroll (e.g. jumpToLatest() immediately followed by
    // scrollToTop(), or two quick Home presses) would have its OWN timer flip
    // isUserScrolling back to false while THIS scroll's animation is still in
    // progress, reintroducing the exact race this guard exists to prevent.
    activeUserScrollGuardCancel?.();
    isUserScrolling = true;

    const settleBackstopDuration = reducedMotion.current ? 50 : 500;
    let settled = false;
    let backstop: ReturnType<typeof setTimeout> | undefined;
    let guardSettleTarget: number | null = null;

    function readSettleTarget(): number | null {
      if (destination === undefined || viewport === null) return null;
      // Clamp the declared destination to the currently reachable scroll
      // range: jumpToLatest declares "the bottom" as `scrollHeight`, which
      // the browser clamps to `scrollHeight - clientHeight` when scrolling.
      const maximumScrollTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
      return Math.min(maximumScrollTop, Math.max(0, destination()));
    }

    function cancel(): void {
      if (settled) return;
      settled = true;
      if (backstop !== undefined) clearTimeout(backstop);
      viewport?.removeEventListener('scrollend', settleFromScrollEnd);
      viewport?.removeEventListener('scroll', armBackstop);
    }

    function settle(): void {
      if (settled) return;
      cancel();
      activeUserScrollGuardCancel = null;
      activeUserScrollViewport = null;
      activeUserScrollGuardDestination = null;
      isUserScrolling = false;
      // Settlement leaves atBottom truthful for the FINAL geometry, not for
      // whatever transient position the last coalesced/rAF-deferred recompute
      // happened to observe mid-animation. Without this, a remeasurement
      // landing in the sub-frame window between settlement and the scroll
      // listener's next rAF recompute can re-fire the auto-stick effect
      // against a stale `atBottom: true` and yank a just-completed top-scroll
      // back to the bottom (#1236).
      //
      // Read geometry BEFORE releasing any forced-layout window this session
      // applied (CIN-418): releasing first snaps `scrollHeight` back to the
      // content-visibility estimate for whichever rows have since scrolled
      // off-screen, reintroducing the exact stale-geometry misread this
      // settlement exists to avoid.
      recomputeFromViewport(viewport);
      activeForcedLayoutRelease?.();
      applyPendingSentinelEntry(viewport);
      onSettled?.();
    }

    function settleFromScrollEnd(): void {
      if (settled) return;
      const target = readSettleTarget();
      if (target !== null && viewport !== null) {
        if (Math.abs(viewport.scrollTop - target) > SETTLE_TARGET_TOLERANCE) {
          // Stale scrollend from an earlier scroll (the guard's own animation
          // has not reached its destination), or an animation cancelled
          // mid-flight. Keep the guard armed; the scroll-quiet backstop still
          // guarantees eventual settlement if no further progress is ever
          // made.
          // A bottom-directed smooth scroll can also have its original target
          // invalidated by content appended while the animation is in flight.
          // Re-issue the destination so the browser retargets to the newly
          // reachable bottom instead of settling above the latest message. Do
          // not re-issue for unchanged bottoms: that can fight a user's manual
          // cancellation in the non-virtualized path.
          const targetGrewSinceGuardArmed =
            guardSettleTarget !== null && target > guardSettleTarget + SETTLE_TARGET_TOLERANCE;
          if (targetGrewSinceGuardArmed && target > viewport.scrollTop + SETTLE_TARGET_TOLERANCE) {
            withForcedLayout(viewport, () => {
              viewport.scrollTo({ top: destination!(), behavior: getScrollBehavior() });
            });
            guardSettleTarget = target;
          }
          armBackstop();
          return;
        }
      }
      settle();
    }

    function armBackstop(): void {
      if (backstop !== undefined) clearTimeout(backstop);
      backstop = setTimeout(settle, settleBackstopDuration);
    }

    activeUserScrollGuardCancel = cancel;
    activeUserScrollViewport = viewport;
    activeUserScrollGuardDestination = destination ?? null;
    guardSettleTarget = readSettleTarget();
    // NOT `{ once: true }`: a stale scrollend that fails the destination check
    // must not consume the listener, or the REAL animation's completion could
    // never settle the guard promptly.
    viewport?.addEventListener('scrollend', settleFromScrollEnd);
    viewport?.addEventListener('scroll', armBackstop, { passive: true });

    // Arm the no-event backstop AFTER `action()` runs. The action can include
    // a costly synchronous layout pass before it issues the scroll command;
    // starting the clock first would consume settlement budget before the
    // animation even begins. Every subsequent scroll tick re-arms it.
    try {
      action();
    } finally {
      // Forced layout inside the action can change the reachable bottom. The
      // cancellation baseline must describe the target actually issued.
      guardSettleTarget = readSettleTarget();
      armBackstop();
    }
  }

  /**
   * Immediately cancel any in-flight guard and clear isUserScrolling. See
   * `UseChatScrollStateReturn.clearUserScrollGuard` for details.
   */
  function clearUserScrollGuard(): void {
    const viewport = activeUserScrollViewport;
    activeUserScrollGuardCancel?.();
    activeUserScrollGuardCancel = null;
    activeUserScrollViewport = null;
    activeUserScrollGuardDestination = null;
    isUserScrolling = false;
    // Release any forced-layout window this (now-cleared) session held. A
    // no-op for the virtualized callers of this method, which never apply
    // forced layout in the first place; guards this method against leaving
    // `data-cinder-force-visible` stuck on the non-virtualized path too.
    activeForcedLayoutRelease?.();
    applyPendingSentinelEntry(viewport);
  }

  /**
   * Instantly complete any in-flight guarded scroll at its declared
   * destination (or pin the current position when none was declared). See
   * `UseChatScrollStateReturn.finishUserScrollGuard` for details.
   */
  function finishUserScrollGuard(): boolean {
    if (activeUserScrollGuardCancel === null) return false;
    const viewport = activeUserScrollViewport;
    const destination = activeUserScrollGuardDestination;
    // Read/apply the destination BEFORE clearing: `clearUserScrollGuard`
    // releases this session's forced-layout window (CIN-418), which would
    // snap `scrollHeight` back to the content-visibility estimate and make a
    // bottom-directed `destination()` read short.
    if (viewport) {
      // Either way this instant scroll aborts the browser's in-flight
      // smooth-scroll animation; with a declared destination it also lands
      // the scroll where the guarded session was already headed.
      viewport.scrollTo({
        top: destination ? destination() : viewport.scrollTop,
        behavior: 'instant',
      });
    }
    clearUserScrollGuard();
    return true;
  }

  /**
   * Scroll to the top of the viewport.
   */
  function scrollToTop(viewport: HTMLElement | null): void {
    if (!viewport) return;
    // The user is deliberately leaving the bottom — but only if the viewport
    // can actually move. A transcript short enough to fit entirely within the
    // viewport (scrollHeight <= clientHeight) is always "at the bottom" by
    // definition: scrollTo({ top: 0 }) is a no-op there, so flipping atBottom
    // to false would desync it from the real (unchanged) scroll position,
    // and a message appended right after would be wrongly marked unread.
    //
    // Set synchronously rather than waiting for the real scroll listener's
    // rAF-deferred recompute — any message that arrives before that recompute
    // runs would otherwise read a stale `atBottom: true` and skip the unread
    // indicator.
    if (viewport.scrollHeight > viewport.clientHeight) {
      atBottom = false;
    }
    withUserScrollGuard(
      viewport,
      () => {
        // Force layout for the duration of the animation (CIN-418), same
        // treatment scrollToBottom/jumpToLatest already get. Without this,
        // rows scrolled past re-collapse to their content-visibility
        // estimate as the scroll-to-top animation passes them, which can
        // shrink `scrollHeight` below `clientHeight` right as `scrollend`
        // fires — indistinguishable from a genuinely short transcript to
        // `recomputeFromViewport`'s `isAtBottom` check, so the guard
        // settled with `atBottom` stuck `true` instead of `false`.
        withForcedLayout(viewport, () => {
          viewport.scrollTo({ top: 0, behavior: getScrollBehavior() });
        });
      },
      undefined,
      // Destination: only a scrollend AT the top is this scroll's own
      // completion — one from an earlier scroll's tail end must not settle
      // the guard while the animation is still heading up (#1236) — and
      // finishUserScrollGuard completes the scroll here instantly (#1237).
      () => 0,
    );
  }

  /**
   * Jump to the latest message with animation.
   */
  function jumpToLatest(viewport: HTMLElement | null, onComplete?: () => void): void {
    if (!viewport) return;

    withUserScrollGuard(
      viewport,
      () => {
        withForcedLayout(viewport, () => {
          viewport.scrollTo({ top: viewport.scrollHeight, behavior: getScrollBehavior() });
        });
        onReachBottom?.();
        onComplete?.();
      },
      () => {
        // Focus last message for keyboard users once the animation settles
        // (typical smooth scroll takes ~300-500ms; reduced motion uses a
        // minimal delay since the scroll is instant).
        const wrappers = viewport.querySelectorAll<HTMLElement>('.chat-message-wrapper');
        const lastWrapper = wrappers.length > 0 ? wrappers[wrappers.length - 1] : null;
        const lastMessage = lastWrapper?.querySelector<HTMLElement>('.chat-message') ?? null;
        lastMessage?.focus();
      },
      () => viewport.scrollHeight,
    );
  }

  /**
   * Cancel any in-flight forced-layout or user-scroll-guard session (timers
   * and listeners) and clear isUserScrolling. See
   * `UseChatScrollStateReturn.destroy` for details.
   */
  function destroy(): void {
    activeForcedLayoutRelease?.();
    activeUserScrollGuardCancel?.();
    activeUserScrollGuardCancel = null;
    activeUserScrollViewport = null;
    activeUserScrollGuardDestination = null;
    isUserScrolling = false;
    pendingSentinelEntry = null;
  }

  return {
    get atBottom() {
      return atBottom;
    },
    get showJumpButton() {
      return showJumpButton;
    },
    setAtBottom,
    recomputeFromViewport,
    createScrollAttachment,
    createSentinelObserver,
    handleSentinelEntry,
    scrollToBottom,
    scrollToTop,
    jumpToLatest,
    withUserScrollGuard,
    finishUserScrollGuard,
    clearUserScrollGuard,
    getScrollBehavior,
    destroy,
    // Exposed helper for auto-scroll logic, used by the parent component
    get isUserScrolling() {
      return isUserScrolling;
    },
  };
}
