<script lang="ts">
  /**
   * Async activity completion drawer (plan T3.4, design `Weft
   * Patterns.dc.html` "async completion"): token display (plain, "not a
   * secret" label), Complete/Fail forms, spent-token treatment.
   *
   * Deliberately does NOT try to detect the token's completion via any live
   * event — see `workflow-live-observations.svelte.ts`'s module doc:
   * `engine.completeAsyncActivity`/`failAsyncActivity` dispatch no event at
   * all. `onResolved` is the only signal the caller gets, fired right after
   * this drawer's own successful mutation.
   */
  import {
    Badge,
    Button,
    CodeBlock,
    CopyButton,
    Drawer,
    SegmentedControl,
    Segment,
    Textarea,
  } from '@lostgradient/cinder';
  import { createMutation } from '@tanstack/svelte-query';
  import type { WeftClientActivity } from '@lostgradient/weft';
  import { Clock } from 'lucide-svelte';

  import { faultTreatment } from '../../../../lib/faults.ts';
  import type { AttachedPendingActivity } from './async-activity-matching.ts';

  interface AsyncActivityDrawerProps {
    readonly client: {
      readonly activity: Pick<WeftClientActivity, 'complete' | 'completeExceptionally'>;
    };
    readonly open: boolean;
    readonly activity: AttachedPendingActivity;
    readonly onClose: () => void;
    readonly onResolved: (token: string) => void;
  }

  let { client, open, activity, onClose, onResolved }: AsyncActivityDrawerProps = $props();

  // `Drawer.open` is `bind:`-able but has no `onclose` callback prop
  // (verified: `drawer.types.ts` omits `onclose`/`oncancel` from the native
  // dialog attributes without replacing them) — the component's own
  // dismissal affordances (Escape, backdrop click, close button) write back
  // to a bound `open` variable instead. Mirror the controlled `open` prop
  // into a local bindable, and treat "the mirror went false while the
  // parent still thinks it's open" as the signal to call `onClose`. The
  // `$state(open)` initializer intentionally only captures the prop's value
  // at mount — it seeds the correct value for the very first render, before
  // the `$effect` below has run once to take over keeping it in sync on every
  // later change. A `$derived` can't replace this: `localOpen` must stay
  // independently mutable so `Drawer`'s own dismissal affordances can write
  // back to it.
  // svelte-ignore state_referenced_locally
  let localOpen = $state(open);
  $effect(() => {
    localOpen = open;
  });
  $effect(() => {
    if (!localOpen && open) onClose();
  });

  let mode = $state<'complete' | 'fail'>('complete');
  let payloadText = $state('');
  let payloadError = $state<string | null>(null);

  function parsePayload(text: string): { ok: true; value: unknown } | { ok: false; error: string } {
    const trimmed = text.trim();
    if (trimmed.length === 0) return { ok: true, value: undefined };
    try {
      return { ok: true, value: JSON.parse(trimmed) };
    } catch {
      // A fail-mode payload is allowed to be plain text (the error message),
      // not necessarily JSON — only complete-mode requires valid JSON since
      // it becomes the workflow's actual result value.
      return mode === 'fail'
        ? { ok: true, value: trimmed }
        : { ok: false, error: 'Result must be valid JSON (or left blank).' };
    }
  }

  const resolveMutation = createMutation(() => ({
    mutationFn: async () => {
      const parsed = parsePayload(payloadText);
      if (!parsed.ok) {
        payloadError = parsed.error;
        throw new Error(parsed.error);
      }
      payloadError = null;
      if (mode === 'complete') {
        await client.activity.complete(activity.token, parsed.value);
      } else {
        await client.activity.completeExceptionally(activity.token, parsed.value);
      }
    },
    onSuccess: () => onResolved(activity.token),
  }));

  const spentToken = $derived(
    resolveMutation.isError && faultTreatment(resolveMutation.error).kind === 'not-found',
  );

  function submit(): void {
    resolveMutation.mutate();
  }
</script>

<Drawer bind:open={localOpen} title="Complete async activity">
  <div class="weft-async-activity-drawer">
    <Badge variant="warning">
      <Clock aria-hidden="true" size={11} />
      Awaiting external completion
    </Badge>

    <p class="weft-async-activity-drawer__activity-name">{activity.activityName}</p>

    <div class="weft-async-activity-drawer__field">
      <span class="weft-async-activity-drawer__label">
        Completion token
        <span class="weft-async-activity-drawer__label-note"
          >· deterministic identifier, not a secret</span
        >
      </span>
      <div class="weft-async-activity-drawer__token">
        <CodeBlock code={activity.token} highlight={false} languageLabelVisible={false} />
        <CopyButton value={activity.token} iconOnly label="Copy completion token" />
      </div>
    </div>

    {#if spentToken}
      <p class="weft-async-activity-drawer__spent">This token has been used.</p>
    {:else}
      <SegmentedControl
        id="weft-async-activity-mode"
        label="Completion mode"
        labelVisible={false}
        density="toolbar"
        value={mode}
        onValueChange={(next) => (mode = next)}
      >
        <Segment value="complete">Complete</Segment>
        <Segment value="fail">Fail</Segment>
      </SegmentedControl>

      <Textarea
        id="weft-async-activity-payload"
        label={mode === 'complete' ? 'Result (JSON, optional)' : 'Error message'}
        rows={4}
        bind:value={payloadText}
      />

      {#if payloadError}
        <p class="weft-async-activity-drawer__error">{payloadError}</p>
      {/if}
      {#if resolveMutation.isError && !spentToken}
        <p class="weft-async-activity-drawer__error">
          {resolveMutation.error instanceof Error
            ? resolveMutation.error.message
            : 'Failed to resolve the activity.'}
        </p>
      {/if}

      <Button
        variant="primary"
        size="sm"
        fullWidth
        label={mode === 'complete' ? 'Complete activity' : 'Fail activity'}
        loading={resolveMutation.isPending}
        disabled={resolveMutation.isPending}
        onclick={submit}
      />
    {/if}
  </div>
</Drawer>

<style>
  .weft-async-activity-drawer {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .weft-async-activity-drawer__activity-name {
    margin: 0;
    font-size: var(--cinder-text-sm);
    font-weight: 600;
  }

  .weft-async-activity-drawer__field {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .weft-async-activity-drawer__label {
    font-size: var(--cinder-text-xs);
    font-weight: 600;
  }

  .weft-async-activity-drawer__label-note {
    font-weight: 400;
    color: var(--cinder-text-disabled);
  }

  .weft-async-activity-drawer__token {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .weft-async-activity-drawer__token :global(.cinder-code-block) {
    flex: 1;
    min-width: 0;
  }

  .weft-async-activity-drawer__spent {
    margin: 0;
    padding: 10px;
    background: var(--cinder-surface-inset);
    border-radius: var(--cinder-radius-md);
    font-size: var(--cinder-text-xs);
    color: var(--cinder-text-subtle);
  }

  .weft-async-activity-drawer__error {
    margin: 0;
    font-size: var(--cinder-text-2xs);
    color: var(--cinder-color-danger-fg);
  }
</style>
