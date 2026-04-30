/**
 * Pure utility functions for scroll position calculations and unread tracking.
 *
 * These functions are intentionally pure (no DOM access) for testability.
 * They accept scroll state as input and return computed values.
 */

import type { Message } from 'conversationalist';

/**
 * Represents the scroll state of a container element.
 * These values come from HTMLElement scroll properties.
 */
export type ScrollState = {
  /** Current scroll position from top (scrollTop) */
  scrollTop: number;
  /** Total scrollable height (scrollHeight) */
  scrollHeight: number;
  /** Visible viewport height (clientHeight) */
  clientHeight: number;
};

/**
 * Configuration for scroll behavior thresholds.
 */
export type ScrollConfiguration = {
  /**
   * Pixels from bottom to consider "at bottom".
   * A generous threshold handles:
   * - Fractional pixel values on high-DPI displays
   * - Imprecise touch scrolling
   * - Small layout shifts from loading content
   * @default 150
   */
  bottomThreshold: number;

  /**
   * Pixels scrolled up before showing jump-to-latest button.
   * Slightly larger than bottomThreshold to create hysteresis
   * (prevents button flickering near the threshold).
   * @default 200
   */
  jumpThreshold: number;
};

/**
 * Default scroll configuration values.
 *
 * The 150px bottom threshold accommodates 2-3 message previews,
 * which matches user mental models of "being at the end".
 */
export const DEFAULT_SCROLL_CONFIGURATION: ScrollConfiguration = {
  bottomThreshold: 150,
  jumpThreshold: 200,
};

/**
 * Determines if the scroll position is at or near the bottom.
 *
 * Used to decide whether to auto-scroll when new messages arrive.
 * If true, new messages should trigger scroll-to-bottom.
 * If false, the user is reading history and scroll should not change.
 *
 * @param state - Current scroll state from the container
 * @param threshold - Pixels from bottom to consider "at bottom"
 * @returns true if within threshold of the bottom
 */
export function isAtBottom(state: ScrollState, threshold: number): boolean {
  const distanceFromBottom = state.scrollHeight - state.scrollTop - state.clientHeight;
  // Handle edge case where content is shorter than viewport
  // (scrollHeight <= clientHeight means user is always "at bottom")
  return distanceFromBottom <= threshold || state.scrollHeight <= state.clientHeight;
}

/**
 * Determines if the jump-to-latest button should be visible.
 *
 * Uses a separate (larger) threshold than isAtBottom to create hysteresis,
 * preventing the button from flickering when scrolling near the threshold.
 *
 * @param state - Current scroll state from the container
 * @param threshold - Pixels from bottom before showing button
 * @returns true if scrolled far enough from bottom to show button
 */
export function shouldShowJumpToLatest(state: ScrollState, threshold: number): boolean {
  const distanceFromBottom = state.scrollHeight - state.scrollTop - state.clientHeight;
  // Don't show if content fits in viewport
  if (state.scrollHeight <= state.clientHeight) {
    return false;
  }
  return distanceFromBottom > threshold;
}

/**
 * Extracts a comparable timestamp value from a message.
 * Messages use ISO 8601 strings for createdAt (e.g., "2024-01-15T10:30:00.000Z").
 *
 * @param message - Message to extract timestamp from
 * @returns Timestamp as milliseconds since epoch, or null if not available
 */
function getMessageTimestamp(message: Message): number | null {
  // createdAt is an ISO 8601 string
  if (message.createdAt) {
    const parsed = Date.parse(message.createdAt);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  // Fallback to metadata.timestamp if present (may be number or string)
  const metaTimestamp = message.metadata?.['timestamp'];
  if (typeof metaTimestamp === 'number') {
    return metaTimestamp;
  }
  if (typeof metaTimestamp === 'string') {
    const parsed = Date.parse(metaTimestamp);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return null;
}

/**
 * Calculates the number of unread messages based on timestamp.
 *
 * @param messages - Array of messages with timestamps
 * @param lastReadTimestamp - Timestamp of the last read message in milliseconds (0 if none read)
 * @returns Count of messages with timestamp > lastReadTimestamp
 */
export function calculateUnreadCount(messages: Message[], lastReadTimestamp: number): number {
  if (lastReadTimestamp === 0) {
    // If nothing has been read, all messages are "unread"
    // But we typically don't count initial load as unread
    return 0;
  }
  return messages.filter((message) => {
    const timestamp = getMessageTimestamp(message);
    return timestamp != null && timestamp > lastReadTimestamp;
  }).length;
}

/**
 * Finds the index where unread messages begin.
 *
 * This is used to insert the "unread divider" in the message list.
 *
 * @param messages - Array of messages with timestamps
 * @param lastReadTimestamp - Timestamp of the last read message in milliseconds
 * @returns Index of first unread message, or -1 if all messages are read
 */
export function findUnreadBoundaryIndex(messages: Message[], lastReadTimestamp: number): number {
  if (lastReadTimestamp === 0) {
    return -1; // No unread boundary for initial load
  }
  return messages.findIndex((message) => {
    const timestamp = getMessageTimestamp(message);
    return timestamp != null && timestamp > lastReadTimestamp;
  });
}

/**
 * Calculates the scroll position needed to scroll to bottom.
 *
 * @param state - Current scroll state
 * @returns The scrollTop value that would scroll to bottom
 */
export function calculateScrollToBottom(state: ScrollState): number {
  return Math.max(0, state.scrollHeight - state.clientHeight);
}

/**
 * Formats the unread count for display.
 * Caps at 99+ to prevent badge overflow.
 *
 * @param count - Raw unread count
 * @returns Formatted string for display ("1", "50", "99+")
 */
export function formatUnreadCount(count: number): string {
  if (count <= 0) return '';
  if (count > 99) return '99+';
  return count.toString();
}

/**
 * Determines if a count should be displayed with compact styling.
 * Used to adjust badge styling for large numbers.
 *
 * @param count - Raw unread count
 * @returns true if count exceeds 99
 */
export function isLargeCount(count: number): boolean {
  return count > 99;
}

/**
 * Extracts a numeric timestamp from a message for comparison.
 * Exported for use in components that need to track last-read timestamps.
 *
 * @param message - Message to extract timestamp from
 * @returns Timestamp as milliseconds since epoch, or current time if not available
 */
export function extractTimestamp(message: Message): number {
  return getMessageTimestamp(message) ?? Date.now();
}
