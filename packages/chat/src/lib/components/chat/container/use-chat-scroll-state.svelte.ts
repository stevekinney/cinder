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

/**
 * Cleanup resources.
 *
 * No-op: this helper owns no long-lived resources. IntersectionObserver
 * cleanup is handled by the disconnect function returned from
 * `createSentinelObserver`. Exposed for API symmetry with consumers that
 * call `destroy()` unconditionally on teardown.
 */
const destroy = (): void => {};

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
   * `isUserScrolling` for the duration of the scroll animation (based on the
   * reduced-motion preference), then clears it. A new call cancels any prior
   * in-flight guard's timer first, so overlapping guarded scrolls can never
   * leave a stale timer that clears the flag out from under a later one.
   * `onSettled`, if given, runs once this guard's own timer fires (not if a
   * later guard cancels it first). Use this for any caller-driven scroll
   * (e.g. a virtualized `scrollToOffset`/`scrollToIndex` call) that isn't
   * already routed through `scrollToBottom`/`scrollToTop`/`jumpToLatest`.
   */
  withUserScrollGuard(action: () => void, onSettled?: () => void): void;
  /** Get the appropriate scroll behavior based on user preference */
  getScrollBehavior(): ScrollBehavior;
  /** Cleanup resources */
  destroy(): void;
}

// ==========================================================================
// Utilities
// ==========================================================================

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
  function handleSentinelEntry(entry: IntersectionObserverEntry): void {
    const sentinelVisible = entry.isIntersecting;
    if (sentinelVisible && !atBottom) {
      atBottom = true;
      onReachBottom?.();
    }
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
  function withUserScrollGuard(action: () => void, onSettled?: () => void): void {
    // Cancel any previous in-flight guard first: without this, an earlier
    // overlapping guarded scroll (e.g. jumpToLatest() immediately followed by
    // scrollToTop(), or two quick Home presses) would have its OWN timer flip
    // isUserScrolling back to false while THIS scroll's animation is still in
    // progress, reintroducing the exact race this guard exists to prevent.
    activeUserScrollGuardCancel?.();

    // Prevent auto-scroll from interrupting the programmatic scroll animation.
    // The timer is armed before `action()` runs so the flag still clears on
    // its own even if `action()` throws.
    isUserScrolling = true;
    const scrollDuration = reducedMotion.current ? 50 : 500;
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      activeUserScrollGuardCancel = null;
      isUserScrolling = false;
      onSettled?.();
    }, scrollDuration);
    activeUserScrollGuardCancel = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
    };

    action();
  }

  /**
   * Scroll to the top of the viewport.
   */
  function scrollToTop(viewport: HTMLElement | null): void {
    if (!viewport) return;
    // The user is deliberately leaving the bottom. Set atBottom synchronously
    // rather than waiting for the real scroll listener's rAF-deferred
    // recompute — any message that arrives before that recompute runs would
    // otherwise read a stale `atBottom: true` and skip the unread indicator.
    atBottom = false;
    withUserScrollGuard(() => {
      viewport.scrollTo({ top: 0, behavior: getScrollBehavior() });
    });
  }

  /**
   * Jump to the latest message with animation.
   */
  function jumpToLatest(viewport: HTMLElement | null, onComplete?: () => void): void {
    if (!viewport) return;

    withUserScrollGuard(
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
    );
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
    getScrollBehavior,
    destroy,
    // Exposed helper for auto-scroll logic, used by the parent component
    get isUserScrolling() {
      return isUserScrolling;
    },
  };
}
