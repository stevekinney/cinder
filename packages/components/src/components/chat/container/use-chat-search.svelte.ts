/**
 * Runes helper for in-conversation message search.
 *
 * Manages:
 * - Search query state
 * - Open/closed state for the search bar
 * - Derived list of matching messages (with their indices)
 * - Current match index for navigation
 */

import type { Message } from '../conversation-model.ts';
import { getMessageText } from '../utilities/utilities.js';

// ==========================================================================
// Types
// ==========================================================================

/** A single search result: message and its position in the messages array */
export interface ChatSearchMatch {
  /** The matching message */
  message: Message;
  /** Index of the message in the full messages array */
  messageIndex: number;
}

/** Options for the search helper */
export interface UseChatSearchOptions {
  /** Getter for the current list of messages */
  getMessages: () => Message[];
}

/** Return type for the search helper */
export interface UseChatSearchReturn {
  /** Current search query string */
  readonly query: string;
  /** Whether the search bar is open */
  readonly isOpen: boolean;
  /** All messages that match the current query */
  readonly matches: ChatSearchMatch[];
  /** Total number of matches */
  readonly matchCount: number;
  /** The currently highlighted match, or null if no matches */
  readonly currentMatch: ChatSearchMatch | null;
  /** Zero-based index of the current match within matches */
  readonly currentMatchIndex: number;
  /** Open the search bar */
  open(): void;
  /** Close the search bar and reset state */
  close(): void;
  /** Navigate to the next match (wraps around) */
  nextMatch(): void;
  /** Navigate to the previous match (wraps around) */
  previousMatch(): void;
  /** Update the search query and reset the current match to 0 */
  setQuery(value: string): void;
}

// ==========================================================================
// Helper
// ==========================================================================

/**
 * Creates reactive state and methods for in-conversation search.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { useChatSearch } from './use-chat-search.svelte';
 *
 *   const searchState = useChatSearch({
 *     getMessages: () => messages,
 *   });
 *
 *   // Open with Ctrl/Cmd+F
 *   function handleKeyDown(event: KeyboardEvent) {
 *     if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
 *       event.preventDefault();
 *       searchState.open();
 *     }
 *   }
 * </script>
 *
 * {#if searchState.isOpen}
 *   <ChatSearchBar
 *     query={searchState.query}
 *     matchCount={searchState.matchCount}
 *     currentMatchIndex={searchState.currentMatchIndex}
 *     onquerychange={searchState.setQuery}
 *     onnext={searchState.nextMatch}
 *     onprevious={searchState.previousMatch}
 *     onclose={searchState.close}
 *   />
 * {/if}
 * ```
 */
export function useChatSearch(options: UseChatSearchOptions): UseChatSearchReturn {
  const { getMessages } = options;

  // Reactive state
  let query = $state('');
  let isOpen = $state(false);
  let currentMatchIndex = $state(0);

  const matches = $derived.by((): ChatSearchMatch[] => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return [];

    const lowercasedQuery = trimmedQuery.toLowerCase();
    const messages = getMessages();

    return messages
      .map((message, messageIndex) => ({ message, messageIndex }))
      .filter(({ message }) => getMessageText(message).toLowerCase().includes(lowercasedQuery));
  });

  const matchCount = $derived(matches.length);

  // Clamp currentMatchIndex when the matches array shrinks (e.g., messages edited or deleted).
  // Derived instead of $effect so this works outside component context (e.g., in unit tests).
  const clampedMatchIndex = $derived(
    matchCount > 0 ? Math.min(currentMatchIndex, matchCount - 1) : 0,
  );

  const currentMatch = $derived(matches[clampedMatchIndex] ?? null);

  function open(): void {
    isOpen = true;
  }

  function close(): void {
    isOpen = false;
    query = '';
    currentMatchIndex = 0;
  }

  function nextMatch(): void {
    if (matchCount > 0) {
      currentMatchIndex = (clampedMatchIndex + 1) % matchCount;
    }
  }

  function previousMatch(): void {
    if (matchCount > 0) {
      currentMatchIndex = (clampedMatchIndex - 1 + matchCount) % matchCount;
    }
  }

  function setQuery(value: string): void {
    query = value;
    currentMatchIndex = 0;
  }

  return {
    get query() {
      return query;
    },
    get isOpen() {
      return isOpen;
    },
    get matches() {
      return matches;
    },
    get matchCount() {
      return matchCount;
    },
    get currentMatch() {
      return currentMatch;
    },
    get currentMatchIndex() {
      return clampedMatchIndex;
    },
    open,
    close,
    nextMatch,
    previousMatch,
    setQuery,
  };
}
