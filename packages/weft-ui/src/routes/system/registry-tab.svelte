<script lang="ts">
  /**
   * Registry tab (plan §9.7 T7.2; design `Weft UI.dc.html` "System" §
   * REGISTRY). List of registered workflow definitions + activity
   * definitions grid, with a click-through detail panel. Data comes from
   * `weft.system.registry` — reachable only via `client.operations[...]`
   * (no ergonomic `HttpClient` method exists for it), which is JSON-RPC-only
   * transport (see `discovery-client.ts`'s module doc for the same
   * observation about a different surface) — correct, sanctioned usage per
   * PROJECT-BRIEF, and exercisable end-to-end against `bun run dev:server`
   * as of `@lostgradient/weft@0.12.0` (`scripts/dev-server.ts`'s plain
   * `serve()` now routes `/jsonrpc`).
   */
  import { Badge, EmptyState, Table, Skeleton } from '@lostgradient/cinder';
  import { GitBranch, Zap } from 'lucide-svelte';
  import { createQuery } from '@tanstack/svelte-query';

  import type { RetryPolicy } from '@lostgradient/weft';

  import { getClient } from '../../lib/client.ts';
  import { formatDuration } from '../../lib/format/index.ts';
  import { queryKeys } from '../../lib/query.ts';
  import ManifestDiagnosticsView from '../workers/manifest-diagnostics-view.svelte';
  import {
    loadFleetManifestDiagnostics,
    loadWorkerRegistrationRejections,
  } from '../workers/workers-data.ts';
  import DynamicSourcePanel from './dynamic-source-panel.svelte';
  import QueryFaultBanner from './query-fault-banner.svelte';
  import RegistryDetail from './registry-detail.svelte';
  import {
    isRegistryEmpty,
    registryActivityRows,
    registryWorkflowRows,
    type RegistrySnapshotSource,
  } from './registry-view.ts';

  const client = getClient();

  const query = createQuery(() => ({
    queryKey: queryKeys.registry(),
    queryFn: (): Promise<RegistrySnapshotSource> =>
      client.operations['weft.system.registry']({}) as Promise<RegistrySnapshotSource>,
  }));

  const workersQuery = createQuery(() => ({
    queryKey: queryKeys.workers.list(),
    queryFn: () => client.operations['weft.workers.list']({}),
    refetchInterval: 30_000,
  }));
  const workerIds = $derived(
    (workersQuery.data?.items ?? []).map((worker) => worker.id).toSorted(),
  );
  const manifestsQuery = createQuery(() => ({
    queryKey: queryKeys.workers.manifests(workerIds),
    queryFn: () => loadFleetManifestDiagnostics(client, workerIds),
    enabled: !workersQuery.isPending,
    refetchInterval: 30_000,
  }));
  const rejectionsQuery = createQuery(() => ({
    queryKey: queryKeys.workers.rejections(),
    queryFn: () => loadWorkerRegistrationRejections(client),
    refetchInterval: 30_000,
  }));

  let selectedType = $state<string | null>(null);

  /**
   * Weft's `Duration` (`@lostgradient/weft`) is `number | string` — a
   * numeric activity timeout is milliseconds, a string one is already
   * unit-qualified (e.g. `'30s'`). Rendering a bare number verbatim reads
   * as an ambiguous, unitless value next to string durations; the numeric
   * case goes through the same `formatDuration` helper `formatRelativeTime`
   * already uses.
   */
  function formatActivityTimeout(timeout: number | string): string {
    return typeof timeout === 'number' ? formatDuration(timeout) : timeout;
  }

  /**
   * A single `retry: 3x` badge understated `RetryPolicy` (`@lostgradient/weft`)
   * down to only `maxAttempts` — hiding whether retries back off over
   * seconds or hours (`initialBackoff`/`backoffMultiplier`/`maxBackoff`,
   * each also `Duration`-typed) and which failures never retry at all
   * (`nonRetryableErrors`). Renders the full policy in one badge string;
   * `nonRetryableErrors` gets its own badge below since its length varies
   * and it is operationally distinct information.
   */
  function formatRetryPolicy(retry: RetryPolicy): string {
    const initial = formatActivityTimeout(retry.initialBackoff);
    const max = formatActivityTimeout(retry.maxBackoff);
    return `retry: ${retry.maxAttempts}x, ${initial}→${max} ×${retry.backoffMultiplier}`;
  }
</script>

{#snippet registryBadge(label: string, variant: 'neutral' | 'success')}
  <Badge {variant}>{label}</Badge>
{/snippet}

<!--
  Rendered above the registry query's own branches, and independent of it: a
  `registerSource()`-registered workflow never appears in the
  `weft.system.registry` snapshot (see `<DynamicSourcePanel>`'s module doc),
  so an engine whose workflows are ALL dynamic renders the eager-definition
  empty state below while still having sources an operator needs to inspect.
  The source list fills exact keys, and the per-key lookup remains the sole
  load-diagnostics surface. The panel is hidden while a definition detail view
  is open.

  Hiding it destroys the instance, so a typed lookup and any outcome banner are
  gone on return from a detail view. Accepted: the panel is a point lookup, not
  a session, and everything it shows is one live query away. Noted rather than
  silently relied on — if it ever grows state worth keeping across that
  navigation, this needs to become a CSS hide instead of an `{#if}`.
-->
{#if selectedType === null}
  <DynamicSourcePanel />
{/if}

{#if query.isPending}
  <div class="weft-registry-skeleton" role="status" aria-busy="true" aria-label="Loading registry">
    <Skeleton height="1.25rem" width="220px" />
    <Skeleton height="220px" />
    <Skeleton height="140px" />
  </div>
{:else if query.isError}
  <QueryFaultBanner error={query.error} onRetry={() => query.refetch()} />
{:else if isRegistryEmpty(query.data)}
  <!--
    Scoped to what this snapshot actually covers. `weft.system.registry` lists
    eager registrations only, so an engine whose workflows are all
    `registerSource()`-registered renders this state permanently — even right
    after an operator successfully preloads one in the panel above. "Nothing is
    registered with this engine" would be flatly untrue there.
  -->
  <EmptyState
    title="Registry · 3-step onboarding"
    description="No eagerly registered workflow or activity definitions appear in this engine's registry snapshot. Dynamic sources never appear here — use Dynamic workflow sources above."
  >
    {#snippet icon()}
      <GitBranch aria-hidden="true" size={26} />
    {/snippet}
  </EmptyState>
  <ol class="weft-registry-onboarding">
    <li>Install the SDK — <code>bun add @lostgradient/weft</code></li>
    <li>Define a workflow — <code>workflow({'{'} name {'}'} ).execute(...)</code></li>
    <li>Connect a worker — start the process that registers it with this engine</li>
  </ol>
{:else}
  {@const workflowRows = registryWorkflowRows(query.data)}
  {@const activityRows = registryActivityRows(query.data)}
  {@const selectedRow = workflowRows.find((row) => row.type === selectedType)}
  {#if selectedRow}
    <RegistryDetail row={selectedRow} onBack={() => (selectedType = null)} />
  {:else}
    <div class="weft-registry-list">
      <div class="weft-registry-list__header">
        <span class="weft-registry-list__title">Workflow definitions</span>
        <span class="weft-registry-list__count">{workflowRows.length} registered</span>
      </div>

      <Table class="weft-registry-list__table" caption="Workflow definitions" scrollable>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Name</Table.HeaderCell>
            <Table.HeaderCell>Description</Table.HeaderCell>
            <Table.HeaderCell>Input schema</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each workflowRows as row (row.type)}
            <Table.Row>
              <Table.Cell as="th">
                <button
                  type="button"
                  class="weft-registry-list__row-button"
                  onclick={() => (selectedType = row.type)}
                >
                  <span class="weft-registry-list__row-icon"
                    ><GitBranch aria-hidden="true" size={14} /></span
                  >
                  <span class="weft-registry-list__row-name">{row.type}</span>
                </button>
              </Table.Cell>
              <Table.Cell>{row.description ?? '—'}</Table.Cell>
              <Table.Cell>
                {#if row.hasInputSchema}
                  {@render registryBadge(
                    `${row.inputFields.length} field${row.inputFields.length === 1 ? '' : 's'}`,
                    'success',
                  )}
                {:else}
                  {@render registryBadge('none', 'neutral')}
                {/if}
              </Table.Cell>
            </Table.Row>
          {/each}
        </Table.Body>
      </Table>

      <div class="weft-registry-list__header" style="margin-top:26px;">
        <span class="weft-registry-list__title">Activity definitions</span>
        <span class="weft-registry-list__count">{activityRows.length} registered</span>
      </div>

      {#if activityRows.length === 0}
        <p class="weft-registry-list__empty-note">No activities registered for this engine.</p>
      {:else}
        <div class="weft-registry-activity-grid">
          {#each activityRows as activity (activity.name)}
            <div class="weft-registry-activity-card">
              <div class="weft-registry-activity-card__header">
                <span class="weft-registry-activity-card__icon"
                  ><Zap aria-hidden="true" size={14} /></span
                >
                <span class="weft-registry-activity-card__name">{activity.name}</span>
              </div>
              <div class="weft-registry-activity-card__meta">
                {@render registryBadge(`queue: ${activity.queue}`, 'neutral')}
                {#if activity.hasInputSchema}
                  {@render registryBadge(
                    `${activity.inputFields.length} field${activity.inputFields.length === 1 ? '' : 's'}`,
                    'success',
                  )}
                {/if}
                {#if activity.retry}
                  {@render registryBadge(formatRetryPolicy(activity.retry), 'neutral')}
                  {#if activity.retry.nonRetryableErrors?.length}
                    {@render registryBadge(
                      `never retries: ${activity.retry.nonRetryableErrors.join(', ')}`,
                      'neutral',
                    )}
                  {/if}
                {/if}
                {#if activity.timeout !== undefined}
                  {@render registryBadge(
                    `timeout: ${formatActivityTimeout(activity.timeout)}`,
                    'neutral',
                  )}
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
{/if}

<ManifestDiagnosticsView
  heading="Worker registry admission diagnostics"
  diagnostics={manifestsQuery.data ?? []}
  rejections={rejectionsQuery.data ?? []}
  loading={workersQuery.isPending || manifestsQuery.isPending || rejectionsQuery.isPending}
  refreshing={(manifestsQuery.isFetching && manifestsQuery.data !== undefined) ||
    (rejectionsQuery.isFetching && rejectionsQuery.data !== undefined)}
  error={workersQuery.error ?? manifestsQuery.error ?? rejectionsQuery.error ?? null}
/>

<style>
  .weft-registry-skeleton {
    max-width: 1000px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .weft-registry-onboarding {
    max-width: 420px;
    margin: 16px auto 0;
    padding-inline-start: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: var(--cinder-text-sm);
    color: var(--cinder-text-muted);
  }

  .weft-registry-list__header {
    display: flex;
    align-items: baseline;
    gap: 9px;
    margin-bottom: 10px;
  }

  /* The table's own `caption` prop stays present for assistive tech (naming
   * the table) but visually hidden — `.weft-registry-list__header` above is
   * the sighted-user label, and rendering both duplicated "Workflow
   * definitions" on screen. Standard clip-based sr-only pattern, matching
   * Cinder's own sr-only utility class. Table's public `class` prop is forwarded
   * to its own `<table>` root (`weft-registry-list__table` above), so this
   * targets the native `<caption>` element as a descendant of that app-owned
   * root instead of naming Cinder's private caption class. */
  :global(.weft-registry-list__table caption) {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .weft-registry-list__title {
    font-size: var(--cinder-text-sm);
    font-weight: 600;
  }

  .weft-registry-list__count {
    font-size: var(--cinder-text-xs);
    color: var(--cinder-text-subtle);
  }

  .weft-registry-list__empty-note {
    font-size: var(--cinder-text-sm);
    color: var(--cinder-text-subtle);
  }

  .weft-registry-list__row-button {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    border: 0;
    background: transparent;
    padding: 0;
    color: inherit;
    font: inherit;
    font-weight: 600;
    font-family: var(--cinder-font-mono);
    cursor: pointer;
  }

  .weft-registry-list__row-icon {
    display: grid;
    place-items: center;
    width: 27px;
    height: 27px;
    border-radius: 7px;
    background: color-mix(in oklch, var(--cinder-accent), transparent 88%);
    color: var(--cinder-accent-text);
    flex: none;
  }

  .weft-registry-list__row-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .weft-registry-activity-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 12px;
  }

  .weft-registry-activity-card {
    background: var(--cinder-surface-raised);
    border: 1px solid var(--cinder-border);
    border-radius: var(--cinder-radius-lg);
    padding: 14px 16px;
  }

  .weft-registry-activity-card__header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
    min-width: 0;
  }

  .weft-registry-activity-card__icon {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: 7px;
    background: var(--cinder-surface-inset);
    color: var(--cinder-color-warning-fg);
    flex: none;
  }

  .weft-registry-activity-card__name {
    font-family: var(--cinder-font-mono);
    font-size: var(--cinder-text-sm);
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .weft-registry-activity-card__meta {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
</style>
