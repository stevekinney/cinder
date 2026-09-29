<script lang="ts">
  /**
   * Alerts & operational warnings tab (plan §9.7 T7.6; design `Weft New
   * Surfaces.dc.html` §D). Two sections as of `@lostgradient/weft@0.16.0`:
   *
   * 1. **Active alerts** — authoritative and reload-safe, from the
   *    `weft.alerts.list` operation (weft#843, `GET /v1/alerts`,
   *    `system:read`): the alert rules currently firing, regardless of when
   *    this page loaded. Refetched whenever the shared fleet stream delivers
   *    an alert-kind frame, so it tracks firing/resolution without polling.
   * 2. **Recent activity** — the session-scoped event log from
   *    `alert:fired`/`alert:resolved`/`constraint:violated` + the four
   *    operational-warning kinds — see `alerts-store.svelte.ts`'s module doc
   *    for the row model. This section is still honestly labeled as
   *    session-scoped: weft has a list operation for *currently firing*
   *    alerts but no durable alert *history* operation, and the
   *    resolved/warning rows only exist as live events.
   *
   * ## Why this keeps its own `AlertsStore` instead of `NotificationStore`
   *
   * Subscribes to the shell's ONE shared `FleetEventSource`
   * (`getFleetEventSource()`, `src/app/engine-status.svelte.ts`) rather than
   * opening a second connection — per plan §5's "one fleet SSE … never
   * per-row/per-surface connections" budget. `NotificationStore` — the
   * other consumer fed by that shared source — isn't a substitute for this
   * tab's own `AlertsStore`: it's a single 50-item rolling window shared
   * across ALL 31 notification kinds (`NOTIFICATION_HISTORY_LIMIT`), so a
   * burst of ordinary workflow lifecycle activity could silently evict real
   * alerts from this view. `AlertsStore` filters the same shared frame
   * stream down to just the alert/constraint/operational-warning kinds it
   * cares about, with no shared eviction budget.
   */
  import { EmptyState, Badge, type BadgeVariant, Skeleton } from '@lostgradient/cinder';
  import { createQuery, useQueryClient } from '@tanstack/svelte-query';
  import { BellOff, Info } from 'lucide-svelte';

  import { getFleetEventSource } from '../../app/engine-status.svelte.ts';
  import { getClient } from '../../lib/client.ts';
  import type { FleetEventFrame } from '../../lib/live-source/fleet-event-source.svelte.ts';
  import { formatBytes, formatDuration } from '../../lib/format/index.ts';
  import { router, workflowDetailPath } from '../../lib/router.svelte.ts';
  import {
    AlertsStore,
    isAlertEventKind,
    type AlertRow,
    type AlertRowState,
  } from './alerts-store.svelte.ts';
  import QueryFaultBanner from './query-fault-banner.svelte';

  /**
   * Local shape for `weft.alerts.list`'s output (`ListAlertsOutput` /
   * `ActiveAlert` in weft's server types — not exported from the client
   * subpath, same local-`*Like` convention as `metrics-tab.svelte`'s
   * `MetricsSnapshotLike`).
   */
  interface ActiveAlertLike {
    readonly metric: string;
    readonly threshold: number;
    readonly currentValue: number;
    readonly window: string | null;
    readonly firedAt: number | null;
  }

  interface ListAlertsOutputLike {
    readonly items: readonly ActiveAlertLike[];
  }

  const client = getClient();
  const queryClient = useQueryClient();
  const source = getFleetEventSource();
  const store = new AlertsStore();

  const ACTIVE_ALERTS_KEY = ['system', 'alerts', 'active'] as const;

  const activeAlertsQuery = createQuery(() => ({
    queryKey: ACTIVE_ALERTS_KEY,
    queryFn: () => client.operations['weft.alerts.list']({}) as Promise<ListAlertsOutputLike>,
  }));

  $effect(() => {
    return source.subscribe((frame: FleetEventFrame) => {
      if (!isAlertEventKind(frame.kind)) return;
      store.ingest(frame);
      // An alert-kind frame means the authoritative firing set may have
      // changed — refetch rather than patching the cache from the frame
      // (the operation is the source of truth; frames carry no
      // threshold/currentValue data to patch with).
      void queryClient.invalidateQueries({ queryKey: ACTIVE_ALERTS_KEY });
    });
  });

  const sessionStartedAtMs = Date.now();

  /**
   * Human labels + value formatting for weft's three `AlertMetric` kinds.
   * Unknown metrics (a future weft adding a kind) fall back to the raw
   * metric id and unformatted numbers — degraded but correct.
   */
  const METRIC_PRESENTATION: Readonly<
    Record<string, { label: string; format: (value: number) => string }>
  > = {
    'workflow.failure_rate': {
      label: 'Workflow failure rate',
      format: (value) => `${(value * 100).toFixed(1)}%`,
    },
    'activity.p99_duration': {
      label: 'Activity p99 duration',
      format: (value) => formatDuration(value),
    },
    'storage.size': {
      label: 'Storage size',
      format: (value) => formatBytes(value),
    },
  };

  function metricLabel(alert: ActiveAlertLike): string {
    return METRIC_PRESENTATION[alert.metric]?.label ?? alert.metric;
  }

  function metricValue(alert: ActiveAlertLike, value: number): string {
    const format = METRIC_PRESENTATION[alert.metric]?.format;
    return format ? format(value) : String(value);
  }

  function activeAlertDetail(alert: ActiveAlertLike): string {
    const parts = [
      `${metricValue(alert, alert.currentValue)} · threshold ${metricValue(alert, alert.threshold)}`,
    ];
    if (alert.window !== null) parts.push(`window ${alert.window}`);
    return parts.join(' · ');
  }

  const STATE_BADGE: Readonly<Record<AlertRowState, { variant: BadgeVariant; label: string }>> = {
    firing: { variant: 'danger', label: 'Firing' },
    resolved: { variant: 'neutral', label: 'Resolved' },
    warning: { variant: 'warning', label: 'Warning' },
  };

  const EDGE_COLOR: Readonly<Record<AlertRowState, string>> = {
    firing: 'var(--cinder-danger)',
    resolved: 'var(--cinder-border)',
    warning: 'var(--cinder-warning)',
  };

  function detailsHref(row: AlertRow): string {
    return row.workflowId ? workflowDetailPath(row.workflowId) : '/system';
  }

  function formatTime(atMs: number): string {
    return new Date(atMs).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }
</script>

<div class="weft-alerts-tab">
  <div class="weft-alerts-tab__header">
    <h2 class="weft-alerts-tab__title">Active alerts</h2>
  </div>

  {#if activeAlertsQuery.isPending}
    <div class="weft-alerts-tab__loading" aria-label="Loading active alerts">
      <Skeleton height="52px" />
    </div>
  {:else if activeAlertsQuery.isError}
    <QueryFaultBanner error={activeAlertsQuery.error} onRetry={() => activeAlertsQuery.refetch()} />
  {:else if activeAlertsQuery.data.items.length === 0}
    <EmptyState
      title="No active alerts"
      description="No alert rule is currently firing. Alerts fire when a configured metric crosses its threshold."
    >
      {#snippet icon()}
        <BellOff aria-hidden="true" size={20} />
      {/snippet}
      {#snippet action()}
        <a
          href={router.href('/workers?tab=diagnostics')}
          onclick={(event) => {
            event.preventDefault();
            router.navigate('/workers?tab=diagnostics');
          }}
        >
          Open Diagnostics
        </a>
      {/snippet}
    </EmptyState>
  {:else}
    <ul class="weft-alerts-tab__list">
      {#each activeAlertsQuery.data.items as alert (alert.metric)}
        <li class="weft-alerts-tab__row" style={`border-left-color:${EDGE_COLOR.firing}`}>
          <div class="weft-alerts-tab__row-body">
            <div class="weft-alerts-tab__row-title">{metricLabel(alert)}</div>
            <div class="weft-alerts-tab__row-detail">{activeAlertDetail(alert)}</div>
          </div>
          <Badge variant="danger">Firing</Badge>
          {#if alert.firedAt !== null}
            <span class="weft-alerts-tab__row-time">{formatTime(alert.firedAt)}</span>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}

  <div class="weft-alerts-tab__header weft-alerts-tab__header--activity">
    <h2 class="weft-alerts-tab__title">Recent activity</h2>
  </div>
  <p class="weft-alerts-tab__note">
    <Info aria-hidden="true" size={13} />
    Collected since page load ({formatTime(sessionStartedAtMs)}) — resolved alerts and operational
    warnings only exist as live events; the active list above is authoritative.
  </p>

  {#if store.isEmpty}
    <EmptyState
      title="No alert activity since page load"
      description="New alerts and warnings will appear here as they fire."
    >
      {#snippet icon()}
        <BellOff aria-hidden="true" size={20} />
      {/snippet}
    </EmptyState>
  {:else}
    <ul class="weft-alerts-tab__list">
      {#each store.rows as row (row.id)}
        {@const badge = STATE_BADGE[row.state]}
        <li
          class="weft-alerts-tab__row"
          style={`border-left-color:${EDGE_COLOR[row.state]}`}
          data-dim={row.state === 'resolved'}
        >
          <div class="weft-alerts-tab__row-body">
            <div class="weft-alerts-tab__row-title">{row.title}</div>
            <div class="weft-alerts-tab__row-detail">{row.body}</div>
          </div>
          <Badge variant={badge.variant}>{badge.label}</Badge>
          <span class="weft-alerts-tab__row-time">{formatTime(row.emittedAtMs)}</span>
          <a
            class="weft-alerts-tab__row-link"
            href={router.href(detailsHref(row))}
            onclick={(event) => {
              event.preventDefault();
              router.navigate(detailsHref(row));
            }}
          >
            Details
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .weft-alerts-tab {
    max-width: 900px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .weft-alerts-tab__header {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .weft-alerts-tab__header--activity {
    margin-top: 18px;
  }

  .weft-alerts-tab__loading {
    display: flex;
    flex-direction: column;
  }

  .weft-alerts-tab__title {
    margin: 0;
    font-size: var(--cinder-text-lg);
    font-weight: 600;
  }

  .weft-alerts-tab__note {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 0 0 12px;
    font-size: var(--cinder-text-xs);
    color: var(--cinder-text-subtle);
  }

  .weft-alerts-tab__list {
    list-style: none;
    margin: 0;
    padding: 0;
    background: var(--cinder-surface-raised);
    border: 1px solid var(--cinder-border);
    border-radius: var(--cinder-radius-lg);
    overflow: hidden;
  }

  .weft-alerts-tab__row {
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 11px 14px;
    border-bottom: 1px solid var(--cinder-border-muted);
    border-inline-start: 2px solid transparent;
  }

  .weft-alerts-tab__row:last-child {
    border-bottom: 0;
  }

  .weft-alerts-tab__row-body {
    flex: 1;
    min-width: 0;
  }

  .weft-alerts-tab__row-title {
    font-size: var(--cinder-text-xs);
    font-weight: 600;
  }

  /**
   * T9.4 accessibility pass: this used to be a blanket `opacity: 0.6` on the
   * whole `.weft-alerts-tab__row` (design §D: "resolved rows dim to 0.6").
   * Measured in a real browser with `ctx.globalAlpha` (canvas 2D composites
   * exactly like CSS `opacity`, in gamma-encoded sRGB — a naive
   * `color-mix(in oklch, …)` stand-in reads noticeably higher and is NOT
   * trustworthy near a 4.5:1 threshold), both themes: the row's title
   * inherits `--cinder-text`, which holds AA at 0.6 opacity (4.71:1 light /
   * 5.30:1 dark) — but `.weft-alerts-tab__row-detail` (`--cinder-text-subtle`)
   * and `.weft-alerts-tab__row-time` (`--cinder-text-disabled`) were
   * ALREADY marginal at full opacity and dropped to ~3:1 once dimmed, under
   * WCAG AA's 4.5:1 for normal text. Scoping the opacity to the title only
   * keeps the resolved/firing distinction — already carried by the
   * Firing/Resolved `Badge`, a non-color/non-opacity signal — without
   * taking the detail/time text below AA. Same fix, same measurement, as
   * `../../app/shell/notification-bell.svelte`'s read-item title.
   */
  .weft-alerts-tab__row[data-dim='true'] .weft-alerts-tab__row-title {
    opacity: 0.6;
  }

  .weft-alerts-tab__row-detail {
    font-size: var(--cinder-text-2xs);
    color: var(--cinder-text-subtle);
    margin-top: 1px;
  }

  .weft-alerts-tab__row-time {
    flex: none;
    font-size: var(--cinder-text-2xs);
    color: var(--cinder-text-disabled);
    font-family: var(--cinder-font-mono);
  }

  .weft-alerts-tab__row-link {
    flex: none;
    font-size: var(--cinder-text-2xs);
    font-weight: 600;
  }
</style>
