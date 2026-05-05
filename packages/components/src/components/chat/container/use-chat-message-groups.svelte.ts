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
  /** Tool result message IDs already represented inside a paired tool call group */
  readonly pairedToolResultIds: Set<string>;
}

// ==========================================================================
// Helper
// ==========================================================================

/** Find result message IDs that are already represented by paired tool-use messages. */
export function findPairedToolResultIds(messages: readonly Message[]): Set<string> {
  const visibleToolCallIds = new Set<string>();
  const pairedResultIds = new Set<string>();

  for (const message of messages) {
    if (message.role === 'tool-use' && message.toolCall) {
      visibleToolCallIds.add(message.toolCall.id);
    }
  }

  for (const message of messages) {
    if (
      message.role === 'tool-result' &&
      message.toolResult &&
      visibleToolCallIds.has(message.toolResult.callId)
    ) {
      pairedResultIds.add(message.id);
    }
  }

  return pairedResultIds;
}

/** Build visible messages with date separators, skipping paired tool-result messages. */
export function buildMessagesWithDateSeparators(
  messages: readonly Message[],
  pairedToolResultIds: ReadonlySet<string>,
): MessageWithDateItem[] {
  const result: MessageWithDateItem[] = [];
  let lastDate: string | null = null;

  for (const message of messages) {
    if (message.role === 'tool-result' && pairedToolResultIds.has(message.id)) {
      continue;
    }

    const timestamp = message.createdAt ?? message.metadata?.['timestamp'];
    if (timestamp != null) {
      const messageDate = new Date(timestamp);
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
}

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

  const pairedToolResultIds = $derived.by(() => findPairedToolResultIds(getMessages()));

  // Group messages by date for date separators
  const messagesWithDates = $derived.by(() => {
    return buildMessagesWithDateSeparators(getMessages(), pairedToolResultIds);
  });

  return {
    get messagesWithDates() {
      return messagesWithDates;
    },
    get toolCallPairsByCallId() {
      return toolCallPairsByCallId;
    },
    get pairedToolResultIds() {
      return pairedToolResultIds;
    },
  };
}
