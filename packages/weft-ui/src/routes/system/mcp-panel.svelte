<script lang="ts">
  /**
   * Discovery → MCP sub-view (plan §9.7 T7.3; design `Weft UI.dc.html`
   * "System" § DISCOVERY, MCP session protocol card). Renders
   * `/.well-known/mcp.json`, the static session-protocol sequence diagram,
   * and the interactive "Test MCP session" panel — including the honest
   * `publicOrigin`/`trustedHosts` 503 case (plan: "note ... 503 behavior with
   * an actionable message").
   *
   * The test-session `CodeBlock` uses `highlight={false}` — see
   * `metrics-tab.svelte`'s module doc for why `language="text"` alone still
   * triggers Shiki's "language not in bundle" warning.
   */
  import { Button, CodeBlock, DescriptionList } from '@lostgradient/cinder';
  import { Plug } from 'lucide-svelte';
  import { createQuery } from '@tanstack/svelte-query';

  import { codeHighlighter } from '../../lib/code-highlighter.ts';
  import { getClient } from '../../lib/client.ts';
  import { DiscoveryFetchError, fetchDiscoveryDocument } from './discovery-client.ts';
  import McpSessionDiagram from './mcp-session-diagram.svelte';
  import { testMcpSession, type McpTestSessionResult } from './mcp-test-session.ts';
  import QueryFaultBanner from './query-fault-banner.svelte';

  const client = getClient();

  interface McpDiscoveryDocumentLike {
    readonly protocol?: string;
    readonly protocolVersion?: string;
    readonly serverInfo?: { readonly name?: string; readonly version?: string };
    readonly transports?: {
      readonly streamableHttp?: { readonly url?: string };
      readonly stdio?: { readonly command?: string };
    };
  }

  const mcpQuery = createQuery(() => ({
    queryKey: ['system', 'discovery', 'mcp'],
    queryFn: (): Promise<McpDiscoveryDocumentLike> =>
      fetchDiscoveryDocument(client, 'mcp') as Promise<McpDiscoveryDocumentLike>,
    // See `metrics-tab.svelte`'s `retry: false` for why: `DiscoveryFetchError`
    // is a definitive result (often the documented 503), not transient.
    retry: false,
  }));

  let testResult = $state<McpTestSessionResult | null>(null);
  let testError = $state<unknown>(null);
  let testing = $state(false);

  async function runTest(): Promise<void> {
    testing = true;
    testError = null;
    try {
      testResult = await testMcpSession(client);
    } catch (error) {
      testError = error;
    } finally {
      testing = false;
    }
  }

  function isPublicOriginNotConfigured(error: unknown): boolean {
    return error instanceof DiscoveryFetchError && error.status === 503;
  }
</script>

<div class="weft-mcp-panel">
  {#if mcpQuery.isPending}
    <p class="weft-mcp-panel__loading">Loading MCP discovery document…</p>
  {:else if mcpQuery.isError && isPublicOriginNotConfigured(mcpQuery.error)}
    <div class="weft-mcp-panel__not-configured" role="status">
      <p>
        MCP discovery isn't available: this server has no <code>publicOrigin</code>/<code
          >trustedHosts</code
        > configured, so it can't safely emit absolute discovery URLs.
      </p>
      <p>
        Set <code>serve({'{'} publicOrigin: 'https://your-host.example.com' {'}'})</code> (or
        <code>trustedHosts</code>) to enable it.
      </p>
    </div>
  {:else if mcpQuery.isError}
    <QueryFaultBanner error={mcpQuery.error} onRetry={() => mcpQuery.refetch()} />
  {:else}
    <DescriptionList
      items={[
        { term: 'Protocol', definition: mcpQuery.data.protocol ?? '—' },
        { term: 'Protocol version', definition: mcpQuery.data.protocolVersion ?? '—' },
        {
          term: 'Server',
          definition: `${mcpQuery.data.serverInfo?.name ?? '—'} · ${mcpQuery.data.serverInfo?.version ?? '—'}`,
        },
        {
          term: 'Streamable HTTP',
          definition: mcpQuery.data.transports?.streamableHttp?.url ?? '—',
        },
        { term: 'stdio command', definition: mcpQuery.data.transports?.stdio?.command ?? '—' },
      ]}
    />
    <CodeBlock
      code={JSON.stringify(mcpQuery.data, null, 2)}
      language="json"
      highlighter={codeHighlighter}
      copyable
    />
  {/if}

  <div class="weft-mcp-panel__diagram-card">
    <div class="weft-mcp-panel__diagram-header">MCP session protocol</div>
    <McpSessionDiagram />
  </div>

  <div class="weft-mcp-panel__test-card">
    <div class="weft-mcp-panel__test-header">
      <span>Test MCP session</span>
      <Button
        variant="secondary"
        size="sm"
        label={testing ? 'Testing…' : 'Test'}
        onclick={runTest}
        disabled={testing}
      >
        {#snippet leadingIcon()}<Plug aria-hidden="true" size={13} />{/snippet}
      </Button>
    </div>

    {#if testError}
      <QueryFaultBanner error={testError} onRetry={runTest} />
    {:else if testResult}
      <CodeBlock
        language="text"
        highlight={false}
        copyable
        code={[
          `POST ${testResult.request.url}`,
          ...Object.entries(testResult.request.headers).map(([key, value]) => `${key}: ${value}`),
          '',
          JSON.stringify(testResult.request.body, null, 2),
          '',
          `HTTP/1.1 ${testResult.response.status} ${testResult.response.statusText}`,
          ...Object.entries(testResult.response.headers).map(([key, value]) => `${key}: ${value}`),
          '',
          typeof testResult.response.body === 'string'
            ? testResult.response.body
            : JSON.stringify(testResult.response.body, null, 2),
        ].join('\n')}
      />
    {:else}
      <p class="weft-mcp-panel__test-hint">
        Sends a real <code>initialize</code> request and shows the full request/response, including
        the <code>Mcp-Session-Id</code>/<code>Mcp-Session-Token</code> headers.
      </p>
    {/if}
  </div>
</div>

<style>
  .weft-mcp-panel {
    display: flex;
    flex-direction: column;
    gap: 16px;
    max-width: 720px;
  }

  .weft-mcp-panel__loading {
    font-size: var(--cinder-text-sm);
    color: var(--cinder-text-subtle);
  }

  .weft-mcp-panel__not-configured {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 14px 16px;
    background: var(--cinder-color-warning-bg);
    border: 1px solid var(--cinder-color-warning-border);
    border-radius: var(--cinder-radius-lg);
    font-size: var(--cinder-text-sm);
  }

  .weft-mcp-panel__not-configured p {
    margin: 0;
  }

  .weft-mcp-panel__not-configured code {
    font-family: var(--cinder-font-mono);
  }

  .weft-mcp-panel__diagram-card,
  .weft-mcp-panel__test-card {
    background: var(--cinder-surface-raised);
    border: 1px solid var(--cinder-border);
    border-radius: var(--cinder-radius-lg);
    padding: 14px 16px;
  }

  .weft-mcp-panel__diagram-header,
  .weft-mcp-panel__test-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
    font-size: var(--cinder-text-sm);
    font-weight: 600;
  }

  .weft-mcp-panel__test-hint {
    margin: 0;
    font-size: var(--cinder-text-xs);
    color: var(--cinder-text-subtle);
  }

  .weft-mcp-panel__test-hint code {
    font-family: var(--cinder-font-mono);
  }
</style>
