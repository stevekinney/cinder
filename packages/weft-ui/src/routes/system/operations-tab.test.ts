/**
 * Component tests for `<OperationsTab>` (plan §9.7 T7.4). Covers the
 * searchable catalog table, search filtering, and the scope-domain matrix
 * toggle.
 */
import { fireEvent, render } from '@testing-library/svelte';
import { afterEach, describe, expect, test } from 'bun:test';

import { createQueryClient } from '../../lib/query.ts';
import OperationsTab from './operations-tab.svelte';
import SystemRouteTestHarness from './system-route-test-harness.test-harness.svelte';
import { realClient, ScriptedFetch } from './system-test-support.test-support.ts';

let scripted: ScriptedFetch | undefined;

afterEach(() => {
  scripted?.restore();
  scripted = undefined;
});

function routeDocuments(fetch: ScriptedFetch): void {
  fetch.routeUrl('/openapi.json', {
    paths: {
      '/api/v1/workflows': {
        get: { operationId: 'weft.workflows.list', summary: 'List workflows', tags: ['Workflows'] },
      },
      '/api/v1/storage/get': {
        post: { operationId: 'weft.storage.get', summary: 'Get a stored value', tags: ['Storage'] },
      },
    },
  });
  fetch.routeUrl('/openrpc.json', {
    methods: [
      { name: 'weft.workflows.list', summary: 'List workflows', tags: [{ name: 'Workflows' }] },
      { name: 'weft.storage.get', summary: 'Get a stored value', tags: [{ name: 'Storage' }] },
    ],
  });
}

async function renderOperationsTab() {
  return render(SystemRouteTestHarness, {
    props: { client: realClient(), queryClient: createQueryClient(), component: OperationsTab },
  });
}

describe('OperationsTab', () => {
  test('renders the catalog table with every combined operation', async () => {
    scripted = new ScriptedFetch();
    routeDocuments(scripted);
    const { findByText } = await renderOperationsTab();
    expect(await findByText('weft.workflows.list')).not.toBeNull();
    expect(await findByText('weft.storage.get')).not.toBeNull();
  });

  test('names the "scope" column\'s absence honestly rather than omitting it silently', async () => {
    scripted = new ScriptedFetch();
    routeDocuments(scripted);
    const { findByText } = await renderOperationsTab();
    expect(
      await findByText("Required scope isn't advertised by the discovery documents yet", {
        exact: false,
      }),
    ).not.toBeNull();
  });

  test('searching filters the table', async () => {
    scripted = new ScriptedFetch();
    routeDocuments(scripted);
    const { findByPlaceholderText, findByText, queryByText } = await renderOperationsTab();

    const search = await findByPlaceholderText('Search operations…');
    await fireEvent.input(search, { target: { value: 'storage' } });

    expect(await findByText('weft.storage.get')).not.toBeNull();
    expect(queryByText('weft.workflows.list')).toBeNull();
  });

  test('switching to the scope matrix shows the domain-affinity note and matrix', async () => {
    scripted = new ScriptedFetch();
    routeDocuments(scripted);
    const { findByRole, findByText } = await renderOperationsTab();

    await fireEvent.click(await findByRole('radio', { name: 'Scope matrix' }));

    expect(
      await findByText('Domain affinity derived from scope and tag naming', { exact: false }),
    ).not.toBeNull();
    expect(await findByText('workflows:read')).not.toBeNull();
  });

  test('an OpenAPI document fetch failure shows the fault banner', async () => {
    scripted = new ScriptedFetch();
    routeDocuments(scripted);
    scripted.routeUrlStatus('/openapi.json', 500, 'Internal Server Error');

    const { findByText } = await renderOperationsTab();
    expect(await findByText('Something went wrong')).not.toBeNull();
  });

  test('an OpenRPC document fetch failure shows the fault banner', async () => {
    scripted = new ScriptedFetch();
    routeDocuments(scripted);
    scripted.routeUrlStatus('/openrpc.json', 500, 'Internal Server Error');

    const { findByText } = await renderOperationsTab();
    expect(await findByText('Something went wrong')).not.toBeNull();
  });

  test('a search with no matches shows the empty-results message', async () => {
    scripted = new ScriptedFetch();
    routeDocuments(scripted);
    const { findByPlaceholderText, findByText } = await renderOperationsTab();

    const search = await findByPlaceholderText('Search operations…');
    await fireEvent.input(search, { target: { value: 'nothing-matches-this' } });

    expect(await findByText('No operations match "nothing-matches-this".')).not.toBeNull();
  });

  test('renders REST/JSON-RPC/MCP availability accurately for partially-covered operations', async () => {
    scripted = new ScriptedFetch();
    // REST-only: no JSON-RPC entry at all (Minus for both JSON-RPC and MCP).
    scripted.routeUrl('/openapi.json', {
      paths: {
        '/api/v1/workflows': {
          get: { operationId: 'weft.workflows.list', summary: 'List workflows' },
        },
      },
    });
    // JSON-RPC-only with MCP exposure, no REST route (the "—" fallback).
    scripted.routeUrl('/openrpc.json', {
      methods: [
        {
          name: 'weft.workflows.stream',
          summary: 'Stream workflow updates',
          'x-weft-mcp': { toolName: 'stream_workflows' },
        },
      ],
    });

    const { container, findByText } = await renderOperationsTab();

    expect(await findByText('weft.workflows.list')).not.toBeNull();
    expect(await findByText('weft.workflows.stream')).not.toBeNull();
    // No REST route for the JSON-RPC-only operation.
    expect(await findByText('—')).not.toBeNull();
    // lucide-svelte renders each icon's name as a `lucide-<name>` class (see
    // `Icon.svelte`): the REST-only row's JSON-RPC/MCP cells are both Minus,
    // and the JSON-RPC-only row's JSON-RPC/MCP cells are both Check.
    expect(container.querySelectorAll('.lucide-check').length).toBe(2);
    expect(container.querySelectorAll('.lucide-minus').length).toBe(2);
  });
});
