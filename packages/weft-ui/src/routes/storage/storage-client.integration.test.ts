/**
 * Integration tests for `storage-client.ts` against a REAL in-process weft
 * server (`../../lib/live-source/live-source-test-server.test-support.ts` —
 * see that module's doc comment for why `serve()` isn't used and why this is
 * genuinely engine-backed, not a mock). Proves the wire contract this
 * module's doc comment claims: raw-byte GET/PUT, NDJSON scan with base64
 * values, JSON batch/conditional-batch with base64 values, 404-is-null on a
 * missing GET, and `probeConditionalBatchSupported()` returning true for
 * `MemoryStorage` (which reports `conditionalBatch: true`). The unsupported
 * backend response is covered at the HTTP-client boundary because Weft 0.20
 * refuses to start a remote-task server without conditional batches.
 */
import { describe, expect, test } from 'bun:test';

import { startLiveSourceTestServer } from '../../lib/live-source/live-source-test-server.test-support.ts';
import {
  probeConditionalBatchSupported,
  storageBatch,
  storageConditionalBatch,
  storageDelete,
  storageGet,
  storagePut,
  storageScan,
  type StorageConnection,
} from './storage-client.ts';

/** Storage REST operations declare `access: 'scoped'` (`storage:{read,write,admin}`) — an anonymous request 401s. */
function connectionFor(server: { baseUrl: string; token: string }): StorageConnection {
  return { baseUrl: server.baseUrl, headers: { Authorization: `Bearer ${server.token}` } };
}

describe('storage-client (integration, real server)', () => {
  test('get returns null for a missing key', async () => {
    const server = await startLiveSourceTestServer();
    try {
      const value = await storageGet(connectionFor(server), 'app:does-not-exist');
      expect(value).toBeNull();
    } finally {
      await server.stop();
    }
  });

  test('put then get round-trips raw bytes exactly', async () => {
    const server = await startLiveSourceTestServer();
    try {
      const written = new TextEncoder().encode('{"owner":"ops"}');
      await storagePut(connectionFor(server), 'app:my-service:config', written);

      const read = await storageGet(connectionFor(server), 'app:my-service:config');
      expect(read).not.toBeNull();
      expect(Array.from(read ?? [])).toEqual(Array.from(written));
    } finally {
      await server.stop();
    }
  });

  test('put then delete then get returns null', async () => {
    const server = await startLiveSourceTestServer();
    try {
      const connection = connectionFor(server);
      await storagePut(connection, 'app:temp-key', new TextEncoder().encode('x'));
      expect(await storageGet(connection, 'app:temp-key')).not.toBeNull();

      await storageDelete(connection, 'app:temp-key');
      expect(await storageGet(connection, 'app:temp-key')).toBeNull();
    } finally {
      await server.stop();
    }
  });

  test('scan returns entries under a prefix with decoded values, and pagination cursor advances via gt', async () => {
    const server = await startLiveSourceTestServer();
    try {
      const connection = connectionFor(server);
      await storagePut(connection, 'app:scan:a', new TextEncoder().encode('1'));
      await storagePut(connection, 'app:scan:b', new TextEncoder().encode('2'));
      await storagePut(connection, 'app:scan:c', new TextEncoder().encode('3'));

      const firstPage = await storageScan(connection, { prefix: 'app:scan:', limit: 2 });
      expect(firstPage.entries.map((entry) => entry.key)).toEqual(['app:scan:a', 'app:scan:b']);
      expect(new TextDecoder().decode(firstPage.entries[0]?.value)).toBe('1');
      expect(firstPage.nextCursor).toBe('app:scan:b');
      if (firstPage.nextCursor === undefined) throw new Error('expected a cursor');

      const secondPage = await storageScan(connection, {
        prefix: 'app:scan:',
        limit: 2,
        gt: firstPage.nextCursor,
      });
      expect(secondPage.entries.map((entry) => entry.key)).toEqual(['app:scan:c']);
      expect(secondPage.nextCursor).toBeUndefined();
    } finally {
      await server.stop();
    }
  });

  test('batch applies put and delete operations atomically', async () => {
    const server = await startLiveSourceTestServer();
    try {
      const connection = connectionFor(server);
      await storagePut(connection, 'app:batch:remove-me', new TextEncoder().encode('gone'));

      await storageBatch(connection, [
        { type: 'put', key: 'app:batch:added', value: new TextEncoder().encode('new') },
        { type: 'delete', key: 'app:batch:remove-me' },
      ]);

      expect(await storageGet(connection, 'app:batch:remove-me')).toBeNull();
      const added = await storageGet(connection, 'app:batch:added');
      expect(new TextDecoder().decode(added ?? new Uint8Array())).toBe('new');
    } finally {
      await server.stop();
    }
  });

  test('conditionalBatch applies when the expected value matches and rejects (applied: false) when it does not', async () => {
    const server = await startLiveSourceTestServer();
    try {
      const connection = connectionFor(server);
      await storagePut(connection, 'app:cas:key', new TextEncoder().encode('before'));

      const staleResult = await storageConditionalBatch(
        connection,
        [{ key: 'app:cas:key', expectedValue: new TextEncoder().encode('wrong-expectation') }],
        [{ type: 'put', key: 'app:cas:key', value: new TextEncoder().encode('after') }],
      );
      expect(staleResult.applied).toBe(false);
      expect(
        new TextDecoder().decode((await storageGet(connection, 'app:cas:key')) ?? new Uint8Array()),
      ).toBe('before');

      const freshResult = await storageConditionalBatch(
        connection,
        [{ key: 'app:cas:key', expectedValue: new TextEncoder().encode('before') }],
        [{ type: 'put', key: 'app:cas:key', value: new TextEncoder().encode('after') }],
      );
      expect(freshResult.applied).toBe(true);
      expect(
        new TextDecoder().decode((await storageGet(connection, 'app:cas:key')) ?? new Uint8Array()),
      ).toBe('after');
    } finally {
      await server.stop();
    }
  });

  test('probeConditionalBatchSupported returns true against MemoryStorage without writing anything', async () => {
    const server = await startLiveSourceTestServer();
    try {
      const connection = connectionFor(server);
      const before = await storageScan(connection, { prefix: '', limit: 10_000 });

      const supported = await probeConditionalBatchSupported(connection);
      expect(supported).toBe(true);

      const after = await storageScan(connection, { prefix: '', limit: 10_000 });
      expect(after.entries.map((entry) => entry.key)).toEqual(
        before.entries.map((entry) => entry.key),
      );
    } finally {
      await server.stop();
    }
  });
});
