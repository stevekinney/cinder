<script lang="ts" module>
  import type { HTMLAttributes } from 'svelte/elements';
  import type { ToolCallPair } from 'conversationalist';

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
  import { Check, ChevronDown, MoreHorizontal, X } from '../../icons/index.ts';
  import ToolPayloadCode from './tool-payload-code.svelte';

  let {
    pair,
    expanded = false,
    ontoggle,
    class: className,
    ...rest
  }: ToolCallGroupProps = $props();

  // Determine result status
  const hasResult = $derived(!!pair.result);
  const isError = $derived(pair.result?.outcome === 'error');
  const isSuccess = $derived(pair.result?.outcome === 'success');

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

<div
  class={classNames('tool-call-group', className)}
  data-status={isError ? 'error' : isSuccess ? 'success' : 'pending'}
  {...rest}
>
  <button
    type="button"
    class="tool-call-header"
    aria-expanded={expanded}
    aria-label={`Toggle tool call details for ${pair.call.name}`}
    onclick={handleToggle}
  >
    <span class="tool-call-icon" aria-hidden="true">
      {#if isError}
        <X class="icon-xs" />
      {:else if isSuccess}
        <Check class="icon-xs" />
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
      {:else}
        Pending
      {/if}
    </span>
    <span class="tool-call-chevron" aria-hidden="true" data-expanded={expanded}>
      <ChevronDown class="icon-xs" />
    </span>
  </button>

  {#if expanded}
    <div class="tool-call-details">
      <div class="tool-call-section">
        <h4 class="tool-call-section-title">Arguments</h4>
        <ToolPayloadCode code={formattedArguments} />
      </div>

      {#if hasResult}
        <div class="tool-call-section" data-error={isError || undefined}>
          <h4 class="tool-call-section-title">Result</h4>
          {#if isError && pair.result?.error}
            <div class="tool-call-error" role="alert">
              {pair.result.error}
            </div>
          {:else if formattedResult !== null}
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

  .tool-call-header:hover {
    background: var(--cinder-surface-hover);
  }

  .tool-call-header:focus-visible {
    outline: 2px solid var(--cinder-ring-color);
    outline-offset: -2px;
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
    gap: var(--cinder-space-3);
  }

  .tool-call-section-title {
    font-size: var(--cinder-text-xs);
    font-weight: var(--cinder-font-semibold);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--cinder-text-muted);
    margin: 0 0 var(--cinder-space-2);
  }

  .tool-call-error {
    padding: var(--cinder-space-3);
    background: color-mix(in oklch, var(--cinder-danger), transparent 90%);
    border-radius: var(--cinder-radius-md);
    color: var(--cinder-danger);
    font-size: var(--cinder-text-sm);
  }

  .tool-call-section[data-error] :global(.cinder-code-block) {
    border-color: color-mix(in oklch, var(--cinder-danger), transparent 40%);
  }
</style>
