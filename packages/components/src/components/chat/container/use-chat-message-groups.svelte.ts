/**
 * Runes helper for chat message grouping and tool call pairing.
 *
 * Extracts derived values for:
 * - Messages grouped with date separators
 * - Tool call pairs indexed by call ID for O(1) lookup
 */

import type { Message, ToolCallPair } from 'conversationalist';
import { pairToolCallsWithResults } from 'conversationalist';

// ==========================================================================
// Types
// ==========================================================================

/** Date separator item in the message list */
export type DateItem = {
  type: 'date';
  date: Date;
};

/** Message item in the message list */
export type MessageItem = {
  type: 'message';
  message: Message;
};

/** Union type for items in the messages-with-dates list */
export type MessageWithDateItem = DateItem | MessageItem;

// Re-export ToolCallPair type from conversationalist for convenience
export type { ToolCallPair } from 'conversationalist';

/** Options for the message groups helper */
export interface UseChatMessageGroupsOptions {
  /** Function that returns the current messages array */
  getMessages: () => Message[];
}

/** Return type for the message groups helper */
export interface UseChatMessageGroupsReturn {
  /** Messages interleaved with date separators */
  readonly messagesWithDates: MessageWithDateItem[];
  /** Map of tool call ID to tool call pairs for O(1) lookup */
  readonly toolCallPairsByCallId: Map<string, ToolCallPair[]>;
}

// ==========================================================================
// Helper
// ==========================================================================

/**
 * Creates reactive derived values for message grouping and tool call pairing.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { useChatMessageGroups } from './use-chat-message-groups.svelte';
 *
 *   const messageGroups = useChatMessageGroups({
 *     getMessages: () => messages,
 *   });
 *
 *   // Access derived values
 *   const items = messageGroups.messagesWithDates;
 *   const pairs = messageGroups.toolCallPairsByCallId.get(callId);
 * </script>
 * ```
 */
export function useChatMessageGroups(
  options: UseChatMessageGroupsOptions,
): UseChatMessageGroupsReturn {
  const { getMessages } = options;

  // Derive tool call pairs from messages
  const toolCallPairs = $derived(pairToolCallsWithResults(getMessages()));

  // Build a Map for O(1) lookup of tool call pairs by call ID
  // Note: Using plain Map instead of SvelteMap since the map is recreated
  // on each derivation (not mutated), so reactive wrapper is unnecessary
  const toolCallPairsByCallId = $derived.by(() => {
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- Map is recreated on each derivation, not mutated
    const map = new Map<string, ToolCallPair[]>();
    for (const pair of toolCallPairs) {
      const existing = map.get(pair.call.id);
      if (existing) {
        existing.push(pair);
      } else {
        map.set(pair.call.id, [pair]);
      }
    }
    return map;
  });

  // Group messages by date for date separators
  const messagesWithDates = $derived.by(() => {
    const messages = getMessages();
    const result: MessageWithDateItem[] = [];
    let lastDate: string | null = null;

    for (const message of messages) {
      const timestamp = message.createdAt ?? message.metadata?.['timestamp'];
      if (timestamp != null) {
        // eslint-disable-next-line svelte/prefer-svelte-reactivity -- Date is created fresh each derivation, not mutated
        const messageDate = new Date(timestamp);
        // Validate date before using - invalid dates have NaN getTime()
        const isValidDate = !isNaN(messageDate.getTime());
        if (isValidDate) {
          const dateKey = messageDate.toDateString();

          if (dateKey !== lastDate) {
            result.push({ type: 'date', date: messageDate });
            lastDate = dateKey;
          }
        }
      }
      result.push({ type: 'message', message });
    }

    return result;
  });

  return {
    get messagesWithDates() {
      return messagesWithDates;
    },
    get toolCallPairsByCallId() {
      return toolCallPairsByCallId;
    },
  };
}
