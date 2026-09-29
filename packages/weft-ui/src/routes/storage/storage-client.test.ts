/**
 * Pure unit tests for `storage-client.ts` request shaping and error parsing
 * against a scripted `globalThis.fetch` (same technique as
 * `../../lib/live-source/fleet-event-source.test.ts`'s `ScriptedFetch`).
 * Wire round-trips against a real server live in
 * `storage-client.integration.test.ts`.
 */
import { HttpClientError } from '@lostgradient/weft';
import { afterEach, describe, expect, test } from 'bun:test';

import { rejectionOf } from '@lostgradient/testing';
import { installFetchImplementation } from '../../lib/live-source/fetch-test-support.ts';
import {
  probeConditionalBatchSupported,
  storageDelete,
  storageGet,
  storagePut,
  type StorageConnection,
} from './storage-client.ts';

interface FetchCall {
  readonly url: string;
  readonly method: string;
  readonly headers: Record<string, string>;
  readonly body: unknown;
}

class ScriptedFetch {
  readonly calls: FetchCall[] = [];
  #response: Response | undefined;
  #restoreFetch: () => void;

  constructor() {
    this.#restoreFetch = installFetchImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const headers = Object.fromEntries(new Headers(init?.headers).entries());
      this.calls.push({ url, method: init?.method ?? 'GET', headers, body: init?.body });
      if (!this.#response) throw new Error('ScriptedFetch: no response queued');
      return this.#response;
    });
  }

  respondWith(response: Response): void {
    this.#response = response;
  }

  restore(): void {
    this.#restoreFetch();
  }
}

let scripted: ScriptedFetch | undefined;

afterEach(() => {
  scripted?.restore();
  scripted = undefined;
});

const connection: StorageConnection = {
  baseUrl: 'http://localhost:7233',
  headers: { Authorization: 'Bearer test-token' },
};

describe('storageGet', () => {
  test('requests the exact key path, URL-encoded, with the connection headers', async () => {
    scripted = new ScriptedFetch();
    scripted.respondWith(new Response(new Uint8Array([1, 2, 3]), { status: 200 }));

    await storageGet(connection, 'app:my-service/needs encoding');

    expect(scripted.calls).toHaveLength(1);
    expect(scripted.calls[0]?.url).toBe(
      `${connection.baseUrl}/v1/storage/${encodeURIComponent('app:my-service/needs encoding')}`,
    );
    expect(scripted.calls[0]?.method).toBe('GET');
    expect(scripted.calls[0]?.headers['authorization']).toBe('Bearer test-token');
  });

  test('a 404 resolves null, not a throw', async () => {
    scripted = new ScriptedFetch();
    scripted.respondWith(new Response(null, { status: 404 }));

    expect(await storageGet(connection, 'missing')).toBeNull();
  });

  test('returns the exact raw bytes on 200', async () => {
    scripted = new ScriptedFetch();
    const bytes = new Uint8Array([10, 20, 30, 40]);
    scripted.respondWith(new Response(bytes, { status: 200 }));

    const result = await storageGet(connection, 'k');
    expect(Array.from(result ?? [])).toEqual([10, 20, 30, 40]);
  });

  test('a flat shapeRestFault error body ({ error: string }) throws HttpClientError with no faultCode, message preserved', async () => {
    scripted = new ScriptedFetch();
    scripted.respondWith(
      new Response(JSON.stringify({ error: 'Raw storage access requires storage:admin.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const rejection = storageGet(connection, 'k');
    expect(await rejectionOf(rejection)).toBeInstanceOf(HttpClientError);
    expect(await rejectionOf(rejection)).toMatchObject({
      status: 403,
      message: 'Raw storage access requires storage:admin.',
      faultCode: undefined,
    });
  });

  test('a structured error body ({ error: { code, message } }) recovers faultCode when the code is a known FaultCode', async () => {
    scripted = new ScriptedFetch();
    scripted.respondWith(
      new Response(JSON.stringify({ error: { code: 'NotImplemented', message: 'nope' } }), {
        status: 501,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const rejection = storageGet(connection, 'k');
    expect(await rejectionOf(rejection)).toMatchObject({
      status: 501,
      message: 'nope',
      faultCode: 'NotImplemented',
    });
  });

  test('a structured error body with an unrecognized code still surfaces the message, faultCode undefined', async () => {
    scripted = new ScriptedFetch();
    scripted.respondWith(
      new Response(JSON.stringify({ error: { code: 'SomeFutureCode', message: 'unrecognized' } }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const rejection = storageGet(connection, 'k');
    expect(await rejectionOf(rejection)).toMatchObject({
      status: 500,
      message: 'unrecognized',
      faultCode: undefined,
    });
  });

  test('a non-JSON error body falls back to statusText', async () => {
    scripted = new ScriptedFetch();
    scripted.respondWith(
      new Response('<html>not json</html>', { status: 500, statusText: 'Server Error' }),
    );

    const rejection = storageGet(connection, 'k');
    expect(await rejectionOf(rejection)).toMatchObject({ status: 500, message: 'Server Error' });
  });
});

describe('probeConditionalBatchSupported', () => {
  test('returns false when the server reports that conditional batches are not implemented', async () => {
    scripted = new ScriptedFetch();
    scripted.respondWith(
      new Response(JSON.stringify({ error: 'Conditional batch is not supported.' }), {
        status: 501,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    expect(await probeConditionalBatchSupported(connection)).toBe(false);
    expect(scripted.calls).toHaveLength(1);
    expect(scripted.calls[0]?.url).toBe(`${connection.baseUrl}/v1/storage/-/conditional-batch`);
    expect(scripted.calls[0]?.method).toBe('POST');
  });
});

describe('storagePut', () => {
  test('sends a raw octet-stream body, no JSON envelope', async () => {
    scripted = new ScriptedFetch();
    scripted.respondWith(new Response(null, { status: 204 }));

    const value = new Uint8Array([9, 9, 9]);
    await storagePut(connection, 'k', value);

    expect(scripted.calls[0]?.method).toBe('PUT');
    expect(scripted.calls[0]?.headers['content-type']).toBe('application/octet-stream');
    const sentBody = scripted.calls[0]?.body;
    expect(sentBody).toBeInstanceOf(Blob);
    if (!(sentBody instanceof Blob)) throw new Error('expected storage PUT body to be a Blob');
    const sentBytes = new Uint8Array(await sentBody.arrayBuffer());
    expect(Array.from(sentBytes)).toEqual([9, 9, 9]);
  });

  test('throws on a non-ok response', async () => {
    scripted = new ScriptedFetch();
    scripted.respondWith(
      new Response(JSON.stringify({ error: 'Invalid key.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    expect(await rejectionOf(storagePut(connection, '', new Uint8Array()))).toMatchObject({
      status: 400,
    });
  });
});

describe('storageDelete', () => {
  test('issues a DELETE against the key path', async () => {
    scripted = new ScriptedFetch();
    scripted.respondWith(new Response(null, { status: 204 }));

    await storageDelete(connection, 'k');

    expect(scripted.calls[0]?.method).toBe('DELETE');
    expect(scripted.calls[0]?.url).toBe(`${connection.baseUrl}/v1/storage/k`);
  });
});
