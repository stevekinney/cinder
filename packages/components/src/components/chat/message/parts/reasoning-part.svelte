<script lang="ts" module>
  import type { ReasoningMessagePart } from '../../utilities/types.ts';

  export type ReasoningPartProps = {
    /** The reasoning render part to display. */
    part: ReasoningMessagePart;
    /** Whether this reasoning block is expanded. Controlled by the parent (use-chat-reasoning-state). */
    expanded?: boolean;
    /** Called when the disclosure toggle is activated. */
    ontoggle?: (() => void) | undefined;
  };
</script>

<script lang="ts">
  let { part, expanded = false, ontoggle }: ReasoningPartProps = $props();

  const labelId = $derived(`reasoning-label-${part.key.replace(/[^a-z0-9-]/gi, '-')}`);
  const contentId = $derived(`reasoning-content-${part.key.replace(/[^a-z0-9-]/gi, '-')}`);

  // Approximate token count — 1 token ≈ 4 characters (rough heuristic for display).
  const approximateTokenCount = $derived(Math.round(part.content.length / 4));
  const tokenDisplay = $derived(
    approximateTokenCount > 0 ? ` (${approximateTokenCount.toLocaleString()} tokens)` : '',
  );

  // The polite "Reasoning complete." announcement fires ONLY on a streaming
  // true→false transition — not on a reasoning block that was never streaming
  // (a static historical block must stay silent). We observe the transition edge
  // here: this effect's sole job is to record that a stream just ended, which is
  // observing an external lifecycle ("a stream finished"), not deriving state
  // from state. `announced` flips to true on the edge and back to false when a
  // new stream starts, so the live region fires once per streaming session.
  let wasStreaming = false;
  let announced = $state(false);
  $effect(() => {
    const streaming = part.streaming;
    if (streaming) {
      announced = false;
    } else if (wasStreaming) {
      announced = true;
    }
    wasStreaming = streaming;
  });
  const announcementText = $derived(announced ? 'Reasoning complete.' : '');

  function handleToggle(): void {
    if (!part.streaming) {
      ontoggle?.();
    }
  }
</script>

<!--
  Reasoning disclosure. Collapsed by default; the toggle button is disabled
  while streaming to prevent mid-stream layout jank. The expanded region uses
  aria-live="off" during streaming (token-by-token updates must not interrupt
  the screen reader) — one polite "Reasoning complete." fires when streaming ends.
  The grid-template-rows 0fr→1fr transition avoids max-height clamping artifacts.
-->
<div
  class="chat-reasoning"
  data-cinder-reasoning
  data-cinder-streaming={part.streaming ? '' : undefined}
  data-cinder-expanded={expanded ? '' : undefined}
>
  <button
    type="button"
    class="chat-reasoning-toggle"
    id={labelId}
    aria-expanded={expanded}
    aria-controls={contentId}
    disabled={part.streaming}
    onclick={handleToggle}
  >
    <span class="chat-reasoning-label" aria-hidden="true">
      {#if part.streaming}
        <span class="chat-reasoning-dot" aria-hidden="true"></span>
      {/if}
      Reasoning{tokenDisplay}
    </span>
    <span class="sr-only">
      {#if part.streaming}
        Reasoning in progress
      {:else if expanded}
        Collapse reasoning
      {:else}
        Expand reasoning
      {/if}
    </span>
    <span class="chat-reasoning-chevron" aria-hidden="true">
      {expanded ? '▲' : '▼'}
    </span>
  </button>

  <!-- The controlled region carries `id`/`aria-hidden` on the SAME element the
       toggle's aria-controls points at, so the relationship is never to an
       element buried inside an aria-hidden subtree. When collapsed it is hidden
       from AT and removed from the tab order. -->
  <div class="chat-reasoning-body">
    <div
      id={contentId}
      class="chat-reasoning-content"
      aria-hidden={!expanded}
      aria-live={part.streaming ? 'off' : undefined}
      aria-busy={part.streaming ? true : undefined}
    >
      {part.content}
    </div>
  </div>

  <!-- Always-present polite live region. Fires "Reasoning complete." once when
       streaming ends (part.streaming: true→false). Clearing on resume ensures it
       fires again on subsequent streams. The element must be in the DOM before
       content is set so screen readers have already registered it as a live region. -->
  <div class="sr-only" aria-live="polite" aria-atomic="true">{announcementText}</div>
</div>

<style>
  .chat-reasoning {
    --cinder-chat-reasoning-bg: var(--cinder-surface-inset);
    --cinder-chat-reasoning-border: var(--cinder-border);
    --cinder-chat-reasoning-text: var(--cinder-text-muted);

    display: flex;
    flex-direction: column;
    border-inline-start: 2px solid var(--cinder-chat-reasoning-border);
    background: var(--cinder-chat-reasoning-bg);
    border-radius: 0 var(--cinder-radius-md) var(--cinder-radius-md) 0;
    overflow: hidden;
  }

  .chat-reasoning-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--cinder-space-2);
    padding-block: var(--cinder-space-2);
    padding-inline: var(--cinder-space-3);
    min-block-size: var(--cinder-touch-target-min, 44px);
    background: transparent;
    border: none;
    cursor: pointer;
    text-align: start;
    font-size: var(--cinder-text-xs);
    font-weight: var(--cinder-font-medium);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--cinder-chat-reasoning-text);
    font-style: italic;
    width: 100%;

    &:disabled {
      cursor: default;
    }

    @media (hover: hover) {
      &:not(:disabled):hover {
        color: var(--cinder-text);
        background: color-mix(in oklch, var(--cinder-chat-reasoning-bg), transparent 20%);
      }
    }

    &:focus-visible {
      outline: var(--cinder-ring-width) solid transparent;
      outline-offset: -2px;
      box-shadow: var(--_cinder-focus-ring-shadow);
    }
  }

  .chat-reasoning-label {
    display: flex;
    align-items: center;
    gap: var(--cinder-space-2);
    flex: 1;
  }

  .chat-reasoning-chevron {
    flex-shrink: 0;
    font-size: 0.625rem;
    opacity: 0.6;
  }

  /* Pulsing dot during streaming — opacity-only, respects prefers-reduced-motion */
  .chat-reasoning-dot {
    display: inline-block;
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    background: var(--cinder-chat-reasoning-border);
    animation: chat-reasoning-pulse 1.2s ease-in-out infinite;
    flex-shrink: 0;
  }

  @keyframes chat-reasoning-pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.25;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .chat-reasoning-dot {
      animation: none;
      opacity: 0.6;
    }
  }

  /* Expand/collapse via grid-template-rows (avoids max-height clamping) */
  .chat-reasoning-body {
    display: grid;
    grid-template-rows: 0fr;
    transition: grid-template-rows var(--cinder-duration) var(--cinder-ease-standard);
  }

  [data-cinder-expanded] .chat-reasoning-body {
    grid-template-rows: 1fr;
  }

  @media (prefers-reduced-motion: reduce) {
    .chat-reasoning-body {
      transition: none;
    }
  }

  .chat-reasoning-content {
    max-block-size: 16rem;
    overflow-y: auto;
    /* Hidden + non-focusable while collapsed. A scrollable region with
       overflow-y:auto is keyboard-focusable in some browsers even at zero
       height; visibility:hidden removes it from the tab order (and from AT),
       complementing aria-hidden. The parent grid (0fr) clips it visually. */
    visibility: hidden;
    padding-block: var(--cinder-space-2);
    padding-inline: var(--cinder-space-3);
    font-size: var(--cinder-text-sm);
    color: var(--cinder-chat-reasoning-text);
    line-height: var(--cinder-leading-relaxed, 1.625);
    white-space: pre-wrap;
    word-break: break-word;
  }

  [data-cinder-expanded] .chat-reasoning-content {
    visibility: visible;
  }

  /* Forced-colors: the decorative pulse dot and the accent rail use background/
     border colors the system overrides, so pin them to a system color. The
     box-shadow focus ring also disappears, so fall back to a system outline. */
  @media (forced-colors: active) {
    .chat-reasoning {
      border-inline-start-color: ButtonText;
    }

    .chat-reasoning-dot {
      background: ButtonText;
      forced-color-adjust: none;
    }

    .chat-reasoning-toggle:focus-visible {
      outline: var(--cinder-ring-width) solid ButtonText;
      outline-offset: -2px;
    }
  }

  /* Screen reader only */
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
