<script lang="ts">
  /**
   * Fleet overview (plan §9.4 T5.1): stat cards + deployment groups, each
   * with drain/resume (plan §9.4 T5.2: "per worker and per deployment").
   */
  import { Badge, Button, EmptyState, StatusDot, Tooltip } from '@lostgradient/cinder';

  import type { ScopeGate } from '../../lib/scopes.svelte.ts';
  import type { WorkerDeploymentSummary, WorkerSummary } from './worker-catalog-types.ts';
  import ManifestDiagnosticsView from './manifest-diagnostics-view.svelte';
  import type {
    WorkerManifestDiagnostics,
    WorkerRegistrationRejection,
  } from './worker-manifest-diagnostics.ts';
  import {
    deploymentHealthPresentation,
    formatDeploymentIdentity,
    formatDeploymentName,
    presentationStatusDotStatus,
    summarizeFleet,
  } from './worker-presentation.ts';

  interface FleetViewProps {
    readonly workers: readonly WorkerSummary[];
    readonly deployments: readonly WorkerDeploymentSummary[];
    readonly adminGate: ScopeGate;
    readonly onDrainDeployment: (name: string) => void;
    readonly onResumeDeployment: (name: string) => void;
    readonly manifestDiagnostics?: readonly WorkerManifestDiagnostics[];
    readonly registrationRejections?: readonly WorkerRegistrationRejection[];
    readonly manifestRefreshing?: boolean;
    readonly manifestLoading?: boolean;
    readonly manifestError?: unknown;
  }

  let {
    workers,
    deployments,
    adminGate,
    onDrainDeployment,
    onResumeDeployment,
    manifestDiagnostics = [],
    registrationRejections = [],
    manifestRefreshing = false,
    manifestLoading = false,
    manifestError = null,
  }: FleetViewProps = $props();

  const totals = $derived(summarizeFleet(workers));
</script>

<div class="weft-fleet-view">
  <div class="weft-fleet-view__stats">
    <div class="weft-workers-stat-card">
      <span class="weft-workers-stat-card__label">Total workers</span>
      <span class="weft-workers-stat-card__value">{totals.totalWorkers}</span>
    </div>
    <div class="weft-workers-stat-card">
      <span class="weft-workers-stat-card__label">Active / draining</span>
      <span class="weft-workers-stat-card__value"
        >{totals.activeWorkers}<span class="weft-workers-stat-card__value-secondary">
          / {totals.drainingWorkers}</span
        ></span
      >
    </div>
    <div class="weft-workers-stat-card">
      <span class="weft-workers-stat-card__label">In-flight</span>
      <span class="weft-workers-stat-card__value">{totals.inFlight}</span>
    </div>
    <div class="weft-workers-stat-card">
      <span class="weft-workers-stat-card__label">Capacity</span>
      <span class="weft-workers-stat-card__value">{totals.capacity}</span>
    </div>
    <div class="weft-workers-stat-card">
      <span class="weft-workers-stat-card__label">Utilization</span>
      <span
        class="weft-workers-stat-card__value"
        class:weft-workers-stat-card__value--warning={totals.utilizationPercent >= 75}
        >{totals.utilizationPercent}%</span
      >
    </div>
  </div>

  <div class="weft-fleet-view__section-header">
    <span>Deployment groups</span>
  </div>

  {#if deployments.length === 0 && workers.length === 0}
    <EmptyState
      title="No workers connected"
      description="Connect a RemoteWorker to this queue to see it here — see the SDK docs for `RemoteWorker`."
    />
  {:else if deployments.length === 0}
    <EmptyState
      title="No deployment metadata"
      description="Connected workers haven't reported a deploymentName/buildId — they still appear in the Workers tab."
    />
  {:else}
    <ul class="weft-deployment-list">
      {#each deployments as deployment (formatDeploymentName(deployment) + deployment.health)}
        {@const presentation = deploymentHealthPresentation(deployment)}
        <li class="weft-deployment-row">
          <StatusDot
            status={presentationStatusDotStatus(presentation.variant)}
            labelVisible={false}
            label={presentation.label}
          />
          <div class="weft-deployment-row__identity">
            <span class="weft-deployment-row__name">{formatDeploymentName(deployment)}</span>
            <span class="weft-deployment-row__meta">{formatDeploymentIdentity(deployment)}</span>
          </div>
          <Badge variant={presentation.variant} size="sm">{presentation.label}</Badge>
          <span class="weft-deployment-row__count">{deployment.workers} workers</span>
          <div class="weft-deployment-row__actions">
            {#if adminGate.disabled}
              <Tooltip text={adminGate.title ?? ''}>
                <Button variant="ghost" size="sm" disabled label="Drain" />
              </Tooltip>
              <Tooltip text={adminGate.title ?? ''}>
                <Button variant="ghost" size="sm" disabled label="Resume" />
              </Tooltip>
            {:else}
              <Button
                variant="ghost"
                size="sm"
                label="Drain"
                onclick={() => onDrainDeployment(formatDeploymentName(deployment))}
              />
              <Button
                variant="ghost"
                size="sm"
                label="Resume"
                onclick={() => onResumeDeployment(formatDeploymentName(deployment))}
              />
            {/if}
          </div>
        </li>
      {/each}
    </ul>
  {/if}

  <ManifestDiagnosticsView
    diagnostics={manifestDiagnostics}
    rejections={registrationRejections}
    refreshing={manifestRefreshing}
    loading={manifestLoading}
    error={manifestError}
  />
</div>
