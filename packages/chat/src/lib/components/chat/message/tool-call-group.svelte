<script lang="ts" module>
  import type { HTMLAttributes } from 'svelte/elements';
  import type { ToolCallPair } from '../conversation-model.ts';

  export type ToolCallGroupProps = Omit<HTMLAttributes<HTMLDivElement>, 'class'> & {
    /** The tool call pair (call + optional result) */
    pair: ToolCallPair;
    /** Whether the details are expanded */
    expanded?: boolean;
    /** Called when toggle is clicked */
    onToggle?: () => void;
    /** Additional CSS class */
    class?: string;
  };
</script>

<script lang="ts">
  import { classNames } from '../../../utilities/class-names.ts';
  import { stringify } from '../../../utilities/stringify.ts';
  import ToolPayloadCode from './tool-payload-code.svelte';
  import EntryFrame from './entry-frame.svelte';

  let {
    pair,
    expanded = false,
    onToggle,
    class: className,
    ...rest
  }: ToolCallGroupProps = $props();

  // Stable ID for the disclosed region so the toggle can reference it via aria-controls.
  // Reactive so the ID tracks the current pair when the component instance is reused.
  const detailsId = $derived(`tool-call-details-${pair.call.id}`);

  // Determine result status
  const hasResult = $derived(!!pair.result);
  const isError = $derived(pair.result?.outcome === 'error');
  const isSuccess = $derived(pair.result?.outcome === 'success');
  const isActionRequired = $derived(pair.result?.outcome === 'action_required');

  // Status string drives data-status, the header icon, and the label.
  const status = $derived(
    isError ? 'error' : isSuccess ? 'success' : isActionRequired ? 'action-required' : 'pending',
  );

  // The structured error's message (never the ToolError object, which would
  // render as `[object Object]`).
  const errorMessage = $derived(pair.result?.error?.message ?? '');

  // For an action_required result, surface the requested action's message; fall
  // back to a neutral label when no action detail is present (never blank).
  const actionMessage = $derived(pair.result?.action?.message ?? 'This tool call requires action.');

  // Format arguments for display
  const formattedArguments = $derived(stringify(pair.call.arguments));

  // Format result content for display
  // Return strings as-is to preserve formatting (e.g., file contents with newlines).
  // Only JSON-stringify objects/arrays since those need structure visualization.
  const formattedResult = $derived(pair.result ? stringify(pair.result.content) : '');

  function handleToggle() {
    onToggle?.();
  }
</script>

<div class={classNames('tool-call-group', className)} data-status={status} {...rest}>
  <span class="sr-only" aria-live="polite" aria-atomic="true">
    {pair.call.name}: {isError
      ? 'Failed'
      : isSuccess
        ? 'Complete'
        : isActionRequired
          ? 'Action required'
          : 'Pending'}
  </span>
  <EntryFrame
    id={detailsId}
    label={pair.call.name}
    status={isError
      ? 'Failed'
      : isSuccess
        ? 'Complete'
        : isActionRequired
          ? 'Action required'
          : 'Pending'}
    open={expanded}
    triggerClass="tool-call-header"
    labelClass="tool-call-name"
    onToggle={() => handleToggle()}
  >
    <div class="tool-call-details">
      <div class="tool-call-section">
        <h4 class="tool-call-section-title">Arguments</h4>
        <ToolPayloadCode code={formattedArguments} />
      </div>

      {#if hasResult}
        <div class="tool-call-section" data-error={isError || undefined}>
          <h4 class="tool-call-section-title">Result</h4>
          {#if isError}
            <div class="tool-call-error" role="alert">
              {errorMessage || formattedResult}
            </div>
          {:else if isActionRequired}
            <div class="tool-call-action" role="status">
              {actionMessage}
            </div>
          {:else}
            <ToolPayloadCode code={formattedResult} />
          {/if}
        </div>
      {/if}
    </div>
  </EntryFrame>
</div>

<style>
  .tool-call-group {
    inline-size: max-content;
    min-inline-size: min(18rem, 100%);
    max-inline-size: 100%;
  }

  .tool-call-group[data-status='error'] {
    --_chat-entry-frame-border-color: var(--cinder-status-danger-solid);
  }

  .tool-call-group[data-status='success'] {
    --_chat-entry-frame-border-color: var(--cinder-status-success-solid);
  }

  .tool-call-group[data-status='action-required'] {
    --_chat-entry-frame-border-color: var(--cinder-status-warning-solid);
  }

  :global(.tool-call-header:focus-visible) {
    outline: var(--cinder-ring-width) solid transparent;
    box-shadow: inset 0 0 0 var(--cinder-ring-width) var(--cinder-ring-color);
  }

  @media (forced-colors: active) {
    :global(.tool-call-header:focus-visible) {
      outline: var(--cinder-ring-width) solid ButtonText;
      outline-offset: calc(var(--cinder-ring-width) * -1);
    }
  }

  .tool-call-details {
    background: var(--cinder-surface-inset);
    display: flex;
    flex-direction: column;
    gap: var(--cinder-space-2);
  }

  .tool-call-section {
    display: flex;
    flex-direction: column;
    gap: var(--cinder-space-1);
  }

  .tool-call-section-title {
    font-size: var(--_cinder-chat-text-xs, var(--cinder-text-xs));
    font-weight: var(--cinder-font-semibold);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--cinder-text-muted);
    margin: 0;
  }

  .tool-call-error {
    padding: var(--cinder-space-3);
    background: var(--cinder-status-danger-background);
    border-radius: var(--cinder-radius-md);
    color: var(--cinder-status-danger-text);
    font-size: var(--_cinder-chat-text-sm, var(--cinder-text-sm));
  }

  .tool-call-section[data-error] :global(.cinder-code-block) {
    border-color: var(--cinder-status-danger-border);
  }

  .tool-call-action {
    padding: var(--cinder-space-3);
    background: var(--cinder-status-warning-background);
    border-radius: var(--cinder-radius-md);
    color: var(--cinder-status-warning-text);
    font-size: var(--_cinder-chat-text-sm, var(--cinder-text-sm));
  }
</style>
