<script lang="ts" module>
  import type { HTMLAttributes } from 'svelte/elements';
  import type { ToolCallPair } from '../conversation-model.ts';

  export type ToolCallGroupProps = Omit<HTMLAttributes<HTMLDivElement>, 'class'> & {
    /** The tool call pair (call + optional result) */
    pair: ToolCallPair;
    /** Whether the details are expanded */
    expanded?: boolean;
    /** Called when toggle is clicked */
    ontoggle?: () => void;
    /** Additional CSS class */
    class?: string;
  };
</script>

<script lang="ts">
  import { classNames } from '../../../utilities/class-names.ts';
  import { stringify } from '../../../utilities/stringify.ts';
  import Check from 'lucide-svelte/icons/check';
  import ChevronDown from 'lucide-svelte/icons/chevron-down';
  import CircleAlert from 'lucide-svelte/icons/circle-alert';
  import MoreHorizontal from 'lucide-svelte/icons/more-horizontal';
  import X from 'lucide-svelte/icons/x';
  import ToolPayloadCode from './tool-payload-code.svelte';

  let {
    pair,
    expanded = false,
    ontoggle,
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
    ontoggle?.();
  }
</script>

<div class={classNames('tool-call-group', className)} data-status={status} {...rest}>
  <button
    type="button"
    class="tool-call-header"
    aria-expanded={expanded}
    aria-controls={detailsId}
    aria-label={`Toggle tool call details for ${pair.call.name}`}
    onclick={handleToggle}
  >
    <span class="tool-call-icon" aria-hidden="true">
      {#if isError}
        <X class="icon-xs" />
      {:else if isSuccess}
        <Check class="icon-xs" />
      {:else if isActionRequired}
        <CircleAlert class="icon-xs" />
      {:else}
        <MoreHorizontal class="icon-xs" />
      {/if}
    </span>
    <span class="tool-call-name">{pair.call.name}</span>
    <span class="tool-call-status" role="status" aria-live="polite">
      {#if isError}
        Failed
      {:else if isSuccess}
        Complete
      {:else if isActionRequired}
        Action required
      {:else}
        Pending
      {/if}
    </span>
    <span class="tool-call-chevron" aria-hidden="true" data-expanded={expanded}>
      <ChevronDown class="icon-xs" />
    </span>
  </button>

  {#if expanded}
    <div id={detailsId} class="tool-call-details" role="region" aria-label="Tool details">
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
  {/if}
</div>

<style>
  .tool-call-group {
    inline-size: max-content;
    min-inline-size: min(18rem, 100%);
    max-inline-size: 100%;
    border-radius: var(--cinder-radius-md);
    border: 1px solid var(--cinder-border-muted);
    overflow: hidden;
  }

  .tool-call-group[data-status='error'] {
    border-color: var(--cinder-danger);
  }

  .tool-call-group[data-status='success'] {
    border-color: var(--cinder-success);
  }

  .tool-call-group[data-status='action-required'] {
    border-color: var(--cinder-warning);
  }

  /* Uses min-height for WCAG 2.2 AA touch target compliance */
  .tool-call-header {
    display: flex;
    align-items: center;
    gap: var(--cinder-space-2);
    width: 100%;
    min-height: var(--cinder-touch-target-min);
    padding: var(--cinder-space-2) var(--cinder-space-3);
    background: var(--cinder-surface);
    border: none;
    cursor: pointer;
    user-select: none;
    text-align: left;
    font: inherit;
    color: inherit;
  }

  /* Hover: subtle inset tint instead of the full surface-hover gray, which
   * looked harsh against the colored card border. */
  @media (hover: hover) {
    .tool-call-header:hover {
      background: color-mix(in oklch, var(--cinder-surface), var(--cinder-text) 4%);
    }
  }

  /* Focus: ring travels via box-shadow, not outline, so it sits inside the
   * card's colored border instead of doubling up on top of it. */
  .tool-call-header:focus-visible {
    outline: none;
    box-shadow: inset 0 0 0 2px var(--cinder-ring-color);
  }

  .tool-call-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: var(--cinder-text-muted);
  }

  .tool-call-group[data-status='error'] .tool-call-icon {
    color: var(--cinder-danger);
  }

  .tool-call-group[data-status='success'] .tool-call-icon {
    color: var(--cinder-success);
  }

  .tool-call-group[data-status='action-required'] .tool-call-icon {
    color: var(--cinder-warning);
  }

  .tool-call-name {
    font-family: var(--cinder-font-mono);
    font-size: var(--cinder-text-sm);
    font-weight: var(--cinder-font-medium);
    color: var(--cinder-text);
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tool-call-status {
    font-size: var(--cinder-text-xs);
    color: var(--cinder-text-subtle);
    flex-shrink: 0;
  }

  .tool-call-group[data-status='error'] .tool-call-status {
    color: var(--cinder-danger);
  }

  .tool-call-group[data-status='success'] .tool-call-status {
    color: var(--cinder-success);
  }

  .tool-call-group[data-status='action-required'] .tool-call-status {
    color: var(--cinder-warning);
  }

  .tool-call-chevron {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: var(--cinder-text-muted);
    transition: transform var(--cinder-duration-fast) var(--cinder-ease-standard);
  }

  .tool-call-chevron[data-expanded='true'] {
    transform: rotate(180deg);
  }

  .tool-call-details {
    padding: var(--cinder-space-3);
    border-top: 1px solid var(--cinder-border-muted);
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
    font-size: var(--cinder-text-xs);
    font-weight: var(--cinder-font-semibold);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--cinder-text-muted);
    margin: 0;
  }

  .tool-call-error {
    padding: var(--cinder-space-3);
    background: var(--cinder-color-danger-bg);
    border-radius: var(--cinder-radius-md);
    color: var(--cinder-color-danger-fg);
    font-size: var(--cinder-text-sm);
  }

  .tool-call-section[data-error] :global(.cinder-code-block) {
    border-color: var(--cinder-color-danger-border);
  }

  .tool-call-action {
    padding: var(--cinder-space-3);
    background: var(--cinder-color-warning-bg);
    border-radius: var(--cinder-radius-md);
    color: var(--cinder-color-warning-fg);
    font-size: var(--cinder-text-sm);
  }
</style>
