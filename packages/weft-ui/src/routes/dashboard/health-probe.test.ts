import { afterEach, describe, expect, test } from 'bun:test';

import { throwingRejectionOf } from '@lostgradient/testing';
import { installFetchImplementation } from '../../lib/live-source/fetch-test-support.ts';
import { probeHealth } from './health-probe.ts';

let restoreFetch = (): void => {};

afterEach(() => {
  restoreFetch();
});

describe('probeHealth', () => {
  test('resolves when /v1/health responds ok', async () => {
    let requestedUrl: string | undefined;
    let requestedHeaders: HeadersInit | undefined;
    restoreFetch = installFetchImplementation(async (input, init) => {
      requestedUrl =
        typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      requestedHeaders = init?.headers;
      return new Response(JSON.stringify({ status: 'ok' }), { status: 200 });
    });

    expect(
      await probeHealth({ baseUrl: 'http://localhost:7233', headers: { 'x-api-key': 'secret' } }),
    ).toBe(true);

    expect(requestedUrl).toBe('http://localhost:7233/v1/health');
    expect(requestedHeaders).toEqual({ 'x-api-key': 'secret' });
  });

  test('throws when /v1/health responds with a non-ok status', async () => {
    restoreFetch = installFetchImplementation(async () => new Response('', { status: 503 }));

    expect(
      await throwingRejectionOf(probeHealth({ baseUrl: 'http://localhost:7233', headers: {} })),
    ).toThrow('503');
  });

  test('propagates a network failure', async () => {
    restoreFetch = installFetchImplementation(async () => {
      throw new TypeError('Failed to fetch');
    });

    expect(
      await throwingRejectionOf(probeHealth({ baseUrl: 'http://localhost:7233', headers: {} })),
    ).toThrow('Failed to fetch');
  });
});
