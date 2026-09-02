<script lang="ts">
  import RunStepTimeline, { type RunStep } from '@lostgradient/cinder/run-step-timeline';
  import { stringify } from '../../../utilities/stringify.ts';
  import type { ToolCallPair } from '../conversation-model.ts';
  import type { ToolCallPresentation } from '../utilities/types.ts';
  import { formatToolCallProse } from '../utilities/utilities.ts';
  import { SvelteSet } from 'svelte/reactivity';
  import ToolCallGroup from './tool-call-group.svelte';

  let {
    pairs,
    messageId,
    describeToolCall,
    activityActive = true,
  }: {
    pairs: ToolCallPair[];
    messageId?: string;
    describeToolCall?: ((pair: ToolCallPair) => ToolCallPresentation | undefined) | undefined;
    activityActive?: boolean;
  } = $props();
  const navigationMessageId = $derived(messageId ?? pairs[0]?.call.id ?? 'tool-call-group');
  const headingId = $derived(`message-${navigationMessageId}-tool-call-summary`);

  function formatPayload(value: unknown): string {
    return value === null ? 'null' : stringify(value);
  }

  const activityPresentations = $derived(pairs.map((pair) => describeToolCall?.(pair)));

  const steps = $derived(
    pairs.map(
      (pair, index): RunStep => ({
        id: `${index}:${pair.call.id}`,
        label: (() => {
          const presentation = activityPresentations[index];
          return presentation ? formatToolCallProse(presentation) : pair.call.name;
        })(),
        status:
          pair.result?.outcome === 'error'
            ? 'failed'
            : pair.result?.outcome === 'action_required'
              ? 'waiting_approval'
              : pair.result
                ? 'succeeded'
                : 'running',
        details: [
          {
            id: `${index}:${pair.call.id}-arguments`,
            label: 'Arguments',
            content: formatPayload(pair.call.arguments),
          },
          ...(pair.result
            ? [
                {
                  id: `${index}:${pair.call.id}-result`,
                  label: 'Result',
                  content:
                    pair.result.outcome === 'error' && pair.result.error?.message
                      ? pair.result.error.message
                      : formatPayload(pair.result.content),
                },
              ]
            : []),
        ],
      }),
    ),
  );
  const completedCount = $derived(steps.filter((step) => step.status === 'succeeded').length);
  const hasActivityPresentations = $derived(activityPresentations.some(Boolean));
  const expandedCalls = new SvelteSet<string>();

  function toggleCall(occurrenceKey: string): void {
    if (expandedCalls.has(occurrenceKey)) expandedCalls.delete(occurrenceKey);
    else expandedCalls.add(occurrenceKey);
  }
</script>

<section
  id={`message-${navigationMessageId}`}
  class="chat-tool-call-timeline chat-navigation-row"
  data-cinder-tool-call-count={pairs.length}
  aria-labelledby={headingId}
  tabindex="-1"
>
  <h3 id={headingId}>
    Called {pairs.length} tools{completedCount ? `, ${completedCount} complete` : ''}
  </h3>
  {#if hasActivityPresentations}
    <div
      class="presented-tool-calls"
      role="list"
      aria-label={`${pairs.length} consecutive tool calls`}
    >
      {#each pairs as pair, index (`${index}:${pair.call.id}`)}
        <div role="listitem">
          <ToolCallGroup
            {pair}
            occurrenceKey={`${navigationMessageId}-${index}-${pair.call.id}`}
            {...activityPresentations[index] ? { presentation: activityPresentations[index] } : {}}
            {activityActive}
            expanded={expandedCalls.has(`${index}:${pair.call.id}`)}
            onToggle={() => toggleCall(`${index}:${pair.call.id}`)}
          />
        </div>
      {/each}
    </div>
  {:else}
    <RunStepTimeline {steps} label={`${pairs.length} consecutive tool calls`} />
  {/if}
</section>

<style>
  .chat-tool-call-timeline {
    /* A grouped tool-call run is its own transcript row — chat.svelte renders
     * it as a sibling of .chat-message-wrapper (chat-message.svelte), not
     * inside one, so it never inherited that wrapper's readability cap. It
     * carries the widest content in the transcript (serialized JSON
     * arguments/results via ToolPayloadCode), so without a cap of its own it
     * was the one row that stretched to the full timeline width. Fill the
     * available width up to the same shared cap every other row respects —
     * see chat-message.svelte's --cinder-chat-message-max-width usage. */
    inline-size: 100%;
    max-inline-size: var(--cinder-chat-message-max-width, 48rem);
    padding: var(--cinder-space-3);
    border: 1px solid var(--cinder-border-muted);
    border-radius: var(--cinder-radius-md);
    background: var(--cinder-surface);
  }
  h3 {
    margin: 0 0 var(--cinder-space-3);
    font-size: var(--_cinder-chat-text-sm, var(--cinder-text-sm));
  }
  .presented-tool-calls {
    display: grid;
    /* Without an explicit track, an implicit `auto` column sizes itself to
     * its widest item's max-content contribution — computed BEFORE this
     * grid's own width is definite, so a `ToolCallGroup` expanded onto a
     * long, unbroken payload (tool-payload-code.svelte's ToolPayloadCode)
     * blows the column past `.chat-tool-call-timeline`'s cap above instead
     * of respecting it. `minmax(0, 1fr)` pins the column to the grid's own
     * (already-capped) width so `.tool-call-group`'s `max-inline-size: 100%`
     * has a definite value to resolve against, and the long line scrolls
     * inside its own code block instead. */
    grid-template-columns: minmax(0, 1fr);
    gap: var(--cinder-space-2);
  }
</style>
