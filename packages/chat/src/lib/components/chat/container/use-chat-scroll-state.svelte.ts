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
  // Cancel function for the in-flight withForcedLayout session, if any. A new
  // session cancels the previous one's listeners/timer before starting its
  // own — see withForcedLayout below for why this matters.
  let activeForcedLayoutCancel: (() => void) | null = null;
  // Cancel function for the in-flight withUserScrollGuard session, if any. A
  // new session cancels the previous one's timer before starting its own —
  // same rationale as activeForcedLayoutCancel: without it, an earlier
  // overlapping guarded scroll's timer could flip isUserScrolling back to
  // false while a later guarded scroll's animation is still in progress.
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
   * scroll-to-top). Only transitions are applied — reaching the bottom fires
   * `onReachBottom` exactly like the scroll listener's recompute would.
   */
  function recomputeAtBottomAtSettlement(viewport: HTMLElement | null): void {
    if (viewport === null) return;
    const scrolledToBottom = checkIsAtBottom(
      {
        scrollTop: viewport.scrollTop,
        scrollHeight: viewport.scrollHeight,
        clientHeight: viewport.clientHeight,
      },
      getBottomThreshold?.() ?? bottomThreshold,
    );
    if (scrolledToBottom && !atBottom) {
      atBottom = true;
      onReachBottom?.();
    } else if (!scrolledToBottom && atBottom) {
      atBottom = false;
    }
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
   * scroll-to-bottom, then restores the content-visibility optimization once
   * the scroll settles.
   *
   * Off-screen `.chat-message` rows use `content-visibility: auto` with a
   * 180px estimate (`contain-intrinsic-size`) until they're painted. Calling
   * `scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' })` captures a
   * target computed from those estimates; as the animation scrolls estimated
   * rows into view, they resize to their real height, which shifts content
   * under the fixed pixel target mid-flight — visible as a jerk right as the
   * scroll finishes. Forcing layout up front (`data-cinder-force-visible`)
   * makes the target accurate from the start.
   *
   * The `scrollend` listener restores the optimization as soon as the
   * animation actually finishes. The timeout is a backstop for environments
   * without `scrollend` support and for a zero-distance scroll (already at
   * the bottom), where neither `scroll` nor `scrollend` ever fires — but it
   * re-arms on every `scroll` tick rather than firing once on a fixed clock,
   * so a scroll animation that legitimately runs longer than the backstop
   * duration (a long transcript, a slower device) can never have the
   * optimization restored out from under it mid-flight, which would let
   * off-screen rows resize again before the scroll settles — the exact jerk
   * this exists to prevent.
   *
   * A second call before the first session settles (e.g. a double-click on
   * jump-to-latest, or auto-scroll firing while a prior scroll is still in
   * flight) cancels the earlier session's listeners/timer first. Without
   * this, the OLDER session's own scrollend/backstop could still fire and
   * strip the attribute while the NEWER scroll animation is still running —
   * the same jerk this whole mechanism exists to prevent, just reintroduced
   * by an overlapping call instead of a single long one.
   */
  function withForcedLayout(viewport: HTMLElement, scroll: () => void): void {
    activeForcedLayoutCancel?.();

    viewport.setAttribute('data-cinder-force-visible', '');
    // Force a synchronous layout so scrollHeight (read inside `scroll`)
    // reflects every row's real height, not the content-visibility estimate.
    void viewport.offsetHeight;

    let settled = false;
    let backstop: ReturnType<typeof setTimeout>;
    const backstopDuration = reducedMotion.current ? 50 : 500;

    function cancel() {
      if (settled) return;
      settled = true;
      clearTimeout(backstop);
      viewport.removeEventListener('scrollend', restore);
      viewport.removeEventListener('scroll', armBackstop);
    }

    const restore = () => {
      if (settled) return;
      cancel();
      activeForcedLayoutCancel = null;
      viewport.removeAttribute('data-cinder-force-visible');
    };

    function armBackstop() {
      clearTimeout(backstop);
      backstop = setTimeout(restore, backstopDuration);
    }

    activeForcedLayoutCancel = cancel;
    viewport.addEventListener('scrollend', restore, { once: true });
    viewport.addEventListener('scroll', armBackstop, { passive: true });
    // Covers the zero-distance case (already at bottom): no scroll/scrollend
    // event will ever fire, so this is the only thing that restores it.
    armBackstop();

    scroll();
  }

  /**
   * Scroll to the bottom of the viewport.
   */
  function scrollToBottom(viewport: HTMLElement | null): void {
    if (!viewport) return;
    // Supersede any stale guard from an earlier top-scroll (scrollToTop) that
    // hasn't expired yet — this scroll's own target already matches what the
    // auto-stick-to-bottom effect wants, so it needs no guard of its own, but
    // an older guard left active would keep suppressing that effect's
    // correction for messages appended after this call.
    clearUserScrollGuard();
    withForcedLayout(viewport, () => {
      viewport.scrollTo({ top: viewport.scrollHeight, behavior: getScrollBehavior() });
    });
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
      recomputeAtBottomAtSettlement(viewport);
      applyPendingSentinelEntry(viewport);
      onSettled?.();
    }

    function settleFromScrollEnd(): void {
      if (settled) return;
      if (destination !== undefined && viewport !== null) {
        // Clamp the declared destination to the currently reachable scroll
        // range: jumpToLatest declares "the bottom" as `scrollHeight`, which
        // the browser clamps to `scrollHeight - clientHeight` when scrolling.
        const maximumScrollTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
        const target = Math.min(maximumScrollTop, Math.max(0, destination()));
        if (Math.abs(viewport.scrollTop - target) > SETTLE_TARGET_TOLERANCE) {
          // Stale scrollend from an earlier scroll (the guard's own animation
          // has not reached its destination), or an animation cancelled
          // mid-flight. Keep the guard armed; the scroll-quiet backstop still
          // guarantees eventual settlement if no further progress is ever
          // made.
          // A bottom-directed smooth scroll can also have its original target
          // invalidated by content appended while the animation is in flight.
          // Re-issue the destination so the browser retargets to the newly
          // reachable bottom instead of settling above the latest message.
          if (target > viewport.scrollTop + SETTLE_TARGET_TOLERANCE) {
            viewport.scrollTo({ top: destination(), behavior: getScrollBehavior() });
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
    clearUserScrollGuard();
    if (viewport) {
      // Either way this instant scroll aborts the browser's in-flight
      // smooth-scroll animation; with a declared destination it also lands
      // the scroll where the guarded session was already headed.
      viewport.scrollTo({
        top: destination ? destination() : viewport.scrollTop,
        behavior: 'instant',
      });
    }
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
        viewport.scrollTo({ top: 0, behavior: getScrollBehavior() });
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
    activeForcedLayoutCancel?.();
    activeForcedLayoutCancel = null;
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
