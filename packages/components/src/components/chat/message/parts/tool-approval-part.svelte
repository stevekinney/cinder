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

  const labelId = $derived(`tool-approval-label-${part.toolCallId}`);
  const descId = $derived(`tool-approval-desc-${part.toolCallId}`);

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
  Tool approval prompt. Uses role="alertdialog" to announce the pending action
  assertively when it appears (screen readers interrupt the current reading to
  surface it). aria-modal="false" because this is inline in the chat timeline,
  not a true modal overlay — keyboard focus is NOT trapped here.
-->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  class="chat-tool-approval"
  role="alertdialog"
  aria-modal="false"
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
        autofocus
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
    min-block-size: var(--cinder-touch-target-min, 44px);
    padding-block: var(--cinder-space-2);
    padding-inline: var(--cinder-space-4);
    border: 1px solid transparent;
    border-radius: var(--cinder-radius-md);
    font-size: var(--cinder-text-sm);
    font-weight: var(--cinder-font-medium);
    cursor: pointer;
    transition: opacity var(--cinder-duration-fast) var(--cinder-ease-standard);

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  .chat-tool-approval-btn-approve {
    background: var(--cinder-color-success-bg, var(--cinder-surface-raised));
    color: var(--cinder-chat-tool-approval-approve-color);
    border-color: var(--cinder-color-success-border, var(--cinder-chat-tool-approval-border));

    &:not(:disabled):hover {
      opacity: 0.85;
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
</style>
