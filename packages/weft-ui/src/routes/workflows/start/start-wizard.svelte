<script lang="ts">
  /**
   * Start Workflow wizard (plan §9.2 T2.3). `Steps` (Cinder) header +
   * Type/Configure/Review step bodies. Reads the registry for the type
   * search and the selected type's `inputSchema` (`system:read`,
   * gracefully degraded — see `type-step.svelte`); submits via
   * `client.start()` (`workflows:write`).
   */
  import { X } from 'lucide-svelte';
  import { Steps } from '@lostgradient/cinder';
  import type { StepItem } from '@lostgradient/cinder';
  import { createQuery, useQueryClient } from '@tanstack/svelte-query';

  import { getClient } from '../../../lib/client.ts';
  import { faultTreatment } from '../../../lib/faults.ts';
  import { WORKFLOWS_LIST_KEY_PREFIX } from '../../../lib/live-source/cache-integration.ts';
  import { queryKeys } from '../../../lib/query.ts';
  import { router } from '../../../lib/router.svelte.ts';
  import { getPrincipalStore, scopeGate } from '../../../lib/scopes.svelte.ts';
  import ConfigureStep, { type ConfigureStepMode } from './configure-step.svelte';
  import { narrowRegistryWorkflows } from './registry-types.ts';
  import ReviewStep, { type StartSubmitState } from './review-step.svelte';
  import {
    buildStartOptions,
    EMPTY_ADVANCED_START_OPTIONS,
    type AdvancedStartOptionsInput,
  } from './start-wizard-state.ts';
  import TypeStep from './type-step.svelte';

  const client = getClient();
  const principalStore = getPrincipalStore();
  const queryClient = useQueryClient();
  const startGate = $derived(scopeGate(principalStore, ['workflows:write']));
  const registryGate = $derived(scopeGate(principalStore, ['system:read']));

  const registryQuery = createQuery(() => ({
    queryKey: queryKeys.registry(),
    queryFn: () => client.operations['weft.system.registry']({}),
    enabled: !registryGate.disabled,
    retry: false,
  }));

  const registryWorkflows = $derived(
    narrowRegistryWorkflows(registryQuery.data?.workflows, registryQuery.data?.activeRevisions),
  );
  const knownTypes = $derived(Object.keys(registryWorkflows));

  const STEPS: StepItem[] = [
    { id: 'type', label: 'Type' },
    { id: 'configure', label: 'Configure' },
    { id: 'review', label: 'Review' },
  ];

  let currentStep = $state(0);
  let workflowType = $state('');
  let configureMode = $state<ConfigureStepMode>('form');
  let rawText = $state('');
  let advanced = $state<AdvancedStartOptionsInput>(EMPTY_ADVANCED_START_OPTIONS);
  let payload = $state<unknown>(undefined);
  let submitState = $state<StartSubmitState>({ status: 'idle' });

  const selectedSchema = $derived(registryWorkflows[workflowType]?.inputSchema);

  /**
   * NOT read directly as `registryWorkflows[workflowType]?.revision` at the
   * Review step call site below (Codex review, PR #978, round 6). TanStack
   * Query keeps the PREVIOUS successful `data` around across a failed
   * refetch alongside `isError: true` — the same class of gap the
   * workflow-detail active-revision comparison closed in an earlier round.
   * Without this guard, a registry refresh that fails after an earlier
   * success would keep showing the STALE active revision as current fact
   * (e.g. revision B activated externally, then the refresh itself fails)
   * instead of falling back to the Review step's own "Active revision
   * unknown" branch, which already treats `undefined` correctly.
   */
  const reviewActiveRevision = $derived(
    registryQuery.isError ? undefined : registryWorkflows[workflowType]?.revision,
  );

  $effect(() => {
    // A schema-less type has nothing to switch "form" mode INTO — pin JSON
    // mode automatically so the segmented control (only rendered when a
    // schema exists) never gets out of sync with an unreachable mode.
    if (!selectedSchema) configureMode = 'json';
  });

  function onTypeContinue(): void {
    currentStep = 1;
  }

  function onConfigureBack(): void {
    currentStep = 0;
  }

  function onConfigureContinue(value: unknown): void {
    payload = value;
    currentStep = 2;
  }

  function onReviewBack(): void {
    currentStep = 1;
  }

  function onClose(): void {
    router.navigate('/workflows');
  }

  async function onSubmit(): Promise<void> {
    submitState = { status: 'pending' };
    try {
      const handle = await client.start(workflowType, payload, buildStartOptions(advanced));
      submitState = { status: 'success', workflowId: handle.id };
      void queryClient.invalidateQueries({ queryKey: WORKFLOWS_LIST_KEY_PREFIX });
    } catch (error) {
      const treatment = faultTreatment(error);
      submitState = {
        status: 'error',
        error,
        isSpentIdempotencyKey: treatment.kind === 'conflict' && treatment.isSpentIdempotencyKey,
      };
    }
  }
</script>

<div class="weft-start-wizard">
  <div class="weft-start-wizard__header">
    <h1>Start workflow</h1>
    <button type="button" class="weft-start-wizard__close" aria-label="Close" onclick={onClose}>
      <X aria-hidden="true" size={16} />
    </button>
  </div>

  {#if startGate.disabled}
    <p class="weft-start-wizard__denied" role="alert">
      {startGate.title}
    </p>
  {:else}
    <Steps steps={STEPS} {currentStep} label="Start workflow progress" />

    {#if currentStep === 0}
      <TypeStep
        {knownTypes}
        registryLoading={registryQuery.isPending && !registryGate.disabled}
        value={workflowType}
        onValueChange={(next) => (workflowType = next)}
        onContinue={onTypeContinue}
      />
    {:else if currentStep === 1}
      <ConfigureStep
        schema={selectedSchema}
        mode={configureMode}
        onModeChange={(mode) => (configureMode = mode)}
        {rawText}
        onRawTextChange={(text) => (rawText = text)}
        {advanced}
        onAdvancedChange={(next) => (advanced = next)}
        onContinue={onConfigureContinue}
        onBack={onConfigureBack}
      />
    {:else}
      <ReviewStep
        type={workflowType}
        {payload}
        {advanced}
        {submitState}
        onBack={onReviewBack}
        {onSubmit}
        activeRevision={reviewActiveRevision}
      />
    {/if}
  {/if}
</div>
