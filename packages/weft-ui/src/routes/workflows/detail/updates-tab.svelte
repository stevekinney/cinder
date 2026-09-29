<script lang="ts">
  /**
   * Updates tab (plan T2.6): history + send form, "update result long-polled
   * ... with pending countdown."
   *
   * ## Why history is session-scoped, and the countdown is a client-side
   * elapsed timer rather than `GET /api/v1/updates/:updateId` polling
   *
   * `client.update()`/`client.submitCoordinatedUpdate()` both hit the SAME
   * `POST /v1/workflows/:id/update/:name` route
   * (`weft/src/client/http-client-requests.ts` `submitCoordinatedUpdateRequest`),
   * which blocks SERVER-SIDE up to `timeout` (default 30s) and — on timeout —
   * throws a plain `HttpClientError` with `data: {}`
   * (`weft/src/server/operations/update-workflow.ts`): the `updateId` the
   * engine minted before waiting is NEVER returned to a timed-out caller.
   * Without an `updateId`, `GET /v1/updates/:updateId` has nothing to poll.
   * There is also no durable, listable "update history for this workflow"
   * operation (`getEvents()` never records `update:received`/`update:completed`
   * either — see `workflow-timeline-data.ts`'s module doc for the general
   * finding). So this tab tracks what the CONSOLE itself has sent, this
   * session, with the real settled result/error the mutation resolved with —
   * which is both the only durable-ish signal available and, per the design
   * reference's own mock ("applyDiscount ... awaiting result · 4s elapsed of
   * 30s" directly above completed rows with no separate fetch), plausibly
   * the intended behavior rather than a compromise.
   */
  import { Badge, Button, Input, JsonEditor } from '@lostgradient/cinder';
  import type { HttpClient, WorkflowState } from '@lostgradient/weft';
  import { CircleCheck, CircleX } from 'lucide-svelte';
  import { onDestroy } from 'svelte';

  import { formatRelativeTime } from '../../../lib/format/index.ts';
  import { TickingClock } from './ticking-clock.svelte.ts';

  interface UpdatesTabProps {
    readonly client: Pick<HttpClient, 'submitCoordinatedUpdate'>;
    readonly workflow: WorkflowState;
  }

  let { client, workflow }: UpdatesTabProps = $props();

  interface SentUpdate {
    readonly key: string;
    readonly name: string;
    readonly submittedAt: number;
    readonly timeoutMs: number;
    status: 'pending' | 'completed' | 'failed';
    result?: unknown;
    error?: string;
  }

  let sentUpdates = $state<SentUpdate[]>([]);
  const clock = new TickingClock();
  onDestroy(() => clock.dispose());

  let updateName = $state('');
  let payloadText = $state('');
  let idempotencyKey = $state('');
  let timeoutSeconds = $state(30);
  let payloadError = $state<string | null>(null);
  let submitting = $state(false);

  function parsePayload(text: string): { ok: true; value: unknown } | { ok: false; error: string } {
    const trimmed = text.trim();
    if (trimmed.length === 0) return { ok: true, value: undefined };
    try {
      return { ok: true, value: JSON.parse(trimmed) };
    } catch {
      return { ok: false, error: 'Payload must be valid JSON (or left blank).' };
    }
  }

  async function submit(): Promise<void> {
    const trimmedName = updateName.trim();
    if (trimmedName.length === 0) return;
    const parsed = parsePayload(payloadText);
    if (!parsed.ok) {
      payloadError = parsed.error;
      return;
    }
    payloadError = null;

    const timeoutMs = Math.max(1, timeoutSeconds) * 1000;
    const entry: SentUpdate = {
      key: `${Date.now()}-${trimmedName}`,
      name: trimmedName,
      submittedAt: Date.now(),
      timeoutMs,
      status: 'pending',
    };
    sentUpdates = [entry, ...sentUpdates];
    submitting = true;
    updateName = '';
    payloadText = '';

    try {
      const result = await client.submitCoordinatedUpdate(workflow.id, trimmedName, parsed.value, {
        timeout: timeoutMs,
        ...(idempotencyKey.trim().length > 0 ? { idempotencyKey: idempotencyKey.trim() } : {}),
      });
      updateEntry(
        entry.key,
        result.error !== undefined
          ? { status: 'failed', error: result.error }
          : { status: 'completed', result: result.result },
      );
    } catch (error) {
      updateEntry(entry.key, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'The update failed.',
      });
    } finally {
      submitting = false;
    }
  }

  function updateEntry(key: string, patch: Partial<SentUpdate>): void {
    sentUpdates = sentUpdates.map((entry) => (entry.key === key ? { ...entry, ...patch } : entry));
  }

  function elapsedSeconds(entry: SentUpdate): number {
    return Math.max(0, Math.round((clock.now - entry.submittedAt) / 1000));
  }
</script>

<div class="weft-send-tab">
  <div class="weft-send-tab__history">
    <div class="weft-send-tab__history-header">Update history — this session</div>
    {#if sentUpdates.length === 0}
      <p
        style="color: var(--cinder-text-subtle); padding: 15px; margin: 0; font-size: var(--cinder-text-sm);"
      >
        Nothing sent yet.
      </p>
    {:else}
      {#each sentUpdates as entry (entry.key)}
        <div class="weft-send-tab__history-row" data-status={entry.status}>
          {#if entry.status === 'pending'}
            <span class="weft-send-tab__spinner" aria-hidden="true"></span>
          {:else if entry.status === 'completed'}
            <CircleCheck aria-hidden="true" size={15} color="var(--cinder-color-success-fg)" />
          {:else}
            <CircleX aria-hidden="true" size={15} color="var(--cinder-color-danger-fg)" />
          {/if}
          <div class="weft-send-tab__history-name">
            {entry.name}
            {#if entry.status === 'pending'}
              <div style="font-size: var(--cinder-text-xs); color: var(--cinder-text-subtle);">
                awaiting result · {elapsedSeconds(entry)}s elapsed of {entry.timeoutMs / 1000}s
              </div>
            {:else if entry.status === 'completed'}
              <div
                style="font-family: var(--cinder-font-mono); font-size: var(--cinder-text-xs); color: var(--cinder-text-subtle);"
              >
                {JSON.stringify(entry.result)}
              </div>
            {:else}
              <div style="font-size: var(--cinder-text-xs); color: var(--cinder-color-danger-fg);">
                {entry.error}
              </div>
            {/if}
          </div>
          {#if entry.status === 'pending'}
            <Badge variant="info" size="sm">pending</Badge>
          {:else}
            <span class="weft-send-tab__history-time"
              >{formatRelativeTime(entry.submittedAt, clock.now)}</span
            >
          {/if}
        </div>
      {/each}
    {/if}
  </div>

  <div class="weft-send-tab__form">
    <div class="weft-send-tab__form-title">Send update</div>
    <Input
      id={`update-name-${workflow.id}`}
      label="Update name"
      placeholder="applyDiscount"
      bind:value={updateName}
    />
    <JsonEditor
      id={`update-payload-${workflow.id}`}
      label="Payload"
      description="JSON, optional"
      rows={3}
      value={payloadText}
      onValueChange={(next) => (payloadText = next)}
      highlight
      validFeedbackVisible={false}
    />
    <div class="weft-send-tab__row">
      <Input
        id={`update-idempotency-${workflow.id}`}
        label="Idempotency key"
        placeholder="auto"
        bind:value={idempotencyKey}
      />
      <Input
        id={`update-timeout-${workflow.id}`}
        label="Timeout (s)"
        type="number"
        value={String(timeoutSeconds)}
        oninput={(event) => {
          const parsed = Number((event.currentTarget as HTMLInputElement).value);
          if (Number.isFinite(parsed) && parsed > 0) timeoutSeconds = parsed;
        }}
      />
    </div>
    {#if payloadError}
      <p class="weft-send-tab__error">{payloadError}</p>
    {/if}
    <Button
      variant="primary"
      size="sm"
      fullWidth
      label={submitting ? 'Sending…' : 'Send update'}
      loading={submitting}
      disabled={updateName.trim().length === 0 || submitting}
      onclick={() => void submit()}
    />
  </div>
</div>

<style>
  .weft-send-tab__row {
    display: flex;
    gap: 10px;
  }

  .weft-send-tab__row > :global(*) {
    flex: 1;
    min-width: 0;
  }

  .weft-send-tab__spinner {
    flex: none;
    width: 13px;
    height: 13px;
    border: 2px solid var(--cinder-info);
    border-top-color: transparent;
    border-radius: 50%;
    display: inline-block;
    animation: weft-updates-spin 0.7s linear infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    .weft-send-tab__spinner {
      animation-duration: 0.001ms;
    }
  }

  @keyframes weft-updates-spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
