import { describe, expect, test } from 'bun:test';

import { buildOperationCatalog, filterOperationCatalog } from './operation-catalog.ts';

const OPENAPI = {
  paths: {
    '/api/v1/workflows': {
      post: {
        operationId: 'weft.workflows.start',
        summary: 'Start a new workflow',
        tags: ['Workflows'],
      },
      get: { operationId: 'weft.workflows.list', summary: 'List workflows', tags: ['Workflows'] },
    },
    '/api/v1/storage/get': {
      post: { operationId: 'weft.storage.get', summary: 'Get a stored value', tags: ['Storage'] },
    },
    '/v1/health': {
      get: { operationId: 'healthCheck', summary: 'Liveness probe' },
    },
  },
};

const OPENRPC = {
  methods: [
    { name: 'rpc.discover', summary: 'OpenRPC self-description' },
    {
      name: 'weft.workflows.start',
      summary: 'Start a new workflow',
      tags: [{ name: 'Workflows' }],
    },
    {
      name: 'weft.workflows.list',
      summary: 'List workflows',
      tags: [{ name: 'Workflows' }],
      'x-weft-mcp': { toolName: 'list_workflows' },
    },
    {
      name: 'weft.events.subscribe',
      summary: 'Subscribe to fleet events',
      tags: [{ name: 'Events' }],
    },
  ],
};

describe('buildOperationCatalog', () => {
  test('unions REST and JSON-RPC operations, sorted by name', () => {
    const rows = buildOperationCatalog(OPENAPI, OPENRPC);
    expect(rows.map((row) => row.name)).toEqual([
      'weft.events.subscribe',
      'weft.storage.get',
      'weft.workflows.list',
      'weft.workflows.start',
    ]);
  });

  test('excludes the synthetic rpc.discover meta-method and direct-route ids', () => {
    const rows = buildOperationCatalog(OPENAPI, OPENRPC);
    expect(rows.some((row) => row.name === 'rpc.discover')).toBe(false);
    expect(rows.some((row) => row.name === 'healthCheck')).toBe(false);
  });

  test('marks transport flags from presence in each document', () => {
    const rows = buildOperationCatalog(OPENAPI, OPENRPC);
    const storageGet = rows.find((row) => row.name === 'weft.storage.get');
    expect(storageGet).toMatchObject({
      restMethod: 'POST',
      restPath: '/api/v1/storage/get',
      jsonRpc: false,
    });

    const eventsSubscribe = rows.find((row) => row.name === 'weft.events.subscribe');
    expect(eventsSubscribe).toMatchObject({
      restMethod: undefined,
      restPath: undefined,
      jsonRpc: true,
    });

    const listWorkflows = rows.find((row) => row.name === 'weft.workflows.list');
    expect(listWorkflows).toMatchObject({ mcp: true, mcpToolName: 'list_workflows' });

    const start = rows.find((row) => row.name === 'weft.workflows.start');
    expect(start).toMatchObject({ mcp: false, mcpToolName: undefined });
  });

  test('scope is always undefined — never fabricated (see module doc)', () => {
    const rows = buildOperationCatalog(OPENAPI, OPENRPC);
    expect(rows.every((row) => row.scope === undefined)).toBe(true);
  });

  test('degrades gracefully when one document is missing', () => {
    expect(buildOperationCatalog(null, OPENRPC).every((row) => row.restPath === undefined)).toBe(
      true,
    );
    expect(buildOperationCatalog(OPENAPI, null).every((row) => !row.jsonRpc)).toBe(true);
    expect(buildOperationCatalog(null, null)).toEqual([]);
  });
});

describe('filterOperationCatalog', () => {
  const rows = buildOperationCatalog(OPENAPI, OPENRPC);

  test('empty query returns every row', () => {
    expect(filterOperationCatalog(rows, '')).toEqual(rows);
    expect(filterOperationCatalog(rows, '   ')).toEqual(rows);
  });

  test('matches by name, summary, or tag, case-insensitively', () => {
    expect(filterOperationCatalog(rows, 'STORAGE').map((row) => row.name)).toEqual([
      'weft.storage.get',
    ]);
    expect(filterOperationCatalog(rows, 'liveness probe')).toEqual([]);
    expect(filterOperationCatalog(rows, 'fleet events').map((row) => row.name)).toEqual([
      'weft.events.subscribe',
    ]);
  });
});
