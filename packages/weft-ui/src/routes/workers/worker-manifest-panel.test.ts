import { render } from '@testing-library/svelte';
import { describe, expect, test } from 'bun:test';

import {
  MalformedWorkerDiagnosticsError,
  type WorkerManifestDiagnostics,
} from './worker-manifest-diagnostics.ts';
import WorkerManifestPanel from './worker-manifest-panel.svelte';

function diagnostics(): WorkerManifestDiagnostics {
  return {
    instance: {
      workerId: 'worker-a',
      queue: 'payments',
      health: 'active',
      connectedAt: 1,
      startedAt: 1,
      lastHeartbeatAt: 1,
      heartbeatAgeMs: 1,
    },
    deploymentVersion: {
      deploymentName: 'payments-api',
      buildId: 'build-7',
      artifactDigest: 'sha256:artifact',
      runtimeName: 'bun',
      runtimeVersion: '1.4.0',
      sdkVersion: '0.20.0',
      manifestVersion: 1,
      protocolVersion: 3,
      manifestDigest: 'sha256:manifest',
      workflows: {
        checkout: {
          workflowVersion: '2.0.0',
          workflowRevision: 'workflow-revision',
          contractHash: 'sha256:workflow-contract',
          activities: {
            charge: {
              implementationRevision: 'activity-revision',
              contractHash: 'sha256:activity-contract',
            },
          },
        },
      },
    },
  };
}

describe('WorkerManifestPanel', () => {
  test('shows readiness only with server-accepted diagnostics and keeps every identity distinct', () => {
    const { getByText } = render(WorkerManifestPanel, {
      props: {
        diagnostics: diagnostics(),
        loading: false,
        refreshing: false,
        error: null,
        capabilities: { scheduling: { maxConcurrency: 4 }, cancellation: true },
      },
    });

    expect(getByText('Ready · server accepted')).not.toBeNull();
    for (const value of [
      'payments-api',
      'build-7',
      'sha256:artifact',
      'bun 1.4.0',
      '0.20.0',
      'sha256:manifest',
      'workflow-revision',
      'sha256:workflow-contract',
      'activity-revision',
      'sha256:activity-contract',
      'payments',
      'cancellation',
      'scheduling',
    ]) {
      expect(getByText(value)).not.toBeNull();
    }
  });

  test('shows an explicit loading state without claiming readiness', () => {
    const { getByLabelText, queryByText } = render(WorkerManifestPanel, {
      props: {
        diagnostics: undefined,
        loading: true,
        refreshing: false,
        error: null,
        capabilities: {},
      },
    });
    expect(getByLabelText('Loading canonical worker manifest')).not.toBeNull();
    expect(queryByText('Ready · server accepted')).toBeNull();
  });

  test('shows stale-disconnect evidence when detail resolves to null', () => {
    const { getByText, queryByText } = render(WorkerManifestPanel, {
      props: {
        diagnostics: null,
        loading: false,
        refreshing: false,
        error: null,
        capabilities: {},
      },
    });
    expect(getByText('Worker no longer connected')).not.toBeNull();
    expect(queryByText('Ready · server accepted')).toBeNull();
  });

  test('shows malformed/server data failures explicitly', () => {
    const malformed = render(WorkerManifestPanel, {
      props: {
        diagnostics: undefined,
        loading: false,
        refreshing: false,
        error: new MalformedWorkerDiagnosticsError('response.worker'),
        capabilities: {},
      },
    });
    expect(malformed.getByText('Malformed server response')).not.toBeNull();
    expect(
      malformed.getByText('The server returned malformed worker diagnostics at response.worker.'),
    ).not.toBeNull();
    malformed.unmount();

    const serverFault = render(WorkerManifestPanel, {
      props: {
        diagnostics: undefined,
        loading: false,
        refreshing: false,
        error: new Error('server fault'),
        capabilities: {},
      },
    });
    expect(serverFault.getByText('Something went wrong')).not.toBeNull();
  });

  test('labels cached evidence while a refresh is pending', () => {
    const { getByText } = render(WorkerManifestPanel, {
      props: {
        diagnostics: diagnostics(),
        loading: false,
        refreshing: true,
        error: null,
        capabilities: {},
      },
    });
    expect(getByText('Refreshing · showing cached evidence')).not.toBeNull();
  });
});
