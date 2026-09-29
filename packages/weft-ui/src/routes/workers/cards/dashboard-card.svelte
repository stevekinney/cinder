<script lang="ts">
  /**
   * Workers dashboard card (plan §9.4: "Dashboard card: fill
   * `src/routes/workers/cards/dashboard-card.svelte` (fleet capacity +
   * unhealthy count + diagnostics chips summary)"; card-slot contract
   * `src/routes/dashboard/cards.ts`). Self-contained and zero-prop, matching
   * the Reviews track's card (`reviews/cards/dashboard-card.svelte`) — every
   * card in the registry is, since `DashboardCardEntry.component: Component`
   * carries no prop generics — so this builds its own scoped queries rather
   * than receiving them from the dashboard route.
   */
  import { Badge, Card, EmptyState, Skeleton, Statistic } from '@lostgradient/cinder';

  import { getClient } from '../../../lib/client.ts';
  import { faultTreatment } from '../../../lib/faults.ts';
  import { router } from '../../../lib/router.svelte.ts';
  import { getPrincipalStore, scopeReason } from '../../../lib/scopes.svelte.ts';
  import { DIAGNOSTIC_GUIDANCE, DIAGNOSTIC_KINDS } from '../diagnostics-guidance.ts';
  import { summarizeFleet } from '../worker-presentation.ts';
  import { taskDiagnosticsQuery, workersListQuery } from '../workers-data.ts';

  const client = getClient();
  const principalStore = getPrincipalStore();
  const locked = $derived(!principalStore.hasScope('system:read'));

  const workersQuery = workersListQuery(client);
  const diagnosticsQuery = taskDiagnosticsQuery(client);

  const totals = $derived(summarizeFleet(workersQuery.data?.items ?? []));
  const unhealthyCount = $derived(
    (workersQuery.data?.items ?? []).filter((worker) => worker.health === 'drained').length +
      totals.drainingWorkers,
  );

  const activeDiagnosticKinds = $derived(
    DIAGNOSTIC_KINDS.filter((kind) =>
      (diagnosticsQuery.data?.items ?? []).some((item) => item.kind === kind),
    ),
  );

  const isLoading = $derived(workersQuery.isPending || diagnosticsQuery.isPending);
  const firstError = $derived(workersQuery.error ?? diagnosticsQuery.error ?? null);

  function onCardClick(event: MouseEvent): void {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }
    event.preventDefault();
    router.navigate('/workers');
  }
</script>

<a
  href={router.href('/workers')}
  onclick={onCardClick}
  class="weft-workers-card-link"
  aria-label="Workers"
>
  <Card padding="none" class="weft-dashboard-card">
    {#snippet header()}
      <span class="weft-dashboard-card__title">Workers</span>
    {/snippet}

    {#if locked}
      <EmptyState title="Locked" description={scopeReason('system:read')} headingLevel={4} />
    {:else if isLoading}
      <div
        class="weft-workers-card__skeleton"
        role="status"
        aria-busy="true"
        aria-label="Loading fleet status"
      >
        <Skeleton height="3rem" />
      </div>
    {:else if firstError}
      <p class="weft-workers-card__error">{faultTreatment(firstError).message}</p>
    {:else}
      <div class="weft-workers-card__stats">
        <Statistic label="Capacity" value={`${totals.inFlight} / ${totals.capacity}`} />
        <Statistic label="Unhealthy" value={unhealthyCount} />
      </div>
      {#if activeDiagnosticKinds.length > 0}
        <div class="weft-workers-card__diagnostics">
          {#each activeDiagnosticKinds as kind (kind)}
            <Badge variant={DIAGNOSTIC_GUIDANCE[kind].variant} size="sm"
              >{DIAGNOSTIC_GUIDANCE[kind].title}</Badge
            >
          {/each}
        </div>
      {/if}
    {/if}
  </Card>
</a>
