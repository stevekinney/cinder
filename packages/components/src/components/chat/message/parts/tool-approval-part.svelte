<script lang="ts" module>
  import type { ToolApprovalMessagePart } from '../../utilities/types.ts';

  export type ToolApprovalPartProps = {
    /** The tool-approval render part. */
    part: ToolApprovalMessagePart;
    /** Called when the user approves the action. */
    onapprove?: ((toolCallId: string) => void) | undefined;
    /** Called when the user denies the action. */
    ondeny?: ((toolCallId: string) => void) | undefined;
  };
</script>

<script lang="ts">
  import { stringify } from '../../../../utilities/stringify.ts';

  let { part, onapprove, ondeny }: ToolApprovalPartProps = $props();

  const isPending = $derived(part.approved === undefined);
  const isApproved = $derived(part.approved === true);
  const isDenied = $derived(part.approved === false);

  const actionMessage = $derived(
    part.action.message ?? 'This tool call requires your approval before it can continue.',
  );

  const actionSchema = $derived(
    part.action.schema !== undefined ? stringify(part.action.schema) : undefined,
  );

  // Tool-call ids are external data (may contain whitespace, ':', etc. that make
  // invalid/duplicate DOM ids). Sanitize from the stable part key, mirroring
  // reasoning-part, so aria-labelledby/aria-describedby always resolve.
  const safeKey = $derived(part.key.replace(/[^a-z0-9-]/gi, '-'));
  const labelId = $derived(`tool-approval-label-${safeKey}`);
  const descId = $derived(`tool-approval-desc-${safeKey}`);

  function handleApprove(): void {
    if (!isPending) return;
    onapprove?.(part.toolCallId);
  }

  function handleDeny(): void {
    if (!isPending) return;
    ondeny?.(part.toolCallId);
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && isPending) {
      handleDeny();
    }
  }
</script>

<!--
  Tool approval prompt. This is an INLINE timeline item, not a modal overlay, so
  it uses role="group" (labelled + described) rather than role="alertdialog":
  alertdialog implies modal/interruption semantics and would let any pending row
  (incl. historical/virtualized rows) steal focus on render. The assertive
  announcement is owned by ChatStatusAnnouncer instead. tabindex="-1" makes the
  container programmatically focusable and the Escape→reject keydown reliable.
-->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  class="chat-tool-approval"
  role="group"
  tabindex="-1"
  aria-labelledby={labelId}
  aria-describedby={descId}
  data-cinder-tool-approval
  data-cinder-status={isApproved ? 'approved' : isDenied ? 'denied' : 'pending'}
  onkeydown={handleKeydown}
>
  <div class="chat-tool-approval-header">
    <span class="chat-tool-approval-icon" aria-hidden="true">
      {#if isApproved}
        ✓
      {:else if isDenied}
        ✕
      {:else}
        ⚠
      {/if}
    </span>
    <span id={labelId} class="chat-tool-approval-title">
      {#if isApproved}
        Approved: <code class="chat-tool-approval-name">{part.toolName}</code>
      {:else if isDenied}
        Denied: <code class="chat-tool-approval-name">{part.toolName}</code>
      {:else}
        Action required: <code class="chat-tool-approval-name">{part.toolName}</code>
      {/if}
    </span>
  </div>

  <p id={descId} class="chat-tool-approval-message">{actionMessage}</p>

  {#if actionSchema !== undefined}
    <details class="chat-tool-approval-args">
      <summary class="chat-tool-approval-args-toggle">View parameters</summary>
      <pre class="chat-tool-approval-args-code"><code>{actionSchema}</code></pre>
    </details>
  {/if}

  {#if isPending}
    <div class="chat-tool-approval-actions">
      <button
        type="button"
        class="chat-tool-approval-btn chat-tool-approval-btn-approve"
        onclick={handleApprove}
        disabled={onapprove === undefined}
      >
        Approve
      </button>
      <button
        type="button"
        class="chat-tool-approval-btn chat-tool-approval-btn-deny"
        onclick={handleDeny}
        disabled={ondeny === undefined}
      >
        Reject
      </button>
    </div>
  {/if}
</div>

<style>
  .chat-tool-approval {
    --cinder-chat-tool-approval-bg: var(--cinder-surface-raised);
    --cinder-chat-tool-approval-border: var(--cinder-border);
    --cinder-chat-tool-approval-approve-color: var(--cinder-color-success-fg);
    --cinder-chat-tool-approval-deny-color: var(--cinder-color-danger-fg);

    display: flex;
    flex-direction: column;
    gap: var(--cinder-space-3);
    padding: var(--cinder-space-4);
    background: var(--cinder-chat-tool-approval-bg);
    border: 1px solid var(--cinder-chat-tool-approval-border);
    border-radius: var(--cinder-radius-md);
    inline-size: 100%;
  }

  .chat-tool-approval[data-cinder-status='approved'] {
    border-color: var(--cinder-color-success-border, var(--cinder-chat-tool-approval-border));
  }

  .chat-tool-approval[data-cinder-status='denied'] {
    border-color: var(--cinder-color-danger-border, var(--cinder-chat-tool-approval-border));
  }

  .chat-tool-approval-header {
    display: flex;
    align-items: center;
    gap: var(--cinder-space-2);
  }

  .chat-tool-approval-icon {
    flex-shrink: 0;
    font-size: var(--cinder-text-base);
    line-height: 1;
  }

  [data-cinder-status='approved'] .chat-tool-approval-icon {
    color: var(--cinder-chat-tool-approval-approve-color);
  }

  [data-cinder-status='denied'] .chat-tool-approval-icon {
    color: var(--cinder-chat-tool-approval-deny-color);
  }

  [data-cinder-status='pending'] .chat-tool-approval-icon {
    color: var(--cinder-color-warning-fg, var(--cinder-text-muted));
  }

  .chat-tool-approval-title {
    font-size: var(--cinder-text-sm);
    font-weight: var(--cinder-font-medium);
    color: var(--cinder-text);
  }

  .chat-tool-approval-name {
    font-family: var(--cinder-font-mono);
    font-size: var(--cinder-text-sm);
    background: var(--cinder-surface-inset);
    padding-inline: var(--cinder-space-1);
    border-radius: var(--cinder-radius-sm);
  }

  .chat-tool-approval-message {
    margin: 0;
    font-size: var(--cinder-text-sm);
    color: var(--cinder-text-muted);
    line-height: var(--cinder-leading-normal, 1.5);
  }

  .chat-tool-approval-args {
    font-size: var(--cinder-text-sm);
  }

  .chat-tool-approval-args-toggle {
    cursor: pointer;
    color: var(--cinder-text-muted);
    user-select: none;

    &:hover {
      color: var(--cinder-text);
    }
  }

  .chat-tool-approval-args-code {
    margin: var(--cinder-space-2) 0 0;
    padding: var(--cinder-space-3);
    background: var(--cinder-surface-inset);
    border-radius: var(--cinder-radius-sm);
    font-family: var(--cinder-font-mono);
    font-size: var(--cinder-text-xs);
    overflow-x: auto;
    white-space: pre-wrap;
    word-break: break-all;
  }

  .chat-tool-approval-actions {
    display: flex;
    gap: var(--cinder-space-2);
  }

  .chat-tool-approval-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    /* Match the cinder Button component's default (md) size scale, rather
       than the AAA 44px touch target — the latter made these buttons look
       like oversized outliers next to every other control in the system. */
    min-block-size: var(--cinder-button-height-md);
    padding-block: var(--cinder-button-padding-y-md);
    padding-inline: var(--cinder-button-padding-x-md);
    border: 1px solid transparent;
    border-radius: var(--cinder-radius-md);
    font-size: var(--cinder-text-sm);
    font-weight: var(--cinder-font-medium);
    cursor: pointer;
    transition: background-color var(--cinder-duration-fast) var(--cinder-ease-standard);

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    &:focus-visible {
      outline: var(--cinder-ring-width) solid transparent;
      outline-offset: 2px;
      box-shadow: var(--_cinder-focus-ring-shadow);
    }

    @media (forced-colors: active) {
      &:focus-visible {
        outline: var(--cinder-ring-width) solid ButtonText;
        outline-offset: 3px;
        box-shadow: none;
      }
    }
  }

  .chat-tool-approval-btn-approve {
    background: var(--cinder-success);
    color: var(--cinder-success-contrast, var(--cinder-text));
    border-color: var(--cinder-success);

    @media (hover: hover) {
      &:not(:disabled):hover {
        /* cinder-allow-raw-color: structural-pattern — neutral hover overlay tint, not a themeable surface */
        --_cinder-chat-tool-approval-hover-overlay: light-dark(
          /* cinder-allow-raw-color: structural-pattern — neutral hover overlay tint, not a themeable surface */
            oklch(0% 0 0 / 0.08),
          /* cinder-allow-raw-color: structural-pattern — neutral hover overlay tint, not a themeable surface */
            oklch(100% 0 0 / 0.1)
        );

        background-image: linear-gradient(
          var(--_cinder-chat-tool-approval-hover-overlay),
          var(--_cinder-chat-tool-approval-hover-overlay)
        );
      }
    }
  }

  .chat-tool-approval-btn-deny {
    background: transparent;
    color: var(--cinder-chat-tool-approval-deny-color);
    border-color: var(--cinder-color-danger-border, var(--cinder-chat-tool-approval-border));

    @media (hover: hover) {
      &:not(:disabled):hover {
        background: var(--cinder-color-danger-bg, var(--cinder-surface-raised));
      }
    }
  }

  /* Forced-colors: the resolved-state border color is overridden by the system.
     The title text ("Approved:"/"Denied:") is the primary non-color signal, but
     keep a visible distinction by pinning the border to a system color. The
     box-shadow focus ring also vanishes, so fall back to a system outline. */
  @media (forced-colors: active) {
    .chat-tool-approval[data-cinder-status='approved'] {
      border-color: Highlight;
    }

    .chat-tool-approval[data-cinder-status='denied'] {
      border-color: GrayText;
    }

    .chat-tool-approval-btn:focus-visible {
      outline: var(--cinder-ring-width) solid ButtonText;
      outline-offset: 2px;
    }
  }
</style>
