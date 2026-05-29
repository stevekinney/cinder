/**
 * Runes helper for chat scroll state management.
 *
 * Manages:
 * - isAtBottom state for auto-scroll decisions
 * - showJumpButton state for jump-to-latest visibility
 * - Scroll event listener attachment
 * - IntersectionObserver for bottom sentinel
 * - Imperative scroll methods
 */

import type { Attachment } from 'svelte/attachments';
import type { ChatScrollStateChangeEvent } from './chat-events.ts';
import {
  isAtBottom as checkIsAtBottom,
  DEFAULT_SCROLL_CONFIGURATION,
  shouldShowJumpToLatest,
} from './scroll-utilities';

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
  readonly isAtBottom: boolean;
  /** Whether the jump-to-latest button should be visible */
  readonly showJumpButton: boolean;
  /** Whether user is in a smooth scroll animation (used by parent for auto-scroll logic) */
  readonly isUserScrolling: boolean;
  /** Set isAtBottom state directly */
  setIsAtBottom(value: boolean): void;
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
  /** Scroll to the bottom of the viewport */
  scrollToBottom(viewport: HTMLElement | null): void;
  /** Scroll to the top of the viewport */
  scrollToTop(viewport: HTMLElement | null): void;
  /**
   * Jump to the latest message with animation.
   * Handles smooth scroll and focuses the last message after animation.
   */
  jumpToLatest(viewport: HTMLElement | null, onComplete?: () => void): void;
  /** Get the appropriate scroll behavior based on user preference */
  getScrollBehavior(): ScrollBehavior;
  /** Cleanup resources */
  destroy(): void;
}

// ==========================================================================
// Utilities
// ==========================================================================

/**
 * Detects if the user prefers reduced motion.
 * Uses matchMedia for browser support, falls back to false for SSR.
 */
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Returns the appropriate scroll behavior based on user preference.
 * Respects prefers-reduced-motion by using 'auto' instead of 'smooth'.
 */
function getScrollBehavior(): ScrollBehavior {
  return prefersReducedMotion() ? 'auto' : 'smooth';
}

// ==========================================================================
// Helper
// ==========================================================================

/**
 * Creates reactive state and methods for managing chat scroll behavior.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { useChatScrollState } from './use-chat-scroll-state.svelte';
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
 *   // Set up IntersectionObserver in an $effect
 *   $effect(() => {
 *     return scrollState.createSentinelObserver(viewport, bottomSentinel);
 *   });
 * </script>
 *
 * <div bind:this={viewport} {@attach scrollAttachment}>
 *   <!-- content -->
 *   <div bind:this={bottomSentinel}></div>
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

  // Reactive state
  let isAtBottom = $state(true);
  let showJumpButton = $state(false);

  // Non-reactive bookkeeping
  let scrollTicking = false;
  let isUserScrolling = false; // Prevents auto-scroll from interrupting user-initiated smooth scroll

  /**
   * Set isAtBottom state directly.
   */
  function setIsAtBottom(value: boolean): void {
    isAtBottom = value;
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

          const atBottom = checkIsAtBottom(state, getBottomThreshold?.() ?? bottomThreshold);
          const shouldShowJump = shouldShowJumpToLatest(
            state,
            getJumpThreshold?.() ?? jumpThreshold,
          );

          // Update reactive state
          isAtBottom = atBottom;
          showJumpButton = shouldShowJump;

          // Clear unread when scrolled to bottom
          if (atBottom) {
            onReachBottom?.();
          }

          // Emit scroll state change
          onScrollStateChange?.({
            isAtBottom: atBottom,
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
   * Create an IntersectionObserver for the bottom sentinel.
   */
  function createSentinelObserver(
    viewport: HTMLElement | null,
    sentinel: HTMLElement | null,
  ): (() => void) | undefined {
    if (!viewport || !sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        const atBottom = entry.isIntersecting;
        if (atBottom && !isAtBottom) {
          isAtBottom = true;
          onReachBottom?.();
        }
      },
      {
        root: viewport,
        threshold: 0,
        rootMargin: `0px 0px ${bottomThreshold}px 0px`,
      },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }

  /**
   * Scroll to the bottom of the viewport.
   */
  function scrollToBottom(viewport: HTMLElement | null): void {
    viewport?.scrollTo({ top: viewport.scrollHeight, behavior: getScrollBehavior() });
  }

  /**
   * Scroll to the top of the viewport.
   */
  function scrollToTop(viewport: HTMLElement | null): void {
    viewport?.scrollTo({ top: 0, behavior: getScrollBehavior() });
  }

  /**
   * Jump to the latest message with animation.
   */
  function jumpToLatest(viewport: HTMLElement | null, onComplete?: () => void): void {
    if (!viewport) return;

    // Prevent auto-scroll from interrupting the smooth scroll animation
    isUserScrolling = true;

    const behavior = getScrollBehavior();
    viewport.scrollTo({ top: viewport.scrollHeight, behavior });
    onReachBottom?.();
    onComplete?.();

    // Focus last message for keyboard users and clear the user scrolling flag
    // after animation completes (typical smooth scroll takes ~300-500ms)
    // For reduced motion, use minimal delay since scroll is instant
    const scrollDuration = prefersReducedMotion() ? 50 : 500;
    setTimeout(() => {
      isUserScrolling = false;
      const wrappers = viewport.querySelectorAll<HTMLElement>('.chat-message-wrapper');
      const lastWrapper = wrappers.length > 0 ? wrappers[wrappers.length - 1] : null;
      const lastMessage = lastWrapper?.querySelector<HTMLElement>('.chat-message') ?? null;
      lastMessage?.focus();
    }, scrollDuration);
  }

  return {
    get isAtBottom() {
      return isAtBottom;
    },
    get showJumpButton() {
      return showJumpButton;
    },
    setIsAtBottom,
    createScrollAttachment,
    createSentinelObserver,
    scrollToBottom,
    scrollToTop,
    jumpToLatest,
    getScrollBehavior,
    destroy,
    // Exposed helper for auto-scroll logic, used by the parent component
    get isUserScrolling() {
      return isUserScrolling;
    },
  };
}
