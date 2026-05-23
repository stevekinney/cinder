<script lang="ts" module>
  /**
   * Jump-to-latest button and new message indicator for the chat container.
   *
   * Displays:
   * - A jump button when scrolled far enough from bottom
   * - A centered "new messages" indicator in the hysteresis zone
   */
  export type ChatJumpControlsProps = {
    /** Whether the jump button should be visible */
    showJumpButton: boolean;
    /** Whether the new message indicator should be visible */
    hasNewMessageIndicator: boolean;
    /** Current unread message count */
    unreadCount: number;
    /** Formatted unread count for display (caps at "99+") */
    displayUnreadCount: string;
    /** Whether the count exceeds 99 (for compact badge styling) */
    hasLargeCount: boolean;
    /** Callback when jump-to-latest is clicked */
    onjumptolatest?: () => void;
  };
</script>

<script lang="ts">
  import { ChevronDown } from '../../icons/index.ts';

  let {
    showJumpButton,
    hasNewMessageIndicator,
    unreadCount,
    displayUnreadCount,
    hasLargeCount,
    onjumptolatest,
  }: ChatJumpControlsProps = $props();

  function handleJump(): void {
    onjumptolatest?.();
  }
</script>

<!-- Jump to Latest Button (shown when scrolled far enough) -->
{#if showJumpButton}
  <button
    type="button"
    class="chat-jump-button"
    onclick={handleJump}
    aria-label={unreadCount > 0
      ? `Jump to ${unreadCount} new message${unreadCount !== 1 ? 's' : ''}`
      : 'Jump to latest'}
  >
    <ChevronDown class="icon-sm" />
    {#if unreadCount > 0}
      <span class="chat-jump-badge" data-large={hasLargeCount || undefined}>
        {displayUnreadCount}
      </span>
    {/if}
  </button>
{/if}

<!-- New Message Indicator (centered toast-style, shows in hysteresis zone) -->
{#if hasNewMessageIndicator && !showJumpButton}
  <button
    type="button"
    class="chat-new-indicator"
    onclick={handleJump}
    aria-label="Jump to {displayUnreadCount} new message{unreadCount !== 1 ? 's' : ''}"
  >
    <ChevronDown class="icon-xs" />
    <span aria-hidden="true">{displayUnreadCount} new message{unreadCount !== 1 ? 's' : ''}</span>
  </button>
{/if}

<style>
  /* Jump to Latest Button
   * Uses --cinder-touch-target-min (44px) for WCAG 2.2 AA touch target compliance */
  .chat-jump-button {
    position: absolute;
    bottom: 100%;
    right: var(--cinder-space-4);
    margin-bottom: var(--cinder-space-2);
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--cinder-touch-target-min);
    height: var(--cinder-touch-target-min);
    padding: 0;
    /* --cinder-surface-raised does not exist in tokens; use --cinder-surface and
     * lean on the shadow + border for elevation against the inset chat timeline. */
    background: var(--cinder-surface);
    border: 1px solid var(--cinder-border);
    border-radius: var(--cinder-radius-full);
    box-shadow: var(--cinder-shadow-md);
    color: var(--cinder-text);
    cursor: pointer;
    transition:
      background var(--cinder-duration-fast) var(--cinder-ease-standard),
      box-shadow var(--cinder-duration-fast) var(--cinder-ease-standard),
      opacity var(--cinder-duration-fast) var(--cinder-ease-standard),
      transform var(--cinder-duration-fast) var(--cinder-ease-standard);
    z-index: var(--cinder-z-dropdown);
    animation: jump-button-enter var(--cinder-duration) var(--cinder-ease-decelerate);
  }

  @keyframes jump-button-enter {
    from {
      opacity: 0;
      transform: scale(0.8) translateY(0.5rem);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  @media (hover: hover) {
    .chat-jump-button:hover {
      background: var(--cinder-surface-hover);
      box-shadow: var(--cinder-shadow-lg);
    }
  }

  .chat-jump-button:focus-visible {
    outline: 2px solid transparent;
    box-shadow:
      0 0 0 var(--cinder-ring-offset) var(--cinder-ring-offset-color),
      0 0 0 calc(var(--cinder-ring-offset) + var(--cinder-ring-width)) var(--cinder-ring-color);
  }

  /* Unread Count Badge */
  .chat-jump-badge {
    position: absolute;
    top: calc(-1 * var(--cinder-space-1));
    right: calc(-1 * var(--cinder-space-1));
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 1.25rem;
    height: 1.25rem;
    padding: 0 var(--cinder-space-1);
    font-size: var(--cinder-text-3xs);
    font-weight: var(--cinder-font-semibold);
    background: var(--cinder-accent);
    color: var(--cinder-accent-contrast);
    border-radius: var(--cinder-radius-full);
  }

  .chat-jump-badge[data-large] {
    font-size: var(--cinder-text-4xs);
    padding: 0 var(--cinder-space-0-5);
  }

  /* New Message Indicator (centered)
   * Uses min-height for WCAG 2.2 AA touch target compliance */
  .chat-new-indicator {
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    margin-bottom: var(--cinder-space-2);
    display: inline-flex;
    align-items: center;
    gap: var(--cinder-space-1);
    min-height: var(--cinder-touch-target-min);
    padding: var(--cinder-space-1-5) var(--cinder-space-3);
    background: var(--cinder-accent);
    color: var(--cinder-accent-contrast);
    font-size: var(--cinder-text-xs);
    font-weight: var(--cinder-font-medium);
    border: none;
    border-radius: var(--cinder-radius-full);
    box-shadow: var(--cinder-shadow-lg);
    cursor: pointer;
    z-index: var(--cinder-z-dropdown);
    animation: slide-up var(--cinder-duration) var(--cinder-ease-decelerate);
  }

  .chat-new-indicator:hover {
    filter: brightness(0.95);
  }

  .chat-new-indicator:focus-visible {
    outline: 2px solid transparent;
    box-shadow:
      0 0 0 var(--cinder-ring-offset) var(--cinder-ring-offset-color),
      0 0 0 calc(var(--cinder-ring-offset) + var(--cinder-ring-width)) var(--cinder-ring-color),
      var(--cinder-shadow-lg);
  }

  @keyframes slide-up {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(100%);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .chat-jump-button {
      animation: none;
    }

    .chat-new-indicator {
      animation: none;
    }
  }

  /* Responsive adjustments */
  @container (max-width: 480px) {
    .chat-jump-button {
      right: var(--cinder-space-3);
    }
  }
</style>
