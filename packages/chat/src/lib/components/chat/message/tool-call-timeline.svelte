<script lang="ts">
  import RunStepTimeline, { type RunStep } from '@lostgradient/cinder/run-step-timeline';
  import { stringify } from '../../../utilities/stringify.ts';
  import type { ToolCallPair } from '../conversation-model.ts';

  let { pairs, messageId }: { pairs: ToolCallPair[]; messageId?: string } = $props();
  const navigationMessageId = $derived(messageId ?? pairs[0]?.call.id ?? 'tool-call-group');

  function formatPayload(value: unknown): string {
    return value === null ? 'null' : stringify(value);
  }

  const steps = $derived(
    pairs.map(
      (pair, index): RunStep => ({
        id: `${index}:${pair.call.id}`,
        label: pair.call.name,
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
</script>

<section
  id={`message-${navigationMessageId}`}
  class="chat-tool-call-timeline chat-navigation-row"
  data-cinder-tool-call-count={pairs.length}
  tabindex="-1"
>
  <h3>Called {pairs.length} tools{completedCount ? `, ${completedCount} complete` : ''}</h3>
  <RunStepTimeline {steps} label={`${pairs.length} consecutive tool calls`} />
</section>

<style>
  .chat-tool-call-timeline {
    inline-size: 100%;
    padding: var(--cinder-space-3);
    border: 1px solid var(--cinder-border-muted);
    border-radius: var(--cinder-radius-md);
    background: var(--cinder-surface);
  }
  h3 {
    margin: 0 0 var(--cinder-space-3);
    font-size: var(--_cinder-chat-text-sm, var(--cinder-text-sm));
  }
</style>
