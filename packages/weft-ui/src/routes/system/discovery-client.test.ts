import { afterEach, describe, expect, test } from 'bun:test';

import { throwingRejectionOf } from '@lostgradient/testing';
import {
  DiscoveryFetchError,
  discoveryOrigin,
  fetchDiscoveryDocument,
  fetchRawMetricsText,
} from './discovery-client.ts';
import { fakeClient, ScriptedFetch } from './system-test-support.test-support.ts';

let scripted: ScriptedFetch | undefined;

afterEach(() => {
  scripted?.restore();
  scripted = undefined;
});

describe('discoveryOrigin', () => {
  test('derives the origin from an absolute baseUrl, dropping any path', () => {
    expect(discoveryOrigin(fakeClient('http://weft.test:7233/api'))).toBe('http://weft.test:7233');
  });
});

describe('fetchDiscoveryDocument', () => {
  test('fetches {origin}{well-known path} for each document kind', async () => {
    scripted = new ScriptedFetch();
    scripted.enqueueJson({ ok: true });
    await fetchDiscoveryDocument(fakeClient('http://weft.test/api'), 'openapi');
    expect(scripted.calls[0]?.url).toBe('http://weft.test/openapi.json');

    scripted.enqueueJson({ ok: true });
    await fetchDiscoveryDocument(fakeClient('http://weft.test/api'), 'mcp');
    expect(scripted.calls[1]?.url).toBe('http://weft.test/.well-known/mcp.json');
  });

  test('resolves with the parsed JSON body on 200', async () => {
    scripted = new ScriptedFetch();
    scripted.enqueueJson({ openrpc: '1.3.2', methods: [] });
    const result = await fetchDiscoveryDocument(fakeClient(), 'openrpc');
    expect(result).toEqual({ openrpc: '1.3.2', methods: [] });
  });

  test('throws DiscoveryFetchError with the status on a non-2xx response (e.g. mcp.json 503 without publicOrigin)', async () => {
    scripted = new ScriptedFetch();
    scripted.enqueueStatus(503, 'Service Unavailable');

    expect(await throwingRejectionOf(fetchDiscoveryDocument(fakeClient(), 'mcp'))).toThrow(
      DiscoveryFetchError,
    );

    scripted.enqueueStatus(503, 'Service Unavailable');
    try {
      await fetchDiscoveryDocument(fakeClient(), 'mcp');
      throw new Error('expected a throw');
    } catch (error) {
      if (!(error instanceof DiscoveryFetchError)) throw error;
      expect(error.status).toBe(503);
      expect(error.kind).toBe('mcp');
    }
  });

  test('sends the client headers along with the request', async () => {
    scripted = new ScriptedFetch();
    scripted.enqueueJson({});
    await fetchDiscoveryDocument(
      { baseUrl: 'http://weft.test/api', headers: { 'X-API-Key': 'k' } },
      'asyncapi',
    );
    expect(scripted.calls[0]?.init?.headers).toEqual({ 'X-API-Key': 'k' });
  });
});

describe('fetchRawMetricsText', () => {
  test('fetches {origin}/v1/metrics and resolves with plain text', async () => {
    scripted = new ScriptedFetch();
    scripted.enqueueText('weft_workflow_active 3\n');
    const result = await fetchRawMetricsText(fakeClient('http://weft.test/api'));
    expect(scripted.calls[0]?.url).toBe('http://weft.test/v1/metrics');
    expect(result).toBe('weft_workflow_active 3\n');
  });

  test('throws DiscoveryFetchError on a non-2xx response', async () => {
    scripted = new ScriptedFetch();
    scripted.enqueueStatus(500, 'Internal Server Error');
    expect(await throwingRejectionOf(fetchRawMetricsText(fakeClient()))).toThrow(
      DiscoveryFetchError,
    );
  });
});
