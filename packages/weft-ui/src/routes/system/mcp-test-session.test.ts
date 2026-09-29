import { afterEach, describe, expect, test } from 'bun:test';

import { testMcpSession } from './mcp-test-session.ts';
import { fakeClient, ScriptedFetch } from './system-test-support.test-support.ts';

let scripted: ScriptedFetch | undefined;

afterEach(() => {
  scripted?.restore();
  scripted = undefined;
});

describe('testMcpSession', () => {
  test('POSTs an initialize request to {origin}/mcp with no prior session header', async () => {
    scripted = new ScriptedFetch();
    scripted.enqueueJson(
      { jsonrpc: '2.0', id: 1, result: { protocolVersion: '2025-03-26' } },
      { headers: { 'Mcp-Session-Id': 'sess_abc', 'Mcp-Session-Token': 'tok_xyz' } },
    );

    const result = await testMcpSession(fakeClient('http://weft.test/api'));

    expect(result.request.url).toBe('http://weft.test/mcp');
    expect(result.request.headers['Mcp-Session-Id']).toBeUndefined();
    const requestBody = result.request.body;
    const requestMethod =
      requestBody !== null && typeof requestBody === 'object'
        ? Reflect.get(requestBody, 'method')
        : undefined;
    expect(requestMethod).toBe('initialize');
    expect(result.response.status).toBe(200);
    expect(result.response.headers['mcp-session-id']).toBe('sess_abc');
    expect(result.response.headers['mcp-session-token']).toBe('tok_xyz');
  });

  test('a 403 response is a normal, non-throwing result', async () => {
    scripted = new ScriptedFetch();
    scripted.enqueueText('Forbidden', { status: 403, statusText: 'Forbidden' });

    const result = await testMcpSession(fakeClient());
    expect(result.response.status).toBe(403);
    expect(result.response.body).toBe('Forbidden');
  });
});
