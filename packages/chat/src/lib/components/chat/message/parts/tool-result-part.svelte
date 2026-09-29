<script lang="ts" module>
  import type { ToolResultMessagePart } from '../../utilities/types.ts';

  export type ToolResultPartProps = {
    /** The tool-result render part (the structured outcome). */
    part: ToolResultMessagePart;
  };
</script>

<script lang="ts">
  import { stringify } from '../../../../utilities/stringify.ts';
  import ToolPayloadCode from '../tool-payload-code.svelte';

  let { part }: ToolResultPartProps = $props();

  const result = $derived(part.result);

  const isError = $derived(result.outcome === 'error');
  const isActionRequired = $derived(result.outcome === 'action_required');

  // Render text by outcome, mirroring the historical tool-result branch:
  // - error: the structured error's `.message` (a ToolError object would
  //   otherwise stringify to `[object Object]`).
  // - action_required: the requested action's message, with a neutral
  //   fallback so it is never blank.
  // - otherwise: the safely-stringified content.
  const formatted = $derived.by(() => {
    if (result.outcome === 'error' && result.error) {
      return result.error.message;
    }
    if (result.outcome === 'action_required') {
      return result.action?.message ?? 'This tool call requires action.';
    }
    return stringify(result.content);
  });

  const actionSchema = $derived(
    result.outcome === 'action_required' && result.action?.type === 'input'
      ? result.action.schema
      : undefined,
  );
  const formattedSchema = $derived(
    actionSchema === undefined ? undefined : stringify(actionSchema),
  );
</script>

<div
  class="chat-message-tool-result"
  data-error={isError || undefined}
  data-action-required={isActionRequired || undefined}
>
  {#if isError}
    <div class="chat-message-tool-error" role="alert">
      {formatted}
    </div>
  {:else if isActionRequired}
    <div class="chat-message-tool-action" role="status">
      <p class="chat-message-tool-action-message">{formatted}</p>
      {#if formattedSchema !== undefined}
        <div class="chat-message-tool-action-schema" aria-label="Requested input schema">
          <ToolPayloadCode code={formattedSchema} />
        </div>
      {/if}
    </div>
  {:else}
    <ToolPayloadCode code={formatted} />
  {/if}
</div>

<style>
  /* Reproduces the historical tool-result body styling from chat-message so the
     visual output is unchanged after moving onto the part layer. */
  .chat-message-tool-result {
    inline-size: 100%;
  }

  .chat-message-tool-error {
    padding: var(--cinder-space-3);
    background: var(--cinder-status-danger-background);
    border-radius: var(--cinder-radius-md);
    color: var(--cinder-status-danger-text);
    font-size: var(--_cinder-chat-text-sm, var(--cinder-text-sm));
  }

  /* `.chat-message-tool-action` is intentionally unstyled here — the historical
     tool-result branch rendered the action message with no dedicated rule, so
     adding one would be a visual change. Keep the markup, not the styling. */

  .chat-message-tool-action-message {
    margin: 0;
  }

  .chat-message-tool-action-schema {
    margin-block-start: var(--cinder-space-2);
  }
</style>
