<script lang="ts">
  /**
   * Discovery tab (plan §9.7 T7.3; design `Weft UI.dc.html` "System" §
   * DISCOVERY). Rendered OpenAPI / OpenRPC / AsyncAPI viewers (method/path,
   * summary, tags — see `operation-catalog.ts`'s module doc for why
   * "required scope" is honestly absent) + raw-JSON toggle, plus the MCP
   * sub-view (`mcp-panel.svelte`).
   */
  import { Badge, CodeBlock, Segment, SegmentedControl, Table } from '@lostgradient/cinder';
  import { createQuery } from '@tanstack/svelte-query';

  import { codeHighlighter } from '../../lib/code-highlighter.ts';
  import { getClient } from '../../lib/client.ts';
  import { extractAsyncApiChannels, type AsyncApiDocumentLike } from './asyncapi-channels.ts';
  import { fetchDiscoveryDocument } from './discovery-client.ts';
  import McpPanel from './mcp-panel.svelte';
  import {
    buildOperationCatalog,
    filterOperationCatalog,
    type OpenApiDocumentLike,
    type OpenRpcDocumentLike,
  } from './operation-catalog.ts';
  import QueryFaultBanner from './query-fault-banner.svelte';

  const client = getClient();

  type DiscoveryView = 'openapi' | 'openrpc' | 'asyncapi' | 'mcp';
  let view = $state<DiscoveryView>('openapi');
  let showRaw = $state(false);

  // `retry: false` on every query below — see `metrics-tab.svelte`'s
  // `rawQuery` for why `DiscoveryFetchError` shouldn't get the QueryClient's
  // generic "retry non-Weft-fault errors" default.
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
  const asyncapiQuery = createQuery(() => ({
    queryKey: ['system', 'discovery', 'asyncapi'],
    queryFn: (): Promise<AsyncApiDocumentLike> =>
      fetchDiscoveryDocument(client, 'asyncapi') as Promise<AsyncApiDocumentLike>,
    retry: false,
  }));
</script>

<div class="weft-discovery-tab">
  <div class="weft-discovery-tab__toolbar">
    <SegmentedControl
      id="discovery-view"
      label="Discovery document"
      labelVisible={false}
      value={view}
      onValueChange={(next) => (view = next)}
    >
      <Segment value="openapi">OpenAPI</Segment>
      <Segment value="openrpc">OpenRPC</Segment>
      <Segment value="asyncapi">AsyncAPI</Segment>
      <Segment value="mcp">MCP</Segment>
    </SegmentedControl>

    {#if view !== 'mcp'}
      <label class="weft-discovery-tab__raw-toggle">
        <input type="checkbox" bind:checked={showRaw} />
        Raw JSON
      </label>
    {/if}
  </div>

  {#if view === 'openapi'}
    {#if openapiQuery.isPending}
      <p class="weft-discovery-tab__loading">Loading OpenAPI document…</p>
    {:else if openapiQuery.isError}
      <QueryFaultBanner error={openapiQuery.error} onRetry={() => openapiQuery.refetch()} />
    {:else if showRaw}
      <CodeBlock
        code={JSON.stringify(openapiQuery.data, null, 2)}
        language="json"
        highlighter={codeHighlighter}
        copyable
      />
    {:else}
      {@const rows = filterOperationCatalog(buildOperationCatalog(openapiQuery.data, null), '')}
      <Table caption="OpenAPI operations" scrollable>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Method</Table.HeaderCell>
            <Table.HeaderCell>Path</Table.HeaderCell>
            <Table.HeaderCell>Summary</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each rows as row (row.name)}
            <Table.Row>
              <Table.Cell as="th">
                <Badge variant="neutral">{row.restMethod}</Badge>
              </Table.Cell>
              <Table.Cell><code>{row.restPath}</code></Table.Cell>
              <Table.Cell>{row.summary ?? '—'}</Table.Cell>
            </Table.Row>
          {/each}
        </Table.Body>
      </Table>
    {/if}
  {:else if view === 'openrpc'}
    {#if openrpcQuery.isPending}
      <p class="weft-discovery-tab__loading">Loading OpenRPC document…</p>
    {:else if openrpcQuery.isError}
      <QueryFaultBanner error={openrpcQuery.error} onRetry={() => openrpcQuery.refetch()} />
    {:else if showRaw}
      <CodeBlock
        code={JSON.stringify(openrpcQuery.data, null, 2)}
        language="json"
        highlighter={codeHighlighter}
        copyable
      />
    {:else}
      {@const rows = filterOperationCatalog(buildOperationCatalog(null, openrpcQuery.data), '')}
      <Table caption="OpenRPC methods" scrollable>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Method</Table.HeaderCell>
            <Table.HeaderCell>Summary</Table.HeaderCell>
            <Table.HeaderCell>MCP</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each rows as row (row.name)}
            <Table.Row>
              <Table.Cell as="th"><code>{row.name}</code></Table.Cell>
              <Table.Cell>{row.summary ?? '—'}</Table.Cell>
              <Table.Cell>{row.mcp ? row.mcpToolName : '—'}</Table.Cell>
            </Table.Row>
          {/each}
        </Table.Body>
      </Table>
    {/if}
  {:else if view === 'asyncapi'}
    {#if asyncapiQuery.isPending}
      <p class="weft-discovery-tab__loading">Loading AsyncAPI document…</p>
    {:else if asyncapiQuery.isError}
      <QueryFaultBanner error={asyncapiQuery.error} onRetry={() => asyncapiQuery.refetch()} />
    {:else if showRaw}
      <CodeBlock
        code={JSON.stringify(asyncapiQuery.data, null, 2)}
        language="json"
        highlighter={codeHighlighter}
        copyable
      />
    {:else}
      {@const rows = extractAsyncApiChannels(asyncapiQuery.data)}
      <Table caption="AsyncAPI channels" scrollable>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Channel</Table.HeaderCell>
            <Table.HeaderCell>Address</Table.HeaderCell>
            <Table.HeaderCell>Title</Table.HeaderCell>
            <Table.HeaderCell align="right">Messages</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each rows as row (row.channel)}
            <Table.Row>
              <Table.Cell as="th"><code>{row.channel}</code></Table.Cell>
              <Table.Cell><code>{row.address ?? '—'}</code></Table.Cell>
              <Table.Cell>{row.title ?? '—'}</Table.Cell>
              <Table.Cell align="right">{row.messageCount}</Table.Cell>
            </Table.Row>
          {/each}
        </Table.Body>
      </Table>
    {/if}
  {:else}
    <McpPanel />
  {/if}

  <p class="weft-discovery-tab__scope-note">
    Required scope isn't advertised by these documents yet — see the Scopes tab for what each scope
    unlocks.
  </p>
</div>

<style>
  .weft-discovery-tab {
    max-width: 1000px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .weft-discovery-tab__toolbar {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .weft-discovery-tab__raw-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: var(--cinder-text-xs);
    color: var(--cinder-text-muted);
  }

  .weft-discovery-tab__loading {
    font-size: var(--cinder-text-sm);
    color: var(--cinder-text-subtle);
  }

  .weft-discovery-tab__scope-note {
    margin: 0;
    font-size: var(--cinder-text-2xs);
    color: var(--cinder-text-disabled);
  }
</style>
