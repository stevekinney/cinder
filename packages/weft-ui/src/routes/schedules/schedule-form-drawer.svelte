<script lang="ts">
  /**
   * Create/Edit schedule slide-over (Track B, plan §9.3; design
   * `Weft New Surfaces.dc.html` §A2 — 440px right slide-over, BINDING
   * layout). Owns data fetching (edit-mode prefill, registry-driven
   * workflow picker), submission, and the Drawer chrome; field rendering is
   * `schedule-form-fields.svelte`.
   */
  import { Button, Drawer, Skeleton } from '@lostgradient/cinder';
  import { CalendarPlus, Lock } from 'lucide-svelte';

  import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';

  import { getClient } from '../../lib/client.ts';
  import { faultTreatment } from '../../lib/faults.ts';
  import { queryKeys } from '../../lib/query.ts';
  import { router } from '../../lib/router.svelte.ts';
  import { getPrincipalStore, scopeGate } from '../../lib/scopes.svelte.ts';
  import { cadenceToScheduleValue, scheduleValueToWireSpec } from './cadence.ts';
  import FaultBanner from './fault-banner.svelte';
  import ScheduleFormFields from './schedule-form-fields.svelte';
  import { ScheduleFormState } from './schedule-form-state.svelte.ts';
  import {
    createSchedule,
    fetchRegisteredWorkflowTypes,
    fetchScheduleDetail,
    pauseSchedule,
    scheduleDetailQueryKey,
    updateScheduleSpec,
  } from './schedule-queries.ts';

  interface Props {
    mode: 'create' | 'edit';
    /** Required when `mode === 'edit'`. */
    scheduleId?: string | undefined;
    onClose: () => void;
  }

  let { mode, scheduleId, onClose }: Props = $props();

  const client = getClient();
  const principal = getPrincipalStore();
  const queryClient = useQueryClient();
  const writeGate = $derived(scopeGate(principal, ['schedules:write']));

  /** Degrades to a free-text field on error/pending — the create action itself only needs `schedules:write`, not `system:read` (this query's scope). */
  const registryQuery = createQuery(() => ({
    queryKey: queryKeys.registry(),
    queryFn: () => fetchRegisteredWorkflowTypes(client),
  }));
  const workflowTypeOptions = $derived(registryQuery.isSuccess ? registryQuery.data : undefined);

  const editDetailQuery = createQuery(() => ({
    queryKey: scheduleDetailQueryKey(scheduleId ?? ''),
    queryFn: () => fetchScheduleDetail(client, scheduleId ?? ''),
    enabled: mode === 'edit' && scheduleId !== undefined,
  }));

  let form = $state<ScheduleFormState>();

  $effect(() => {
    if (mode === 'create') {
      form = new ScheduleFormState();
      return;
    }
    const schedule = editDetailQuery.data;
    if (!schedule) return;
    form = new ScheduleFormState({
      id: schedule.id,
      workflowType: schedule.workflowType,
      cadence: cadenceToScheduleValue(schedule),
      overlap: schedule.overlap,
      jitterText: schedule.jitterMs !== undefined ? `${schedule.jitterMs}ms` : '',
      backfill: schedule.backfill,
      revisionPolicy: schedule.revisionPolicy,
    });
  });

  function invalidateSchedules(): void {
    void queryClient.invalidateQueries({ queryKey: ['schedules'] });
  }

  const createScheduleMutation = createMutation(() => ({
    mutationFn: async () => {
      if (!form) throw new Error('Form not ready.');
      const created = await createSchedule(client, form.toCreateArgs());
      if (form.startPaused) await pauseSchedule(client, created.id);
      return created;
    },
    onSuccess: (created) => {
      invalidateSchedules();
      onClose();
      router.navigate(`/schedules?id=${encodeURIComponent(created.id)}`);
    },
  }));

  const updateScheduleMutation = createMutation(() => ({
    mutationFn: async () => {
      if (!form || scheduleId === undefined) throw new Error('Form not ready.');
      await updateScheduleSpec(
        client,
        scheduleId,
        scheduleValueToWireSpec(form.cadence),
        form.toUpdateRevisionPolicy(),
      );
    },
    onSuccess: () => {
      invalidateSchedules();
      onClose();
    },
  }));

  const submitting = $derived(
    mode === 'create' ? createScheduleMutation.isPending : updateScheduleMutation.isPending,
  );
  const submitError = $derived(
    mode === 'create' ? createScheduleMutation.error : updateScheduleMutation.error,
  );

  function submit(): void {
    if (!form || !form.isValid || submitting) return;
    if (mode === 'create') createScheduleMutation.mutate();
    else updateScheduleMutation.mutate();
  }

  let open = $state(true);

  $effect(() => {
    if (!open) onClose();
  });
</script>

<Drawer bind:open title={mode === 'create' ? 'Create schedule' : 'Edit schedule'} size="md">
  {#snippet header()}
    <div class="weft-schedule-drawer__header">
      <CalendarPlus aria-hidden="true" size={16} />
      <span class="weft-schedule-drawer__title">
        {mode === 'create' ? 'Create schedule' : 'Edit schedule'}
      </span>
    </div>
  {/snippet}

  {#if mode === 'edit' && editDetailQuery.isPending}
    <div role="status" aria-busy="true" aria-label="Loading schedule">
      <Skeleton height="220px" />
    </div>
  {:else if mode === 'edit' && editDetailQuery.isError}
    <FaultBanner
      treatment={faultTreatment(editDetailQuery.error)}
      onRetry={() => void editDetailQuery.refetch()}
    />
  {:else if mode === 'edit' && editDetailQuery.data === null}
    <FaultBanner
      treatment={{
        kind: 'not-found',
        message: `No schedule with id "${scheduleId}" exists — it may have been cancelled and purged.`,
      }}
    />
  {:else if form}
    <!--
      Keyed on `form` itself (WFT-117, Codex review round 2): the `$effect`
      above can reconstruct `form` as a brand-new `ScheduleFormState` while
      this drawer stays open (e.g. a background `editDetailQuery` refetch).
      `ScheduleFormFields` captures `form.revisionPolicy` into a one-shot
      local draft at mount, which is correct only if a NEW `form` instance
      always gets a FRESH mount — `{#key}` guarantees that instead of
      leaving a stale draft to silently overwrite the new form's value.
    -->
    {#key form}
      <ScheduleFormFields {form} {mode} {workflowTypeOptions} />
    {/key}
    {#if submitError}
      <FaultBanner treatment={faultTreatment(submitError)} />
    {/if}
  {/if}

  {#snippet footer()}
    <div class="weft-schedule-drawer__footer">
      <span class="weft-schedule-drawer__service-note">Runs as schedules service account</span>
      <Button variant="ghost" size="sm" onclick={() => (open = false)}>Cancel</Button>
      <Button
        variant="primary"
        size="sm"
        disabled={!form || !form.isValid || writeGate.disabled || submitting}
        onclick={submit}
      >
        {mode === 'create' ? 'Create schedule' : 'Save changes'}
      </Button>
      {#if writeGate.disabled}
        <span class="weft-schedule-drawer__scope-pill">
          <Lock aria-hidden="true" size={12} />
          {writeGate.title}
        </span>
      {/if}
    </div>
  {/snippet}
</Drawer>

<style>
  .weft-schedule-drawer__header {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .weft-schedule-drawer__title {
    font-size: var(--cinder-text-md, 15px);
    font-weight: 600;
  }

  .weft-schedule-drawer__footer {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .weft-schedule-drawer__service-note {
    font-size: var(--cinder-text-2xs);
    color: var(--cinder-text-disabled);
  }

  .weft-schedule-drawer__scope-pill {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 6px 10px;
    background: var(--cinder-surface-raised);
    border: 1px solid var(--cinder-border);
    border-radius: var(--cinder-radius-md);
    font-size: var(--cinder-text-2xs);
    color: var(--cinder-text-subtle);
    box-shadow: var(--cinder-shadow-sm);
  }
</style>
