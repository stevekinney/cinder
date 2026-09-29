<script lang="ts">
  /**
   * Dashboard (plan §9.1; design `Weft UI.dc.html` dashboard screen).
   * Three bands — critical alerts, aggregate cards, recent-activity feed —
   * behind a page-level state machine matching the design's four states
   * (default/loading/empty/unreachable, Appendix B). Bands own their own
   * independent skeletons/errors for anything past this initial gate (this
   * track's brief: "independent per-band skeletons").
   *
   * Query option getters track reactive inputs, including the health gate
   * below. Results expose reactive properties directly and their effects
   * are disposed with the component.
   */
  import { ArrowRight, Rocket, WifiOff } from 'lucide-svelte';
  import { Button, CodeBlock, EmptyState, Skeleton } from '@lostgradient/cinder';
  import { createQuery } from '@tanstack/svelte-query';

  import { getClient } from '../../lib/client.ts';
  import { formatRelativeTime } from '../../lib/format/index.ts';
  import { queryKeys } from '../../lib/query.ts';
  import { router } from '../../lib/router.svelte.ts';
  import AggregateCardsBand from './aggregate-cards-band.svelte';
  import { parseWorkflowAggregateResult } from './aggregate-output.ts';
  import ActivityFeedBand from './activity-feed-band.svelte';
  import CriticalAlertsBand from './critical-alerts-band.svelte';
  import { probeHealth } from './health-probe.ts';

  const client = getClient();

  const HEALTH_POLL_INTERVAL_MS = 30_000;

  const healthQuery = createQuery(() => ({
    queryKey: ['dashboard', 'health'],
    queryFn: () => probeHealth(client),
    refetchInterval: HEALTH_POLL_INTERVAL_MS,
  }));

  const statusQuery = createQuery(() => ({
    queryKey: queryKeys.workflows.aggregate('status', {}),
    queryFn: async () =>
      parseWorkflowAggregateResult(
        await client.operations['weft.workflows.aggregate']({ groupBy: 'status' }),
      ),
    enabled: healthQuery.isSuccess,
  }));

  const isGateLoading = $derived(
    healthQuery.isPending || (healthQuery.isSuccess && statusQuery.isPending),
  );
  const isUnreachable = $derived(healthQuery.isError);
  const isEmpty = $derived(statusQuery.isSuccess && statusQuery.data.total === 0);

  const registrySnippet = `import { Engine, workflow } from '@lostgradient/weft';

const myWorkflow = workflow({ name: 'my-workflow' }).execute(async function* (ctx, input) {
  // ...
});

const engine = await Engine.create({
  workflows: { 'my-workflow': myWorkflow },
});
await engine.start('my-workflow', input);`;
</script>

<div class="weft-dashboard">
  <div class="weft-dashboard__header">
    <div>
      <h1 class="weft-dashboard__title">Operations overview</h1>
      <p class="weft-dashboard__subtitle">
        Cross-domain health
        {#if healthQuery.dataUpdatedAt > 0}
          · refreshed {formatRelativeTime(healthQuery.dataUpdatedAt)}
        {/if}
      </p>
    </div>
  </div>

  {#if isGateLoading}
    <div
      class="weft-dashboard__gate-skeleton"
      role="status"
      aria-busy="true"
      aria-label="Loading dashboard"
    >
      <div class="weft-dashboard__gate-skeleton-grid">
        <Skeleton height="7.5rem" />
        <Skeleton height="7.5rem" />
        <Skeleton height="8.2rem" />
        <Skeleton height="8.2rem" />
      </div>
      <Skeleton height="12rem" />
    </div>
  {:else if isUnreachable}
    <div class="weft-dashboard__full-state">
      <EmptyState title="Server unreachable" description="The health probe failed to respond.">
        {#snippet icon()}
          <WifiOff aria-hidden="true" size={24} />
        {/snippet}
        {#snippet action()}
          <Button
            variant="secondary"
            label="Retry probe"
            onclick={() => void healthQuery.refetch()}
          />
        {/snippet}
      </EmptyState>
    </div>
  {:else if isEmpty}
    <div class="weft-dashboard__full-state">
      <EmptyState
        title="No workflow activity yet"
        description="Register a workflow definition and start a run from your worker to see operational data here."
      >
        {#snippet icon()}
          <Rocket aria-hidden="true" size={24} />
        {/snippet}
        {#snippet action()}
          {#snippet arrowRight()}
            <ArrowRight aria-hidden="true" size={15} />
          {/snippet}
          <Button
            variant="primary"
            label="Open registry setup"
            trailingIcon={arrowRight}
            onclick={() => router.navigate('/system')}
          />
        {/snippet}
      </EmptyState>
      <CodeBlock
        code={registrySnippet}
        language="ts"
        highlight={false}
        copyable
        class="weft-dashboard__snippet"
      />
    </div>
  {:else}
    <CriticalAlertsBand />
    <AggregateCardsBand {statusQuery} />
    <ActivityFeedBand />
  {/if}
</div>
