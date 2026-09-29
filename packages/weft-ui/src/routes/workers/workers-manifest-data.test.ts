import { describe, expect, test } from 'bun:test';

import { HttpClient } from '@lostgradient/weft';

import {
  invalidateWorkerSurfaceQueries,
  loadFleetManifestDiagnostics,
  loadWorkerManifestDiagnostics,
  loadWorkerRegistrationRejections,
} from './workers-data.ts';

function diagnostic(workerId: string): unknown {
  return {
    worker: {
      instance: {
        workerId,
        queue: 'default',
        health: 'active',
        connectedAt: 1,
        startedAt: 1,
        lastHeartbeatAt: 1,
        heartbeatAgeMs: 1,
      },
      deploymentVersion: {
        deploymentName: 'payments',
        buildId: 'build-1',
        artifactDigest: 'sha256:artifact',
        runtimeName: 'bun',
        runtimeVersion: '1.4.0',
        sdkVersion: '0.20.0',
        manifestVersion: 1,
        protocolVersion: 3,
        manifestDigest: 'sha256:manifest',
        workflows: {},
      },
    },
  };
}

function clientWithOperations(
  diagnostics: (input: { workerId: string }) => Promise<unknown>,
  rejections: (input: { limit: number }) => Promise<unknown>,
): Pick<HttpClient, 'operations'> {
  const client = new HttpClient({ baseUrl: 'http://localhost' });
  Object.defineProperty(client, 'operations', {
    value: {
      'weft.workers.diagnostics': diagnostics,
      'weft.workers.rejections': rejections,
    },
  });
  return client;
}

describe('worker manifest data', () => {
  test('invalidates fleet, queue, diagnostics, manifest, and rejection evidence together', () => {
    const invalidatedKeys: unknown[] = [];
    const invalidateQueries: Pick<
      import('@tanstack/svelte-query').QueryClient,
      'invalidateQueries'
    >['invalidateQueries'] = (filters) => {
      const queryKey = filters?.queryKey;
      if (queryKey) invalidatedKeys.push(queryKey);
      else invalidatedKeys.push([]);
      return Promise.resolve();
    };
    invalidateWorkerSurfaceQueries({
      invalidateQueries,
    });

    expect(invalidatedKeys).toEqual([
      ['workers', 'list'],
      ['queues', 'list'],
      ['diagnostics'],
      ['workers', 'manifests'],
      ['workers', 'rejections'],
    ]);
  });

  test('loads and validates one worker diagnostic', async () => {
    const client = clientWithOperations(
      async ({ workerId }) => diagnostic(workerId),
      async () => ({ items: [], limit: 25 }),
    );
    const result = await loadWorkerManifestDiagnostics(client, 'worker-a');
    expect(result?.instance.workerId).toBe('worker-a');
  });

  test('loads fleet diagnostics in stable worker-id order and drops disconnected workers', async () => {
    const client = clientWithOperations(
      async ({ workerId }) => (workerId === 'worker-b' ? { worker: null } : diagnostic(workerId)),
      async () => ({ items: [], limit: 25 }),
    );
    const result = await loadFleetManifestDiagnostics(client, ['worker-c', 'worker-b', 'worker-a']);
    expect(result.map((entry) => entry.instance.workerId)).toEqual(['worker-a', 'worker-c']);
  });

  test('requests the bounded rejection limit and preserves the Weft reason code', async () => {
    let requestedLimit = 0;
    const client = clientWithOperations(
      async ({ workerId }) => diagnostic(workerId),
      async ({ limit }) => {
        requestedLimit = limit;
        return {
          items: [{ code: 'deployment_conflict', rejectedAt: 4 }],
          limit,
        };
      },
    );
    const result = await loadWorkerRegistrationRejections(client, 10);
    expect(requestedLimit).toBe(10);
    expect(result[0]?.code).toBe('deployment_conflict');
  });
});
