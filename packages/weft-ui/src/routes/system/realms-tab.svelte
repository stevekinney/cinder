<script lang="ts">
  /**
   * Realms tab (COR-243): per-`(name, revision)` workflow-revision realm
   * pool diagnostics — lifecycle state, activation generation, restart
   * count, and in-flight turn count. Data comes from
   * `weft.realms.diagnostics`, reachable only via `client.operations[...]`
   * (no ergonomic `HttpClient` method exists for it), matching
   * `registry-tab.svelte`'s identical observation about `weft.system.registry`.
   *
   * An engine that never opted into `workflowExecutionMode: 'realm'`
   * returns `pools: []` — rendered as the plain "not in realm mode" empty
   * state below, not an error, matching the operation's own doc.
   */
  import { Badge, EmptyState, Table } from '@lostgradient/cinder';
  import { createQuery } from '@tanstack/svelte-query';
  import { Layers } from 'lucide-svelte';

  import { getClient } from '../../lib/client.ts';
  import { queryKeys } from '../../lib/query.ts';
  import QueryFaultBanner from './query-fault-banner.svelte';
  import {
    realmDiagnosticsRows,
    realmStateBadgeVariant,
    totalRealmCount,
    type RealmDiagnosticsSource,
  } from './realms-view.ts';

  const client = getClient();

  const query = createQuery(() => ({
    queryKey: queryKeys.realms(),
    queryFn: (): Promise<RealmDiagnosticsSource> =>
      client.operations['weft.realms.diagnostics']({}) as Promise<RealmDiagnosticsSource>,
    refetchInterval: 30_000,
  }));
</script>

<div class="weft-realms-tab">
  {#if query.isPending}
    <div role="status" aria-busy="true" aria-label="Loading realm diagnostics">
      Loading realm diagnostics…
    </div>
  {:else if query.isError}
    <QueryFaultBanner error={query.error} onRetry={() => query.refetch()} />
  {:else if query.data.pools.length === 0}
    <EmptyState
      title="No revision realms"
      description="This engine has not opted into workflowExecutionMode: 'realm' — no workflow-revision realm pools exist to diagnose. See the Workflow revision isolation guide."
    >
      {#snippet icon()}
        <Layers aria-hidden="true" size={26} />
      {/snippet}
    </EmptyState>
  {:else}
    {@const rows = realmDiagnosticsRows(query.data)}
    <div class="weft-realms-tab__summary" aria-label="Realm summary">
      <span><strong>{query.data.pools.length}</strong> revision pool(s)</span>
      <span><strong>{totalRealmCount(query.data)}</strong> realm(s) tracked</span>
    </div>

    <Table caption="Workflow-revision realm pools" scrollable>
      <Table.Header>
        <Table.Row>
          <Table.HeaderCell>Workflow</Table.HeaderCell>
          <Table.HeaderCell>Revision</Table.HeaderCell>
          <Table.HeaderCell>Active pointer</Table.HeaderCell>
          <Table.HeaderCell>Realm state</Table.HeaderCell>
          <Table.HeaderCell>Generation</Table.HeaderCell>
          <Table.HeaderCell>Restarts</Table.HeaderCell>
          <Table.HeaderCell>In-flight turns</Table.HeaderCell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each rows as row (row.key)}
          <Table.Row>
            <Table.Cell as="th" class="weft-realms-tab__mono">{row.name}</Table.Cell>
            <Table.Cell class="weft-realms-tab__mono">{row.revision}</Table.Cell>
            <Table.Cell>
              {#if row.revisionActive}
                <Badge variant="success">Active</Badge>
              {:else}
                <Badge variant="neutral">Inactive</Badge>
              {/if}
            </Table.Cell>
            {#if row.state === null}
              <Table.Cell colspan={4}>
                <span class="weft-realms-tab__note">No realm currently warmed</span>
              </Table.Cell>
            {:else}
              <Table.Cell>
                <Badge variant={realmStateBadgeVariant(row.state)}>{row.state}</Badge>
              </Table.Cell>
              <Table.Cell class="weft-realms-tab__mono">{row.realmGeneration ?? '—'}</Table.Cell>
              <Table.Cell>{row.restartCount}</Table.Cell>
              <Table.Cell>{row.pendingTurnCount}</Table.Cell>
            {/if}
          </Table.Row>
        {/each}
      </Table.Body>
    </Table>
  {/if}
</div>

<style>
  .weft-realms-tab {
    max-width: 1000px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .weft-realms-tab__summary {
    display: flex;
    gap: 16px;
    font-size: var(--cinder-text-sm);
    color: var(--cinder-text-muted);
  }

  :global(.weft-realms-tab__mono) {
    font-family: var(--cinder-font-mono);
    font-size: var(--cinder-text-xs);
  }

  .weft-realms-tab__note {
    font-size: var(--cinder-text-xs);
    color: var(--cinder-text-subtle);
  }
</style>
