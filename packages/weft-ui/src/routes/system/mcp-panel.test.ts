/**
 * Component tests for `<McpPanel>` (plan §9.7 T7.3). Covers the rendered
 * discovery document, the honest `publicOrigin`/`trustedHosts` 503 case, and
 * the interactive "Test MCP session" panel.
 */
import { fireEvent, render } from '@testing-library/svelte';
import { afterEach, describe, expect, test } from 'bun:test';

import { createQueryClient } from '../../lib/query.ts';
import McpPanel from './mcp-panel.svelte';
import SystemRouteTestHarness from './system-route-test-harness.test-harness.svelte';
import { realClient, ScriptedFetch } from './system-test-support.test-support.ts';

let scripted: ScriptedFetch | undefined;

afterEach(() => {
  scripted?.restore();
  scripted = undefined;
});

async function renderMcpPanel() {
  return render(SystemRouteTestHarness, {
    props: { client: realClient(), queryClient: createQueryClient(), component: McpPanel },
  });
}

describe('McpPanel', () => {
  test('renders the discovery document summary', async () => {
    scripted = new ScriptedFetch();
    scripted.routeUrl('/.well-known/mcp.json', {
      protocol: 'model-context-protocol',
      protocolVersion: '2025-03-26',
      serverInfo: { name: 'weft', version: '0.11.0' },
      transports: { streamableHttp: { url: '/api/mcp' }, stdio: { command: 'weft-mcp' } },
    });

    const { findByText } = await renderMcpPanel();
    expect(await findByText('model-context-protocol')).not.toBeNull();
    expect(await findByText('weft · 0.11.0')).not.toBeNull();
  });

  test('shows an actionable message on the documented 503 (no publicOrigin/trustedHosts)', async () => {
    scripted = new ScriptedFetch();
    scripted.routeUrlStatus('/.well-known/mcp.json', 503, 'Service Unavailable');

    const { findAllByText } = await renderMcpPanel();
    const matches = await findAllByText('publicOrigin', { exact: false });
    expect(matches.length).toBeGreaterThan(0);
  });

  test('a generic fetch failure still shows the standard fault banner', async () => {
    scripted = new ScriptedFetch();
    scripted.routeUrlStatus('/.well-known/mcp.json', 500, 'Internal Server Error');

    const { findByText } = await renderMcpPanel();
    expect(await findByText('Something went wrong')).not.toBeNull();
  });

  test('Test MCP session sends an initialize request and renders the request/response', async () => {
    scripted = new ScriptedFetch();
    scripted.routeUrl('/.well-known/mcp.json', {
      protocol: 'model-context-protocol',
      protocolVersion: '2025-03-26',
    });
    scripted.routeExactUrl(
      'http://weft.test/mcp',
      { jsonrpc: '2.0', id: 1, result: { protocolVersion: '2025-03-26' } },
      { headers: { 'Mcp-Session-Id': 'sess_abc12345', 'Mcp-Session-Token': 'tok_secret' } },
    );

    const { findByRole, findByText } = await renderMcpPanel();

    await fireEvent.click(await findByRole('button', { name: 'Test' }));

    expect(await findByText('mcp-session-id: sess_abc12345', { exact: false })).not.toBeNull();
    expect(await findByText('mcp-session-token: tok_secret', { exact: false })).not.toBeNull();
  });

  test('a transport failure during Test MCP session shows the fault banner', async () => {
    scripted = new ScriptedFetch();
    scripted.routeUrl('/.well-known/mcp.json', {
      protocol: 'model-context-protocol',
      protocolVersion: '2025-03-26',
    });
    // Deliberately no route/queued response for `POST /mcp` —
    // `testMcpSession` only rejects on a genuine transport failure
    // (`mcp-test-session.ts`'s module doc), and `ScriptedFetch` throws on an
    // unrouted call, which stands in for exactly that.

    const { findByRole, findByText } = await renderMcpPanel();

    await fireEvent.click(await findByRole('button', { name: 'Test' }));

    expect(await findByText('Something went wrong')).not.toBeNull();
  });
});
