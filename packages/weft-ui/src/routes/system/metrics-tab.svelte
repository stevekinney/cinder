<script lang="ts">
  /**
   * Metrics tab (plan §9.7 T7.2; design `Weft UI.dc.html` "System" §
   * METRICS). Dashboard view (`StatGroup` + `LineChart` sparklines, ~15s
   * `PollingSource`) / Raw view (`GET /v1/metrics` Prometheus text in
   * `CodeBlock` + copy/download).
   *
   * Sparklines are built from a session-local rolling buffer of polls
   * (`metrics-history.ts`'s module doc explains why: `MetricsSnapshot` is a
   * point-in-time snapshot with no history of its own).
   *
   * The raw view's `CodeBlock` passes `highlight={false}` alongside
   * `language="text"`: Prometheus's line-oriented exposition format has no
   * Shiki grammar, and `"text"` isn't a key in Shiki's `bundledLanguages`
   * table (verified directly against the installed `shiki` package) — only
   * an EMPTY `language` short-circuits to plaintext without going through
   * the highlighter at all (`code-block-default-highlighter`'s module doc).
   * `highlight={false}` is Cinder's documented off switch for exactly this:
   * it keeps the "text" header label while skipping the Shiki attempt (and
   * the resulting "language not in Shiki's bundle" console warning)
   * entirely.
   */
  import {
    CodeBlock,
    Button,
    ConnectionIndicator,
    LineChart,
    Segment,
    SegmentedControl,
    Statistic,
    StatisticGroup,
  } from '@lostgradient/cinder';
  import { Download } from 'lucide-svelte';
  import { createQuery } from '@tanstack/svelte-query';
  import { onDestroy } from 'svelte';

  import { getClient } from '../../lib/client.ts';
  import { PollingSource } from '../../lib/live-source/polling-source.svelte.ts';
  import type { LiveSourceStatus } from '../../lib/live-source/types.ts';
  import { fetchRawMetricsText } from './discovery-client.ts';
  import { metricPointValue, MetricsHistory, type MetricsSnapshotLike } from './metrics-history.ts';
  import QueryFaultBanner from './query-fault-banner.svelte';

  const client = getClient();

  let view = $state<'dashboard' | 'raw'>('dashboard');

  const METRICS_POLL_INTERVAL_MS = 15_000;
  const TRACKED_METRICS: readonly { readonly name: string; readonly label: string }[] = [
    { name: 'weft.workflow.active', label: 'Active workflows' },
    { name: 'weft.workflow.completed', label: 'Completed' },
    { name: 'weft.workflow.failed', label: 'Failed' },
  ];

  const history = new MetricsHistory();
  let latest = $state<MetricsSnapshotLike | undefined>(undefined);

  const polling = new PollingSource<MetricsSnapshotLike>(
    () => client.operations['weft.system.metrics']({}) as Promise<MetricsSnapshotLike>,
    { intervalMs: METRICS_POLL_INTERVAL_MS },
  );

  const unsubscribe = polling.subscribe((snapshot) => {
    history.push(snapshot);
    latest = snapshot;
  });

  const pollStatus = $derived<LiveSourceStatus>(polling.status);

  onDestroy(() => {
    unsubscribe();
    polling.close();
  });

  const rawQuery = createQuery(() => ({
    queryKey: ['system', 'metrics', 'raw'],
    queryFn: () => fetchRawMetricsText(client),
    enabled: false,
    // `query.ts`'s QueryClient-level default retries any error that never
    // crossed the Weft fault wire, on the theory that it's a transient
    // network blip — correct for `HttpClientError`, but `fetchRawMetricsText`
    // throws `DiscoveryFetchError` (`discovery-client.ts`'s module doc: kept
    // deliberately distinct from `HttpClientError`), a definitive failure
    // from a small, fixed root-stable route. Retrying it 3x with exponential
    // backoff before showing the fault banner is pure latency for no benefit
    // — the banner's own Retry button is the real "try again" affordance.
    retry: false,
  }));

  /**
   * Triggers the raw-text fetch on switching to the Raw view, as a direct
   * response to the user's own action rather than a `$effect` that reads
   * `rawQuery` — an effect that both depends on a store's value AND calls a
   * mutating method on that same store (`refetch()`) re-triggers itself on
   * every state transition the refetch causes (pending → success), firing
   * repeatedly instead of once. Driving it from the event handler sidesteps
   * that: reading `rawQuery` inside a plain callback never registers a
   * reactive dependency.
   */
  function onViewChange(next: 'dashboard' | 'raw'): void {
    view = next;
    if (next === 'raw') void rawQuery.refetch();
  }

  function downloadRaw(): void {
    const text = rawQuery.data ?? '';
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'weft-metrics.txt';
    anchor.click();
    URL.revokeObjectURL(url);
  }
</script>

<div class="weft-metrics-tab">
  <div class="weft-metrics-tab__toolbar">
    <SegmentedControl
      id="metrics-view"
      label="Metrics view"
      labelVisible={false}
      value={view}
      onValueChange={onViewChange}
    >
      <Segment value="dashboard">Dashboard</Segment>
      <Segment value="raw">Raw</Segment>
    </SegmentedControl>
    {#if view === 'dashboard'}
      <span class="weft-metrics-tab__status">
        {#if pollStatus === 'polling'}
          <ConnectionIndicator status={pollStatus} label="Updated every 15s" />
        {:else}
          <ConnectionIndicator status={pollStatus} />
        {/if}
      </span>
    {/if}
  </div>

  {#if view === 'dashboard'}
    <StatisticGroup columns="auto" variant="cards">
      {#each TRACKED_METRICS as metric (metric.name)}
        <Statistic label={metric.label} value={metricPointValue(latest?.[metric.name])} />
      {/each}
    </StatisticGroup>

    <div class="weft-metrics-tab__charts">
      {#each TRACKED_METRICS as metric (metric.name)}
        <LineChart
          label={metric.label}
          height={140}
          legendPosition="none"
          tooltip
          series={[
            { id: metric.name, label: metric.label, data: [...history.series(metric.name)] },
          ]}
        />
      {/each}
    </div>
  {:else if rawQuery.isError}
    <QueryFaultBanner error={rawQuery.error} onRetry={() => rawQuery.refetch()} />
  {:else}
    <div class="weft-metrics-tab__raw-header">
      <Button
        variant="secondary"
        size="sm"
        label="Download"
        onclick={downloadRaw}
        disabled={!rawQuery.data}
      >
        {#snippet leadingIcon()}<Download aria-hidden="true" size={13} />{/snippet}
      </Button>
    </div>
    <CodeBlock code={rawQuery.data ?? 'Loading…'} language="text" highlight={false} copyable />
  {/if}
</div>

<style>
  .weft-metrics-tab {
    max-width: 1000px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .weft-metrics-tab__toolbar {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .weft-metrics-tab__status {
    font-family: var(--cinder-font-mono);
    font-size: var(--cinder-text-xs);
    color: var(--cinder-text-subtle);
  }

  .weft-metrics-tab__charts {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 12px;
  }

  .weft-metrics-tab__raw-header {
    display: flex;
    justify-content: flex-end;
  }
</style>
