import { render } from '@testing-library/svelte';
import { describe, expect, test } from 'bun:test';

import ManifestDiagnosticsView from './manifest-diagnostics-view.svelte';
import type { WorkerManifestDiagnostics } from './worker-manifest-diagnostics.ts';

function diagnostics(workerId: string, artifactDigest: string): WorkerManifestDiagnostics {
  return {
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
      buildId: 'build-7',
      artifactDigest,
      runtimeName: 'bun',
      runtimeVersion: '1.4.0',
      sdkVersion: '0.20.0',
      manifestVersion: 1,
      protocolVersion: 3,
      manifestDigest: artifactDigest,
      workflows: {},
    },
  };
}

describe('ManifestDiagnosticsView', () => {
  test('shows same-build artifact disagreement before routing eligibility', () => {
    const { getByText } = render(ManifestDiagnosticsView, {
      props: {
        diagnostics: [diagnostics('worker-a', 'sha256:a'), diagnostics('worker-b', 'sha256:b')],
        rejections: [],
      },
    });
    expect(getByText('payments · build-7')).not.toBeNull();
    expect(getByText('Disagreement · artifact, manifest')).not.toBeNull();
  });

  test('shows a consistent same-build claim with an explicit text label', () => {
    const first = diagnostics('worker-a', 'sha256:a');
    const { getByText } = render(ManifestDiagnosticsView, {
      props: {
        diagnostics: [first, { ...first, instance: { ...first.instance, workerId: 'worker-b' } }],
        rejections: [],
      },
    });
    expect(getByText('Consistent · routing eligible')).not.toBeNull();
  });

  test('renders the bounded Weft admission reason and attempted identity', () => {
    const { getByText } = render(ManifestDiagnosticsView, {
      props: {
        diagnostics: [],
        rejections: [
          {
            code: 'unsupported_protocol_version',
            rejectedAt: Date.now(),
            workerId: 'worker-old',
            queue: 'default',
          },
        ],
      },
    });
    expect(getByText('Unsupported protocol version')).not.toBeNull();
    expect(getByText('worker-old')).not.toBeNull();
  });

  test('renders empty, loading, and server-fault states explicitly', () => {
    const empty = render(ManifestDiagnosticsView, { props: { diagnostics: [], rejections: [] } });
    expect(empty.getByText('No manifest diagnostics')).not.toBeNull();
    empty.unmount();

    const loading = render(ManifestDiagnosticsView, {
      props: { diagnostics: [], rejections: [], loading: true },
    });
    expect(loading.getByLabelText('Loading manifest diagnostics')).not.toBeNull();
    loading.unmount();

    const fault = render(ManifestDiagnosticsView, {
      props: { diagnostics: [], rejections: [], error: new Error('server fault') },
    });
    expect(fault.getByText('Something went wrong')).not.toBeNull();
  });
});
