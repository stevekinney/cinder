import { describe, expect, test } from 'bun:test';

import {
  compareDeploymentManifests,
  MalformedWorkerDiagnosticsError,
  parseWorkerDiagnosticsResponse,
  parseWorkerRegistrationRejections,
  type WorkerManifestDiagnostics,
} from './worker-manifest-diagnostics.ts';

function response(overrides: Record<string, unknown> = {}): unknown {
  return {
    worker: {
      instance: {
        workerId: 'worker-a',
        queue: 'default',
        health: 'active',
        connectedAt: 1,
        startedAt: 2,
        lastHeartbeatAt: 3,
        heartbeatAgeMs: 4,
      },
      deploymentVersion: {
        deploymentName: 'payments',
        buildId: 'build-7',
        artifactDigest: 'sha256:artifact-a',
        runtimeName: 'bun',
        runtimeVersion: '1.4.0',
        sdkVersion: '0.20.0',
        manifestVersion: 1,
        protocolVersion: 3,
        manifestDigest: 'sha256:manifest-a',
        workflows: {
          checkout: {
            workflowVersion: '2.0.0',
            workflowRevision: 'revision-9',
            contractHash: 'sha256:workflow-contract',
            activities: {
              charge: {
                contractHash: 'sha256:activity-contract',
                implementationRevision: 'revision-10',
              },
            },
          },
        },
        ...overrides,
      },
    },
  };
}

describe('parseWorkerDiagnosticsResponse', () => {
  test('maps every canonical identity axis without collapsing labels', () => {
    const parsed = parseWorkerDiagnosticsResponse(response());

    expect(parsed?.deploymentVersion).toEqual({
      deploymentName: 'payments',
      buildId: 'build-7',
      artifactDigest: 'sha256:artifact-a',
      runtimeName: 'bun',
      runtimeVersion: '1.4.0',
      sdkVersion: '0.20.0',
      manifestVersion: 1,
      protocolVersion: 3,
      manifestDigest: 'sha256:manifest-a',
      workflows: {
        checkout: {
          workflowVersion: '2.0.0',
          workflowRevision: 'revision-9',
          contractHash: 'sha256:workflow-contract',
          activities: {
            charge: {
              contractHash: 'sha256:activity-contract',
              implementationRevision: 'revision-10',
            },
          },
        },
      },
    });
  });

  test('returns null when the worker disconnected before detail resolved', () => {
    expect(parseWorkerDiagnosticsResponse({ worker: null })).toBeNull();
  });

  test('rejects malformed nested contract data at the response boundary', () => {
    expect(() => parseWorkerDiagnosticsResponse(response({ protocolVersion: 'three' }))).toThrow(
      MalformedWorkerDiagnosticsError,
    );
  });
});

describe('parseWorkerRegistrationRejections', () => {
  test('preserves bounded identity evidence and the Weft reason', () => {
    expect(
      parseWorkerRegistrationRejections({
        items: [
          {
            code: 'deployment_conflict',
            rejectedAt: 9,
            workerId: 'worker-a',
            deploymentName: 'payments',
            buildId: 'build-7',
          },
        ],
        limit: 25,
      }),
    ).toEqual([
      {
        code: 'deployment_conflict',
        rejectedAt: 9,
        workerId: 'worker-a',
        deploymentName: 'payments',
        buildId: 'build-7',
      },
    ]);
  });

  test('rejects an unknown reason code', () => {
    expect(() =>
      parseWorkerRegistrationRejections({
        items: [{ code: 'mystery', rejectedAt: 9 }],
        limit: 25,
      }),
    ).toThrow(MalformedWorkerDiagnosticsError);
  });
});

describe('compareDeploymentManifests', () => {
  test('reports artifact and contract disagreement for the same deployment build', () => {
    const first = parseWorkerDiagnosticsResponse(response())!;
    const second = parseWorkerDiagnosticsResponse(
      response({
        artifactDigest: 'sha256:artifact-b',
        manifestDigest: 'sha256:manifest-b',
        workflows: {
          checkout: {
            workflowVersion: '2.0.0',
            workflowRevision: 'revision-11',
            contractHash: 'sha256:workflow-contract-b',
            activities: {},
          },
        },
      }),
    )!;
    const changedWorker: WorkerManifestDiagnostics = {
      ...second,
      instance: { ...second.instance, workerId: 'worker-b' },
    };

    expect(compareDeploymentManifests([first, changedWorker])).toEqual([
      {
        deploymentName: 'payments',
        buildId: 'build-7',
        workers: ['worker-a', 'worker-b'],
        artifactDigests: ['sha256:artifact-a', 'sha256:artifact-b'],
        manifestDigests: ['sha256:manifest-a', 'sha256:manifest-b'],
        disagreements: ['artifact', 'manifest', 'workflow-contract'],
      },
    ]);
  });

  test('keeps a consistent same-build group visible with no disagreements', () => {
    const first = parseWorkerDiagnosticsResponse(response())!;
    const second = { ...first, instance: { ...first.instance, workerId: 'worker-b' } };
    expect(compareDeploymentManifests([first, second])[0]?.disagreements).toEqual([]);
  });

  test('does not compare unrelated deployment builds', () => {
    const first = parseWorkerDiagnosticsResponse(response())!;
    const otherBuild = parseWorkerDiagnosticsResponse(response({ buildId: 'build-8' }))!;
    expect(compareDeploymentManifests([first, otherBuild])).toEqual([]);
  });

  test('canonicalizes nested contracts and orders multiple deployment groups', () => {
    const workflows = {
      shipping: {
        workflowVersion: '1.0.0',
        workflowRevision: 'revision-shipping',
        contractHash: 'sha256:shipping',
        activities: {
          pack: { contractHash: 'sha256:pack', implementationRevision: 'revision-pack' },
          label: { contractHash: 'sha256:label', implementationRevision: 'revision-label' },
        },
      },
      checkout: {
        workflowVersion: '2.0.0',
        workflowRevision: 'revision-checkout',
        contractHash: 'sha256:checkout',
        activities: {},
      },
    };
    const payments = parseWorkerDiagnosticsResponse(response({ workflows }))!;
    const paymentsPeer = {
      ...payments,
      instance: { ...payments.instance, workerId: 'worker-b' },
    };
    const accounts = parseWorkerDiagnosticsResponse(
      response({ deploymentName: 'accounts', workflows }),
    )!;
    const accountsPeer = {
      ...accounts,
      instance: { ...accounts.instance, workerId: 'worker-d' },
    };

    expect(
      compareDeploymentManifests([payments, paymentsPeer, accounts, accountsPeer]).map(
        ({ deploymentName }) => deploymentName,
      ),
    ).toEqual(['accounts', 'payments']);
  });
});
