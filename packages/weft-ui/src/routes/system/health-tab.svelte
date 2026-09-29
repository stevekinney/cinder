<script lang="ts">
  /**
   * Health & lease tab (plan §9.7 T7.5; design `Weft UI.dc.html`
   * "System" § HEALTH & LEASE). Lease status, retention overview,
   * recover-all (Tier-2 confirm), a codegen preview, and the CLI-only
   * conformance panel.
   *
   * ## Recover-all is `ConfirmDialog`, not `AlertDialog` (plan §13/§10.6
   * tier sweep)
   *
   * Fixed here as part of the T8.1/T8.2 tier sweep: this previously used
   * `AlertDialog`, which is reserved for SYSTEM-initiated, must-acknowledge
   * interruptions with no safe Escape/backdrop exit (its own README: "For
   * user-initiated actions (even high-impact ones), use `ConfirmDialog`
   * instead"). Recover-all is a user-initiated action the operator opened
   * from a button click — plan §7.1/§10.6 maps Tier 2 to `ConfirmDialog`
   * specifically, and `../workers/clear-dead-letter-dialog.svelte`'s
   * doc comment draws the identical distinction for its own Tier-3 flow.
   * Escape/backdrop-dismiss is a safe "never mind" here, exactly like any
   * other Tier-2 confirm in the console (`../workflows/detail/header.svelte`'s
   * cancel/force-timeout, `../storage/delete-panel.svelte`'s delete).
   *
   * ## Lease status has no live signal to bind to — flagged, not faked
   *
   * Verified against `weft` v0.11.0 (`src/core/engine/lease-manager.ts` and
   * every file under `src/core/engine/`, plus every `src/server/operations/*`
   * file): lease ownership/health (healthy / no-lease / contested) is
   * entirely internal to `Engine` — no REST route, JSON-RPC operation, or
   * metric exposes it. The plan's "lease status first (healthy / no-lease
   * amber / contested red banner...)" and its Dashboard mirror (owned by
   * Track C2) both assume a wire signal that doesn't exist yet. Filed
   * upstream: https://github.com/stevekinney/weft/issues/738 (expose lease
   * health via a public operation). Until it lands, this section says so
   * plainly instead of rendering a fabricated "healthy" badge — a false
   * "healthy" reading on an operator console is actively harmful during a
   * real split-brain incident. `LEASE_STATUS_QUERY_KEY` is exported so a
   * future implementation (here or on the Dashboard mirror) has one shared
   * key to invalidate together the day a real endpoint exists.
   */
  import {
    Button,
    ConfirmDialog,
    CodeBlock,
    CopyButton,
    DescriptionList,
  } from '@lostgradient/cinder';
  import { CircleAlert, Terminal } from 'lucide-svelte';
  import { createMutation, createQuery } from '@tanstack/svelte-query';
  import type { RetentionOverview } from '@lostgradient/weft';

  import { codeHighlighter } from '../../lib/code-highlighter.ts';
  import { getClient } from '../../lib/client.ts';
  import { queryKeys } from '../../lib/query.ts';
  import { showToast } from '../../app/toast-host.svelte';
  import { codegenPreviewSource, type RegistryLike } from './codegen-preview-source.ts';
  import QueryFaultBanner from './query-fault-banner.svelte';

  const client = getClient();

  /** Exported per this module's lease-status doc above — no current consumer, a seam for when a real endpoint lands. */
  export const LEASE_STATUS_QUERY_KEY = ['system', 'lease'] as const;
  void LEASE_STATUS_QUERY_KEY;

  const retentionQuery = createQuery(() => ({
    queryKey: ['system', 'retention'],
    queryFn: (): Promise<RetentionOverview> => client.getRetentionOverview(),
  }));

  const registryQuery = createQuery(() => ({
    queryKey: queryKeys.registry(),
    queryFn: (): Promise<RegistryLike> =>
      client.operations['weft.system.registry']({}) as Promise<RegistryLike>,
  }));

  const recoverAll = createMutation(() => ({
    mutationFn: () => client.operations['weft.recover.all']({}),
    onSuccess: (result) => {
      showToast(`Recovery triggered — ${result.recovered.length} workflow(s) recovered.`, {
        variant: 'success',
      });
    },
  }));

  let confirmOpen = $state(false);
</script>

<div class="weft-health-tab">
  <div class="weft-health-tab__lease-note" role="status">
    <CircleAlert aria-hidden="true" size={16} />
    <div>
      <div class="weft-health-tab__lease-note-title">Lease status not available</div>
      <div class="weft-health-tab__lease-note-body">
        This server doesn't expose lease ownership/health over the API yet — see
        <a href="https://github.com/stevekinney/weft/issues/738" target="_blank" rel="noreferrer"
          >stevekinney/weft#738</a
        >. This banner will show healthy / no-lease / contested here once it does.
      </div>
    </div>
  </div>

  <div class="weft-health-tab__grid">
    <section class="weft-health-tab__panel">
      <div class="weft-health-tab__panel-header">
        <span>Retention</span>
      </div>
      {#if retentionQuery.isPending}
        <p class="weft-health-tab__loading">Loading…</p>
      {:else if retentionQuery.isError}
        <QueryFaultBanner error={retentionQuery.error} onRetry={() => retentionQuery.refetch()} />
      {:else}
        <DescriptionList
          items={[
            {
              term: 'Default retention',
              definition: retentionQuery.data.defaultRetention
                ? JSON.stringify(retentionQuery.data.defaultRetention)
                : 'none',
            },
            { term: 'Sweep interval', definition: `${retentionQuery.data.sweepIntervalMs}ms` },
            { term: 'Sweep batch size', definition: String(retentionQuery.data.sweepBatchSize) },
            {
              term: 'Workflow types tracked',
              definition: String(retentionQuery.data.workflowTypes.length),
            },
          ]}
        />
      {/if}
    </section>

    <section class="weft-health-tab__panel">
      <div class="weft-health-tab__panel-header">
        <span>Recover all</span>
        <Button
          variant="secondary"
          size="sm"
          label="Recover all"
          onclick={() => (confirmOpen = true)}
          disabled={recoverAll.isPending}
        />
      </div>
      <p class="weft-health-tab__hint">
        Resumes every workflow this engine believes should be running but isn't currently tracked in
        memory — for use after an unclean restart.
      </p>
    </section>

    <section class="weft-health-tab__panel">
      <div class="weft-health-tab__panel-header">
        <span>Codegen preview</span>
      </div>
      {#if registryQuery.isPending}
        <p class="weft-health-tab__loading">Loading…</p>
      {:else if registryQuery.isError}
        <QueryFaultBanner error={registryQuery.error} onRetry={() => registryQuery.refetch()} />
      {:else}
        {@const preview = codegenPreviewSource(registryQuery.data)}
        {#if preview}
          <CodeBlock code={preview} language="typescript" highlighter={codeHighlighter} copyable />
          <p class="weft-health-tab__hint">
            Approximate preview of one workflow's input type — run <code>weft codegen</code> for the
            exact, complete <code>.d.ts</code>.
          </p>
        {:else}
          <p class="weft-health-tab__hint">No workflow with an input schema is registered yet.</p>
        {/if}
      {/if}
    </section>

    <section class="weft-health-tab__panel">
      <div class="weft-health-tab__panel-header">
        <span>Conformance</span>
      </div>
      <p class="weft-health-tab__hint">
        Verify this engine against the Weft conformance suite. Conformance runs from the CLI only —
        there is no server-side trigger.
      </p>
      <div class="weft-health-tab__command">
        <Terminal aria-hidden="true" size={13} />
        <code>weft conformance -- &lt;worker-command&gt;</code>
        <CopyButton value="weft conformance -- <worker-command>" iconOnly label="Copy command" />
      </div>
      <a
        class="weft-health-tab__doc-link"
        href="https://github.com/stevekinney/weft/blob/main/documentation/contributing/conformance.md"
        target="_blank"
        rel="noreferrer"
      >
        Conformance guide →
      </a>
    </section>
  </div>
</div>

<ConfirmDialog
  open={confirmOpen}
  title="Recover all workflows?"
  description="This resumes every workflow this engine believes should be running. Safe to run repeatedly, but may generate a burst of activity if many workflows were stalled."
  confirmLabel="Recover all"
  onConfirm={() => {
    confirmOpen = false;
    recoverAll.mutate();
  }}
  onCancel={() => (confirmOpen = false)}
/>

<style>
  .weft-health-tab {
    max-width: 900px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .weft-health-tab__lease-note {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 14px 16px;
    background: var(--cinder-color-warning-bg);
    border: 1px solid var(--cinder-color-warning-border);
    border-radius: var(--cinder-radius-lg);
    color: var(--cinder-color-warning-fg);
  }

  .weft-health-tab__lease-note-title {
    font-size: var(--cinder-text-sm);
    font-weight: 600;
  }

  .weft-health-tab__lease-note-body {
    font-size: var(--cinder-text-xs);
    color: var(--cinder-text-muted);
    margin-top: 2px;
  }

  .weft-health-tab__grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 14px;
    align-items: start;
  }

  .weft-health-tab__panel {
    background: var(--cinder-surface-raised);
    border: 1px solid var(--cinder-border);
    border-radius: var(--cinder-radius-lg);
    padding: 14px 16px;
  }

  .weft-health-tab__panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
    font-size: var(--cinder-text-sm);
    font-weight: 600;
  }

  .weft-health-tab__loading,
  .weft-health-tab__hint {
    margin: 0;
    font-size: var(--cinder-text-xs);
    color: var(--cinder-text-subtle);
  }

  .weft-health-tab__command {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 9px 12px;
    margin: 10px 0;
    background: var(--cinder-surface-inset);
    border: 1px solid var(--cinder-border);
    border-radius: var(--cinder-radius-md);
    font-family: var(--cinder-font-mono);
    font-size: var(--cinder-text-xs);
  }

  .weft-health-tab__command code {
    flex: 1;
    min-width: 0;
    overflow-x: auto;
  }

  .weft-health-tab__doc-link {
    font-size: var(--cinder-text-2xs);
    font-weight: 600;
  }
</style>
