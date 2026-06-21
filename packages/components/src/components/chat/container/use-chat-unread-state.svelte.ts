/**
 * Runes helper for chat unread state tracking.
 *
 * Manages:
 * - Unread message count
 * - New message indicator visibility
 * - First unread message ID for divider placement
 * - Screen reader announcements
 */

import { untrack } from 'svelte';
import { useAnnouncer } from '../../../utilities/use-announcer.svelte.ts';
import type { Message } from '../conversation-model.ts';
import type { ChatUnreadIndicatorChangeEvent } from './chat-events.ts';
import { formatUnreadCount, isLargeCount } from './scroll-utilities';

// ==========================================================================
// Types
// ==========================================================================

// Re-export the event type from chat.svelte for API consistency
export type { ChatUnreadIndicatorChangeEvent as UnreadIndicatorChangeEvent } from './chat-events.ts';

/** Options for the unread state helper */
export interface UseChatUnreadStateOptions {
  /** Debounce delay for screen reader announcements (default: 300ms) */
  announcerDebounceMs?: number;
  /**
   * Callback when unread indicator state changes.
   *
   * **Important:** Always read values from the event argument, not from bindings.
   * The callback fires before bindable props are synchronized, so bindings may
   * contain stale values during the callback.
   */
  onUnreadIndicatorChange?: (event: ChatUnreadIndicatorChangeEvent) => void;
}

/** Return type for the unread state helper */
export interface UseChatUnreadStateReturn {
  /** Current count of unread messages */
  readonly unreadCount: number;
  /** Whether the new message indicator should be visible */
  readonly newMessageIndicatorVisible: boolean;
  /** ID of the first unread message (for divider placement) */
  readonly firstUnreadId: string | null;
  /** Formatted unread count for display (caps at "99+") */
  readonly displayUnreadCount: string;
  /** Whether the count exceeds 99 (for compact badge styling) */
  readonly hasLargeCount: boolean;
  /** Current screen reader announcement message */
  readonly announcerMessage: string;
  /** Mark all messages as read (resets unread state) */
  markAllAsRead(): void;
  /**
   * Process messages to detect new arrivals and update unread state.
   * Should be called in an $effect when messages change.
   *
   * @param getAtBottom - Getter function to read atBottom without creating a dependency.
   *                      This allows the effect to only re-run when messages change, not on scroll.
   */
  processMessages(messages: Message[], conversationId: string, getAtBottom: () => boolean): void;
  /** Cleanup resources */
  destroy(): void;
}

// ==========================================================================
// Helper
// ==========================================================================

/**
 * Creates reactive state and methods for tracking unread messages.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { useChatUnreadState } from './use-chat-unread-state.svelte';
 *
 *   const unreadState = useChatUnreadState({
 *     onUnreadIndicatorChange: (event) => console.log('Unread changed:', event),
 *   });
 *
 *   // Call in an $effect to process message changes
 *   // Pass a getter function for atBottom to avoid creating a scroll dependency
 *   $effect(() => {
 *     unreadState.processMessages(messages, conversation.id, () => scrollState.atBottom);
 *   });
 *
 *   // Mark as read when user scrolls to bottom
 *   if (atBottom) unreadState.markAllAsRead();
 * </script>
 *
 * <div aria-live="polite" class="sr-only">
 *   {unreadState.announcerMessage}
 * </div>
 * ```
 */
export function useChatUnreadState(options?: UseChatUnreadStateOptions): UseChatUnreadStateReturn {
  const { announcerDebounceMs = 300, onUnreadIndicatorChange } = options ?? {};

  // Internal reactive state
  let unreadCount = $state(0);
  let newMessageIndicatorVisible = $state(false);
  let firstUnreadId = $state<string | null>(null);

  // Non-reactive bookkeeping (prevents $effect infinite loops)
  let previousMessageCount = 0;
  let previousLastMessageId: string | null = null;
  let previousConversationId: string | null = null;

  // Screen reader announcements - use debounce to batch rapid message arrivals
  const announcer = useAnnouncer({ debounceMs: announcerDebounceMs });

  // Derived display values
  const displayUnreadCount = $derived(formatUnreadCount(unreadCount));
  const hasLargeCount = $derived(isLargeCount(unreadCount));

  /**
   * Fire the indicator-change callback from the mutation sites that actually
   * change `unreadCount` / `newMessageIndicatorVisible`. Driving it here (rather
   * than from an `$effect`) avoids the spurious `{ unreadCount: 0,
   * newMessageIndicatorVisible: false }` notification that an effect would emit on
   * mount, and keeps the contract aligned with `onScrollStateChange`, which
   * only fires from its own mutation site.
   */
  function notifyIndicatorChange(): void {
    onUnreadIndicatorChange?.({
      unreadCount,
      newMessageIndicatorVisible,
    });
  }

  /**
   * Mark all messages as read (resets unread state).
   */
  function markAllAsRead(): void {
    const changed = unreadCount !== 0 || newMessageIndicatorVisible;
    unreadCount = 0;
    newMessageIndicatorVisible = false;
    firstUnreadId = null;
    if (changed) notifyIndicatorChange();
  }

  /**
   * Process messages to detect new arrivals and update unread state.
   * This should be called from an $effect in the parent component.
   *
   * @param getAtBottom - Getter function to read atBottom without creating a dependency.
   */
  function processMessages(
    messages: Message[],
    conversationId: string,
    getAtBottom: () => boolean,
  ): void {
    // Check if conversation has changed - reset tracking if so
    if (conversationId !== previousConversationId) {
      // Conversation switched - reset all tracking state
      previousMessageCount = messages.length;
      previousLastMessageId = messages.at(-1)?.id ?? null;
      previousConversationId = conversationId;
      // Reset all unread state when switching conversations
      markAllAsRead();
      return; // Don't trigger new message detection on conversation switch
    }

    const currentCount = messages.length;
    const prevCount = previousMessageCount;
    const currentLastMessageId = messages.at(-1)?.id ?? null;

    // Detect whether new messages were appended (vs prepended history)
    // Appended: last message ID changed AND count increased
    // Prepended: last message ID unchanged but count increased (history loaded)
    const wasAppended =
      currentCount > prevCount &&
      prevCount > 0 &&
      currentLastMessageId !== null &&
      currentLastMessageId !== previousLastMessageId;

    if (wasAppended) {
      // New messages arrived at the end
      // Read atBottom via getter to avoid creating a reactive dependency
      // The getter is called inside untrack to ensure no dependency tracking
      const atBottom = untrack(getAtBottom);

      if (!atBottom) {
        // User is reading history - show indicator
        const newMessageCount = currentCount - prevCount;
        unreadCount += newMessageCount;
        newMessageIndicatorVisible = true;

        // Set first unread ID if not already set
        // The first new message is at index (currentCount - newMessageCount)
        if (firstUnreadId === null) {
          const firstNewIndex = currentCount - newMessageCount;
          const firstNewMessage = messages[firstNewIndex];
          if (firstNewMessage) {
            firstUnreadId = firstNewMessage.id;
          }
        }

        // Announce to screen readers using accumulated unreadCount
        // (not newMessageCount) to handle debouncing correctly - if multiple
        // batches arrive within the debounce window, we announce the total
        announcer.announce(
          unreadCount === 1 ? 'New message received' : `${unreadCount} new messages received`,
        );

        // Notify the consumer at the mutation site so the callback reflects the
        // freshly-updated unread state and never fires spuriously on mount.
        notifyIndicatorChange();
      }
    }

    previousMessageCount = currentCount;
    previousLastMessageId = currentLastMessageId;
  }

  /**
   * Cleanup resources.
   */
  function destroy(): void {
    announcer.destroy();
  }

  return {
    get unreadCount() {
      return unreadCount;
    },
    get newMessageIndicatorVisible() {
      return newMessageIndicatorVisible;
    },
    get firstUnreadId() {
      return firstUnreadId;
    },
    get displayUnreadCount() {
      return displayUnreadCount;
    },
    get hasLargeCount() {
      return hasLargeCount;
    },
    get announcerMessage() {
      return announcer.message;
    },
    markAllAsRead,
    processMessages,
    destroy,
  };
}
