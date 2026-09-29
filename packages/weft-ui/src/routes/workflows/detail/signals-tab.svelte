<script lang="ts">
  /**
   * Signals tab (plan T2.6): history + send form. History is derived from
   * `getTimeline()`'s `wait-signal` entries — see `workflow-timeline-data.ts`
   * module doc for why (`getEvents()` never records `signal:received`) and
   * its caveat (only signals actually delivered to a `ctx.waitForSignal()`
   * wait point appear; a buffered-but-not-yet-awaited signal does not, which
   * is inherent to weft's model, not a client gap).
   */
  import { Badge, Button, Input, JsonEditor, Skeleton } from '@lostgradient/cinder';
  import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
  import type { HttpClient, WorkflowState } from '@lostgradient/weft';
  import { Radio } from 'lucide-svelte';

  import { formatRelativeTime } from '../../../lib/format/index.ts';
  import { signalHistoryFromTimeline, workflowTimelineQueryKey } from './workflow-timeline-data.ts';

  interface SignalsTabProps {
    readonly client: Pick<HttpClient, 'signal' | 'getTimeline'>;
    readonly workflow: WorkflowState;
  }

  let { client, workflow }: SignalsTabProps = $props();

  const queryClient = useQueryClient();

  const timelineQuery = createQuery(() => ({
    queryKey: workflowTimelineQueryKey(workflow.id),
    queryFn: () => client.getTimeline(workflow.id),
  }));

  const receivedSignals = $derived(signalHistoryFromTimeline(timelineQuery.data ?? []));

  let signalName = $state('');
  let payloadText = $state('');
  let payloadError = $state<string | null>(null);

  const sendSignalMutation = createMutation(() => ({
    mutationFn: async ({ name, payload }: { name: string; payload: unknown }) =>
      client.signal(workflow.id, name, payload),
    onSuccess: () => {
      signalName = '';
      payloadText = '';
      void queryClient.invalidateQueries({ queryKey: workflowTimelineQueryKey(workflow.id) });
    },
  }));

  function parsePayload(text: string): { ok: true; value: unknown } | { ok: false; error: string } {
    const trimmed = text.trim();
    if (trimmed.length === 0) return { ok: true, value: undefined };
    try {
      return { ok: true, value: JSON.parse(trimmed) };
    } catch {
      return { ok: false, error: 'Payload must be valid JSON (or left blank).' };
    }
  }

  function submit(): void {
    if (signalName.trim().length === 0) return;
    const parsed = parsePayload(payloadText);
    if (!parsed.ok) {
      payloadError = parsed.error;
      return;
    }
    payloadError = null;
    sendSignalMutation.mutate({ name: signalName.trim(), payload: parsed.value });
  }

  const canSubmit = $derived(signalName.trim().length > 0 && !sendSignalMutation.isPending);
</script>

<div class="weft-send-tab">
  <div class="weft-send-tab__history">
    <div class="weft-send-tab__history-header">Received signals</div>
    {#if timelineQuery.isPending}
      <div style="padding: 15px;"><Skeleton height="2rem" /></div>
    {:else if receivedSignals.length === 0}
      <p
        class="weft-send-tab__error"
        style="color: var(--cinder-text-subtle); padding: 15px; margin: 0;"
      >
        No signals delivered to a wait point yet.
      </p>
    {:else}
      {#each receivedSignals as signal (signal.step)}
        <div class="weft-send-tab__history-row">
          <Radio aria-hidden="true" size={15} />
          <span class="weft-send-tab__history-name">{signal.name}</span>
          <Badge variant={signal.status === 'completed' ? 'success' : 'neutral'} size="sm">
            {signal.status}
          </Badge>
          <span class="weft-send-tab__history-time">{formatRelativeTime(signal.timestamp)}</span>
        </div>
      {/each}
    {/if}
  </div>

  <div class="weft-send-tab__form">
    <div class="weft-send-tab__form-title">Send signal</div>
    <Input
      id={`signal-name-${workflow.id}`}
      label="Signal name"
      placeholder="addItem"
      bind:value={signalName}
    />
    <JsonEditor
      id={`signal-payload-${workflow.id}`}
      label="Payload"
      description="JSON, optional"
      rows={4}
      value={payloadText}
      onValueChange={(next) => (payloadText = next)}
      highlight
      validFeedbackVisible={false}
    />
    {#if payloadError}
      <p class="weft-send-tab__error">{payloadError}</p>
    {/if}
    {#if sendSignalMutation.isError}
      <p class="weft-send-tab__error">
        {sendSignalMutation.error instanceof Error
          ? sendSignalMutation.error.message
          : 'Failed to send the signal.'}
      </p>
    {/if}
    <Button
      variant="primary"
      size="sm"
      fullWidth
      label={sendSignalMutation.isPending ? 'Sending…' : 'Send signal'}
      loading={sendSignalMutation.isPending}
      disabled={!canSubmit}
      onclick={submit}
    />
  </div>
</div>
