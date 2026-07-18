<script lang="ts" module>
  /**
   * Search bar for in-conversation message search.
   *
   * Renders an input field, match counter, navigation buttons, and a close button.
   * Auto-focuses the input when mounted.
   *
   * Keyboard shortcuts:
   * - Enter: next match
   * - Shift+Enter: previous match
   * - Escape: close
   */
  export type ChatSearchBarProps = {
    /**
     * Unique namespace for this search bar's ARIA IDs.
     * Must match the `id` prop of the parent chat component so that multiple
     * chat instances on the same page do not produce duplicate DOM IDs.
     */
    instanceId: string;
    /** Current search query */
    query: string;
    /** Total number of matches */
    matchCount: number;
    /** Zero-based index of the current match */
    currentMatchIndex: number;
    /** Called when the user changes the query */
    onquerychange: (query: string) => void;
    /** Called when the user requests the next match */
    onnext: () => void;
    /** Called when the user requests the previous match */
    onprevious: () => void;
    /** Called when the user closes the search bar */
    onclose: () => void;
  };
</script>

<script lang="ts">
  import type { Attachment } from 'svelte/attachments';
  import { ChevronDown, ChevronUp, Search, X } from '@lostgradient/cinder/icons';

  let {
    instanceId,
    query,
    matchCount,
    currentMatchIndex,
    onquerychange,
    onnext,
    onprevious,
    onclose,
  }: ChatSearchBarProps = $props();

  const searchResultsId = $derived(`${instanceId}-search-results`);

  let inputElement = $state<HTMLInputElement | null>(null);

  // Auto-focus attachment: focuses the input element when it mounts
  const autoFocus: Attachment<HTMLInputElement> = (element) => {
    element.focus();
    inputElement = element;
  };

  /**
   * Programmatically focus the search input.
   * Used by the container to refocus when Ctrl+F is pressed while search is already open.
   */
  export function focusInput(): void {
    inputElement?.focus();
  }

  const matchLabel = $derived.by(() => {
    if (!query.trim()) return '';
    if (matchCount === 0) return 'No matches';
    return `${currentMatchIndex + 1} of ${matchCount}`;
  });

  const hasQuery = $derived(query.trim().length > 0);

  function handleInput(event: Event): void {
    const target = event.currentTarget as HTMLInputElement;
    onquerychange(target.value);
  }

  function handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      onclose();
    } else if (event.key === 'Enter' && matchCount > 0) {
      event.preventDefault();
      if (event.shiftKey) {
        onprevious();
      } else {
        onnext();
      }
    }
  }
</script>

<div class="chat-search-bar" role="search" aria-label="Search messages">
  <span class="chat-search-icon" aria-hidden="true">
    <Search class="cinder-icon-sm" />
  </span>

  <input
    {@attach autoFocus}
    type="search"
    class="chat-search-input"
    placeholder="Search messages…"
    value={query}
    autocomplete="off"
    aria-label="Search messages"
    aria-controls={hasQuery ? searchResultsId : undefined}
    oninput={handleInput}
    onkeydown={handleKeyDown}
  />

  {#if hasQuery}
    <span
      id={searchResultsId}
      class="chat-search-match-count"
      aria-live="polite"
      aria-atomic="true"
    >
      {matchLabel}
    </span>
  {/if}

  <div class="chat-search-navigation" role="group" aria-label="Navigate search results">
    <button
      type="button"
      class="chat-search-nav-button"
      onclick={onprevious}
      disabled={matchCount === 0}
      aria-label="Previous match"
      title="Previous match (Shift+Enter)"
    >
      <ChevronUp class="cinder-icon-sm" />
    </button>

    <button
      type="button"
      class="chat-search-nav-button"
      onclick={onnext}
      disabled={matchCount === 0}
      aria-label="Next match"
      title="Next match (Enter)"
    >
      <ChevronDown class="cinder-icon-sm" />
    </button>
  </div>

  <button
    type="button"
    class="chat-search-close"
    onclick={onclose}
    aria-label="Close search"
    title="Close search (Escape)"
  >
    <X class="cinder-icon-sm" />
  </button>
</div>

<style>
  .chat-search-bar {
    display: flex;
    align-items: center;
    gap: var(--cinder-space-1);
    padding: var(--cinder-space-2) var(--cinder-space-3);
    background: var(--cinder-surface-raised);
    border-bottom: 1px solid var(--cinder-border);
    flex-shrink: 0;
  }

  .chat-search-icon {
    display: flex;
    align-items: center;
    color: var(--cinder-text-muted);
    flex-shrink: 0;
  }

  .chat-search-input {
    flex: 1;
    min-width: 0;
    padding: var(--cinder-space-1) var(--cinder-space-2);
    font-size: var(--cinder-text-sm);
    color: var(--cinder-text);
    background: transparent;
    border: none;
    outline: none;
  }

  /* Remove browser default search input chrome */
  .chat-search-input::-webkit-search-cancel-button,
  .chat-search-input::-webkit-search-decoration {
    display: none;
  }

  .chat-search-match-count {
    flex-shrink: 0;
    font-size: var(--cinder-text-xs);
    color: var(--cinder-text-muted);
    white-space: nowrap;
    padding: 0 var(--cinder-space-1);
  }

  .chat-search-navigation {
    display: flex;
    align-items: center;
    gap: var(--cinder-space-0-5);
    flex-shrink: 0;
  }

  .chat-search-nav-button,
  .chat-search-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--cinder-space-7);
    height: var(--cinder-space-7);
    padding: 0;
    color: var(--cinder-text-muted);
    background: transparent;
    border: none;
    border-radius: var(--cinder-radius-sm);
    cursor: pointer;
    transition:
      background var(--cinder-duration-fast) var(--cinder-ease-standard),
      color var(--cinder-duration-fast) var(--cinder-ease-standard);
  }

  @media (hover: hover) {
    .chat-search-nav-button:hover,
    .chat-search-close:hover {
      background: var(--cinder-surface-hover);
      color: var(--cinder-text);
    }
  }

  .chat-search-nav-button:focus-visible,
  .chat-search-close:focus-visible {
    outline: var(--cinder-ring-width) solid transparent;
    box-shadow: var(--_cinder-focus-ring-shadow);
  }

  @media (forced-colors: active) {
    .chat-search-nav-button:focus-visible,
    .chat-search-close:focus-visible {
      outline: var(--cinder-ring-width) solid ButtonText;
      outline-offset: 3px;
    }
  }

  .chat-search-nav-button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  @media (hover: hover) {
    .chat-search-nav-button:disabled:hover {
      background: transparent;
      color: var(--cinder-text-muted);
    }
  }
</style>
