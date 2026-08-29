/**
 * Runes helper for chat keyboard navigation.
 *
 * Extracts keyboard event handling for:
 * - Home/End to jump to first/last message
 * - PageUp/PageDown for viewport scrolling
 * - Arrow keys for message-to-message navigation
 */

import { tick } from 'svelte';

// ==========================================================================
// Types
// ==========================================================================

/** Options for the keyboard navigation helper */
export interface UseChatKeyboardNavOptions {
  /** Callback when jump-to-latest is triggered (End key) */
  onJumpToLatest: () => void;
  /** Optional callback for virtualized top scrolling. */
  onJumpToStart?: () => void;
  /** Function that returns the appropriate scroll behavior based on user preference */
  getScrollBehavior: () => ScrollBehavior;
  /** Optional load-earlier trigger focus target. */
  getHistoryTrigger?: () => { focus: () => void } | null | undefined;
  /** Optional virtualized message navigation hook for off-window rows. */
  onVirtualMessageNavigation?: (direction: 'next' | 'previous') => boolean;
  /**
   * Whether the transcript is virtualized.
   *
   * Only virtualization makes a message row an unsafe focus target: the
   * virtualizer recycles rows, and focusing one that is later unmounted drops
   * focus to `<body>`, killing the container-bound shortcuts. In a plain
   * transcript the rows are stable, so focusing a message is both safe and
   * better — it scrolls the row into view and gives arrow navigation a starting
   * point, neither of which focusing the viewport does.
   */
  getIsVirtualized?: () => boolean;
}

/** Return type for the keyboard navigation helper */
export interface UseChatKeyboardNavReturn {
  /**
   * Handle keydown events for the chat container.
   * Should be attached to the container's onkeydown event.
   */
  handleKeyDown(event: KeyboardEvent, viewport: HTMLElement | null): void;
}

/**
 * Whether ArrowUp/ArrowDown should move between messages.
 *
 * True on a focused `.chat-message` — the ordinary case, stepping row to row.
 * Also true on the viewport ITSELF, which is what makes message navigation
 * reachable at all in a virtualized transcript: there `Home` focuses the
 * viewport (rows recycle, so they are unsafe focus targets), and without this
 * the very next ArrowDown would do nothing, leaving no keyboard route into the
 * transcript. `navigateMessages` already treats "nothing focused" as "start at
 * the first (or last) rendered message", so entry needs no special case.
 *
 * Focus inside a child interactive element — tool-approval buttons, suggestion
 * chips — is excluded, because those elements are neither the viewport nor
 * carry `chat-message`, and arrows belong to the control there.
 *
 * The cost is that arrows no longer scroll the focused viewport natively. That
 * is the better trade: navigation scrolls each target into view as it goes, so
 * the content still moves, and it moves in message-sized steps that match what
 * a screen reader announces.
 */
function canNavigateMessagesFrom(viewport: HTMLElement): boolean {
  const active = document.activeElement;
  return (
    active === viewport || (active?.matches('.chat-message, .chat-tool-call-timeline') ?? false)
  );
}

// ==========================================================================
// Helper
// ==========================================================================

/**
 * Creates keyboard navigation handlers for the chat container.
 *
 * Supports:
 * - `End`: Jump to latest message
 * - `Home`: Scroll to top and focus first message
 * - `PageDown`/`PageUp`: Scroll by 90% of viewport
 * - `ArrowDown`/`ArrowUp`: Navigate between messages when focused on a message
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { useChatKeyboardNav } from './use-chat-keyboard-nav.svelte.ts';
 *
 *   const keyboardNav = useChatKeyboardNav({
 *     onJumpToLatest: handleJumpToLatest,
 *     getScrollBehavior: () => prefersReducedMotion() ? 'auto' : 'smooth',
 *   });
 * </script>
 *
 * <div onkeydown={(e) => keyboardNav.handleKeyDown(e, viewport)}>
 *   <!-- chat content -->
 * </div>
 * ```
 */
export function useChatKeyboardNav(options: UseChatKeyboardNavOptions): UseChatKeyboardNavReturn {
  const {
    onJumpToLatest,
    onJumpToStart,
    getIsVirtualized,
    getScrollBehavior,
    getHistoryTrigger,
    onVirtualMessageNavigation,
  } = options;

  /**
   * Navigate to next or previous message.
   * Scrolls the focused message into view.
   */
  function navigateMessages(viewport: HTMLElement, direction: 'next' | 'previous'): void {
    const allMessages = viewport.querySelectorAll<HTMLElement>(
      '.chat-message, .chat-tool-call-timeline',
    );
    if (allMessages.length === 0) return;

    const currentIndex = Array.from(allMessages).findIndex((msg) => msg === document.activeElement);

    let targetIndex: number;
    if (currentIndex === -1) {
      // No message currently focused: default to first/last message based on direction
      targetIndex = direction === 'next' ? 0 : allMessages.length - 1;
    } else if (direction === 'next') {
      targetIndex = currentIndex < allMessages.length - 1 ? currentIndex + 1 : currentIndex;
    } else {
      targetIndex = currentIndex > 0 ? currentIndex - 1 : currentIndex;
    }

    const targetMessage = allMessages[targetIndex];
    if (targetMessage && targetMessage !== document.activeElement) {
      targetMessage.focus();
      targetMessage.scrollIntoView({ behavior: getScrollBehavior(), block: 'nearest' });
    }
  }

  /**
   * Text-editing element selectors where Home/End/PageUp/PageDown are used for
   * cursor/scroll movement within the element itself.
   *
   * We intentionally exclude `button` and `a` because those elements do not
   * consume these keys, and blocking viewport navigation when a message action
   * button is focused would silently break PageUp/PageDown for keyboard users.
   */
  const TEXT_EDITING_SELECTOR = 'input, textarea, select, [contenteditable]';

  /**
   * Handle keydown events for keyboard navigation.
   */
  function handleKeyDown(event: KeyboardEvent, viewport: HTMLElement | null): void {
    if (!viewport) return;

    // Don't intercept if focus is inside a text-editing element that uses
    // these keys for cursor movement (input, textarea, contenteditable, etc.).
    // Buttons and links do not consume Home/End/PageUp/PageDown, so they are
    // excluded from the guard to preserve viewport navigation for those cases.
    if (
      document.activeElement?.closest('.chat-input') ||
      document.activeElement?.matches(TEXT_EDITING_SELECTOR)
    )
      return;

    const behavior = getScrollBehavior();

    switch (event.key) {
      case 'End':
        event.preventDefault();
        onJumpToLatest();
        break;

      case 'Home':
        event.preventDefault();
        if (onJumpToStart) {
          onJumpToStart();
        } else {
          viewport.scrollTo({ top: 0, behavior });
        }
        // Focus the explicit history trigger first when present; otherwise focus
        // the first rendered message.
        void tick().then(
          () => {
            const historyTrigger = getHistoryTrigger?.();
            if (historyTrigger) {
              historyTrigger.focus();
              return undefined;
            }
            // Only a VIRTUALIZED row is an unsafe focus target: the virtualizer
            // recycles it, and removing the focused node drops focus to `<body>`,
            // killing every container-bound shortcut including the Home that just
            // ran. There the viewport — `tabindex="0"`, above the rows, never
            // unmounted — is the stable choice.
            //
            // In a plain transcript the rows are stable, and focusing the first
            // message is strictly better: it brings the row into view and gives
            // ArrowUp/ArrowDown somewhere to start. Focusing the viewport with
            // `preventScroll` would do neither, and `onJumpToStart` is a no-op
            // outside virtualization, so nothing else would scroll either.
            if (getIsVirtualized?.() ?? false) {
              viewport.focus({ preventScroll: true });
            } else {
              const firstMessage = viewport.querySelector<HTMLElement>(
                '.chat-message, .chat-tool-call-timeline',
              );
              if (firstMessage) firstMessage.focus();
              else viewport.focus({ preventScroll: true });
            }
            return undefined;
          },
          () => undefined,
        );
        break;

      case 'PageDown':
        event.preventDefault();
        viewport.scrollBy({ top: viewport.clientHeight * 0.9, behavior });
        break;

      case 'PageUp':
        event.preventDefault();
        viewport.scrollBy({ top: -viewport.clientHeight * 0.9, behavior });
        break;

      // Arrow key navigation between messages. Suppressed whenever the focused
      // element is NOT the `.chat-message` article itself (tabindex=-1). This
      // means focus inside any child interactive element (tool-approval buttons,
      // suggestion chips, etc.) is already excluded because those elements do
      // not have the `chat-message` class. The previous `.closest()` guards
      // were dead code: `closest()` traverses upward to ancestors, but
      // `[data-cinder-tool-approval]` and `[data-cinder-suggested-replies]` are
      // descendants — so they always returned null, making `!null` always true.
      case 'ArrowDown':
        if (canNavigateMessagesFrom(viewport)) {
          event.preventDefault();
          if (!onVirtualMessageNavigation?.('next')) {
            navigateMessages(viewport, 'next');
          }
        }
        break;

      case 'ArrowUp':
        if (canNavigateMessagesFrom(viewport)) {
          event.preventDefault();
          if (!onVirtualMessageNavigation?.('previous')) {
            navigateMessages(viewport, 'previous');
          }
        }
        break;
    }
  }

  return {
    handleKeyDown,
  };
}
