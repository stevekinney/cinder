<script lang="ts">
  /**
   * Operations tab (plan §9.7 T7.4; design `Weft UI.dc.html` "System" §
   * OPERATION CATALOG). Searchable table sourced from the OpenAPI/OpenRPC
   * discovery documents + a `PermissionMatrix` scope/domain toggle — see
   * `scope-domain-matrix.ts`'s module doc for exactly what that matrix does
   * and doesn't claim (never per-operation required scope, which no
   * discovery document advertises).
   */
  import {
    Badge,
    PermissionMatrix,
    Segment,
    SegmentedControl,
    SearchField,
    Table,
  } from '@lostgradient/cinder';
  import { Check, Minus } from 'lucide-svelte';
  import { createQuery } from '@tanstack/svelte-query';

  import { getClient } from '../../lib/client.ts';
  import { fetchDiscoveryDocument } from './discovery-client.ts';
  import {
    buildOperationCatalog,
    filterOperationCatalog,
    type OpenApiDocumentLike,
    type OpenRpcDocumentLike,
  } from './operation-catalog.ts';
  import QueryFaultBanner from './query-fault-banner.svelte';
  import {
    domainColumnsFromTags,
    scopeDomainCellState,
    SCOPE_MATRIX_ROWS,
  } from './scope-domain-matrix.ts';

  const client = getClient();

  const openapiQuery = createQuery(() => ({
    queryKey: ['system', 'discovery', 'openapi'],
    queryFn: (): Promise<OpenApiDocumentLike> =>
      fetchDiscoveryDocument(client, 'openapi') as Promise<OpenApiDocumentLike>,
    retry: false,
  }));
  const openrpcQuery = createQuery(() => ({
    queryKey: ['system', 'discovery', 'openrpc'],
    queryFn: (): Promise<OpenRpcDocumentLike> =>
      fetchDiscoveryDocument(client, 'openrpc') as Promise<OpenRpcDocumentLike>,
    retry: false,
  }));

  let searchQuery = $state('');
  let view = $state<'table' | 'matrix'>('table');
</script>

<div class="weft-operations-tab">
  {#if openapiQuery.isPending || openrpcQuery.isPending}
    <p class="weft-operations-tab__loading">Loading operation catalog…</p>
  {:else if openapiQuery.isError}
    <QueryFaultBanner error={openapiQuery.error} onRetry={() => openapiQuery.refetch()} />
  {:else if openrpcQuery.isError}
    <QueryFaultBanner error={openrpcQuery.error} onRetry={() => openrpcQuery.refetch()} />
  {:else}
    {@const catalog = buildOperationCatalog(openapiQuery.data, openrpcQuery.data)}
    <div class="weft-operations-tab__toolbar">
      <SearchField
        id="operation-search"
        class="weft-operations-tab__search"
        placeholder="Search operations…"
        value={searchQuery}
        onValueChange={(next) => (searchQuery = next)}
      />
      <SegmentedControl
        id="operations-view"
        label="Catalog view"
        labelVisible={false}
        value={view}
        onValueChange={(next) => (view = next)}
      >
        <Segment value="table">Table</Segment>
        <Segment value="matrix">Scope matrix</Segment>
      </SegmentedControl>
    </div>

    {#if view === 'table'}
      {@const rows = filterOperationCatalog(catalog, searchQuery)}
      <p class="weft-operations-tab__scope-note">
        Required scope isn't advertised by the discovery documents yet (<a
          href="https://github.com/stevekinney/weft/issues/737"
          target="_blank"
          rel="noreferrer">stevekinney/weft#737</a
        >) — see the Scopes tab for what each granted scope unlocks.
      </p>
      <Table caption="Operation catalog" scrollable>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Operation</Table.HeaderCell>
            <Table.HeaderCell>REST</Table.HeaderCell>
            <Table.HeaderCell>JSON-RPC</Table.HeaderCell>
            <Table.HeaderCell>MCP</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each rows as row (row.name)}
            <Table.Row>
              <Table.Cell as="th"><code>{row.name}</code></Table.Cell>
              <Table.Cell>
                {#if row.restMethod && row.restPath}
                  <Badge variant="neutral">{row.restMethod}</Badge>
                  <code>{row.restPath}</code>
                {:else}
                  —
                {/if}
              </Table.Cell>
              <Table.Cell>
                {#if row.jsonRpc}<Check aria-hidden="true" size={14} />{:else}<Minus
                    aria-hidden="true"
                    size={14}
                  />{/if}
              </Table.Cell>
              <Table.Cell>
                {#if row.mcp}<Check aria-hidden="true" size={14} />{:else}<Minus
                    aria-hidden="true"
                    size={14}
                  />{/if}
              </Table.Cell>
            </Table.Row>
          {/each}
        </Table.Body>
      </Table>
      {#if rows.length === 0}
        <p class="weft-operations-tab__empty">No operations match "{searchQuery}".</p>
      {/if}
    {:else}
      {@const columns = domainColumnsFromTags(catalog.flatMap((row) => row.tags))}
      <p class="weft-operations-tab__matrix-note">
        Domain affinity derived from scope and tag naming — NOT per-operation required scope
        (discovery documents don't advertise that yet). "Same domain" means the scope's vocabulary
        covers this area of the API, not that any specific operation requires it.
      </p>
      <PermissionMatrix
        label="Scope domain matrix"
        rows={SCOPE_MATRIX_ROWS}
        {columns}
        getCellState={scopeDomainCellState}
        stateLabels={{ granted: 'Same domain', 'not-applicable': '—' }}
      />
    {/if}
  {/if}
</div>

<style>
  .weft-operations-tab {
    max-width: 1080px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .weft-operations-tab__loading {
    font-size: var(--cinder-text-sm);
    color: var(--cinder-text-subtle);
  }

  .weft-operations-tab__toolbar {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .weft-operations-tab__toolbar :global(.weft-operations-tab__search) {
    flex: 1;
    max-width: 300px;
  }

  .weft-operations-tab__empty {
    font-size: var(--cinder-text-sm);
    color: var(--cinder-text-subtle);
  }

  .weft-operations-tab__scope-note {
    margin: 0;
    font-size: var(--cinder-text-2xs);
    color: var(--cinder-text-disabled);
  }

  .weft-operations-tab__matrix-note {
    margin: 0;
    font-size: var(--cinder-text-xs);
    color: var(--cinder-text-subtle);
    max-width: 640px;
  }
</style>
