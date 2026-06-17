<script lang="ts" module>
  /**
   * Per-participant typing indicator for the Chat component.
   *
   * A single always-in-DOM outer `<div>` wrapper sits above the bottom sentinel in
   * the message timeline. Its text is empty when nobody is typing (the outer wrapper
   * is never removed from the DOM). The inner `.chat-participant-typing-indicator`
   * div mounts/unmounts via `{#if isActive}` — this is intentional so the
   * entrance animation replays on each new typing event.
   *
   * The aria-live announcement region is NOT emitted by this component. It lives in
   * chat.svelte as a sibling of `ChatStatusAnnouncer`, outside the `role="log"` div,
   * to prevent double-announcement from nested live regions. This component handles
   * the visual rendering only.
   *
   * Accessibility:
   *   - The outer wrapper is `aria-hidden="true"` — AT users receive the typing
   *     announcement from the dedicated live region in the container.
   *   - data-cinder-participant-typing set when participantCount > 0.
   *   - data-cinder-participant-count reflects the exact count.
   *
   * Reduced motion: switches the entrance animation to an opacity fade.
   */
  export type ChatParticipantTypingProps = {
    /** The visible typing label (e.g. "Alice is typing…"). Empty string when nobody is typing. */
    typingLabel: string;
    /** Total number of currently-typing participants. */
    participantCount: number;
  };
</script>

<script lang="ts">
  let { typingLabel, participantCount }: ChatParticipantTypingProps = $props();

  const isActive = $derived(participantCount > 0);
</script>

<div
  class="chat-participant-typing"
  data-cinder-participant-typing={isActive ? '' : undefined}
  data-cinder-participant-count={participantCount}
  aria-hidden="true"
>
  {#if isActive}
    <div class="chat-participant-typing-indicator">
      <span class="chat-typing-dot" aria-hidden="true"></span>
      <span class="chat-typing-dot" aria-hidden="true"></span>
      <span class="chat-typing-dot" aria-hidden="true"></span>
      <span class="chat-participant-typing-label">{typingLabel}</span>
    </div>
  {/if}
</div>

<style>
  .chat-participant-typing {
    /* Reserve no space when empty — the inner content drives height. */
    min-height: 0;
  }

  .chat-participant-typing-indicator {
    display: flex;
    align-items: center;
    gap: var(--cinder-space-1-5);
    padding: var(--cinder-space-2) var(--cinder-space-3);
    max-width: max-content;
    background: var(--cinder-surface-raised);
    border-radius: var(--cinder-radius-lg);
    animation: participant-typing-enter var(--cinder-duration) var(--cinder-ease-decelerate);
  }

  @keyframes participant-typing-enter {
    from {
      opacity: 0;
      transform: translateY(0.25rem);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .chat-participant-typing-indicator {
      animation: participant-typing-fade var(--cinder-duration) ease;
    }

    @keyframes participant-typing-fade {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }
  }

  .chat-participant-typing-label {
    font-size: var(--cinder-text-sm);
    color: var(--cinder-text-muted);
  }

  /* Dot size matches the AI-streaming typing indicator in chat.svelte (0.5rem / -0.25rem bounce). */
  .chat-typing-dot {
    width: 0.5rem;
    height: 0.5rem;
    background: var(--cinder-text-muted);
    border-radius: var(--cinder-radius-full);
    flex-shrink: 0;
    animation: typing-bounce 1.4s ease-in-out infinite;
  }

  .chat-typing-dot:nth-child(1) {
    animation-delay: 0s;
  }

  .chat-typing-dot:nth-child(2) {
    animation-delay: 0.2s;
  }

  .chat-typing-dot:nth-child(3) {
    animation-delay: 0.4s;
  }

  @keyframes typing-bounce {
    0%,
    60%,
    100% {
      opacity: 0.4;
      transform: translateY(0);
    }
    30% {
      opacity: 1;
      transform: translateY(-0.25rem);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .chat-typing-dot {
      animation: typing-pulse 1.4s ease-in-out infinite;
    }

    @keyframes typing-pulse {
      0%,
      100% {
        opacity: 0.4;
      }
      50% {
        opacity: 1;
      }
    }
  }
</style>
