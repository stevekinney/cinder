/**
 * Component tests for `<RegistryTab>` (plan §9.7 T7.2). Covers loading,
 * fault, 3-step onboarding empty state, the definitions list, and drilling
 * into a definition's detail panel (Appendix B: "Registry (schema tree)").
 */
import { fireEvent, render } from '@testing-library/svelte';
import { afterEach, describe, expect, test } from 'bun:test';

import { createQueryClient } from '../../lib/query.ts';
import RegistryTab from './registry-tab.svelte';
import SystemRouteTestHarness from './system-route-test-harness.test-harness.svelte';
import { realClient, ScriptedFetch } from './system-test-support.test-support.ts';

let scripted: ScriptedFetch | undefined;

afterEach(() => {
  scripted?.restore();
  scripted = undefined;
});

/** One `WorkflowRevisionManifest`-shaped fixture entry, active by construction (`revision` is what `activeRevisionsFor` reads back). */
function manifestFixture(name: string, contract: Record<string, unknown> = {}) {
  return {
    manifestVersion: 1,
    name,
    workflowVersion: '1.0.0',
    revision: `${name}-rev`,
    contractHash: `${name}-hash`,
    contract: { name, workflowVersion: '1.0.0', ...contract },
  };
}

function activeRevisionsFor(workflows: readonly { name: string; revision: string }[]) {
  return Object.fromEntries(workflows.map((entry) => [entry.name, entry.revision]));
}

/** A v2 registry snapshot with the given workflow manifests (each marked active) and activities. */
function registrySnapshot(
  workflows: readonly ReturnType<typeof manifestFixture>[],
  activities: Record<string, unknown> = {},
) {
  return {
    registryVersion: 2,
    generatedAt: '2026-01-01T00:00:00.000Z',
    workflows,
    activeRevisions: activeRevisionsFor(workflows),
    activities,
  };
}

async function renderRegistryTab(
  manifestFixtures: {
    workers?: readonly Record<string, unknown>[];
    diagnostics?: unknown;
    rejections?: readonly Record<string, unknown>[];
  } = {},
) {
  const fetch = scripted;
  if (fetch === undefined) throw new Error('ScriptedFetch must be installed before rendering');

  fetch.routeJsonRpcMethod('weft.workers.list', {
    items: manifestFixtures.workers ?? [],
    deployments: [],
    routingPolicy: 'least-loaded',
  });
  fetch.routeJsonRpcMethod('weft.workers.rejections', {
    items: manifestFixtures.rejections ?? [],
    limit: 25,
  });
  if (manifestFixtures.diagnostics !== undefined) {
    fetch.routeJsonRpcMethod('weft.workers.diagnostics', manifestFixtures.diagnostics);
  }
  // Drilling into a definition's detail panel now also mounts
  // `<WorkflowRevisionsPanel>` (WFT-115), which queries these two catalog
  // operations regardless of which workflow type was clicked — a standing
  // empty-by-default route here keeps every pre-existing drill-in test
  // working without each one having to know about the Revisions panel.
  fetch.routeJsonRpcMethod('weft.workflows.revisions.list', []);
  fetch.routeJsonRpcMethod('weft.catalog.sources.list', { sources: [] });
  fetch.routeJsonRpcError('weft.workflows.active.get', {
    code: -32020,
    message: 'never activated',
    data: { weftCode: 'NotFound', httpStatus: 404 },
  });
  return render(SystemRouteTestHarness, {
    props: { client: realClient(), queryClient: createQueryClient(), component: RegistryTab },
  });
}

describe('RegistryTab', () => {
  test('shows a loading state while the query is pending', async () => {
    scripted = new ScriptedFetch();
    // No response queued — the request stays pending for this assertion.
    const { getByLabelText } = await renderRegistryTab();
    expect(getByLabelText('Loading registry')).not.toBeNull();
  });

  test('shows the fault banner on a failed fetch, with a working Retry', async () => {
    scripted = new ScriptedFetch();
    scripted.enqueueJson(
      {
        jsonrpc: '2.0',
        id: 1,
        error: { code: -32000, message: 'Forbidden', data: { httpStatus: 403 } },
      },
      { status: 200 },
    );
    scripted.enqueueJsonRpcResult(registrySnapshot([]));
    const { findByText, getByRole } = await renderRegistryTab();
    expect(await findByText('Not authorized')).not.toBeNull();

    await fireEvent.click(getByRole('button', { name: 'Retry' }));
    expect(await findByText('Install the SDK', { exact: false })).not.toBeNull();
  });

  test('renders the 3-step onboarding empty state when nothing is registered', async () => {
    scripted = new ScriptedFetch();
    scripted.enqueueJsonRpcResult(registrySnapshot([]));
    const { findByText } = await renderRegistryTab();
    expect(await findByText('Install the SDK', { exact: false })).not.toBeNull();
  });

  test('adds accepted worker-manifest and admission diagnostics to the registry surface', async () => {
    scripted = new ScriptedFetch();
    scripted.enqueueJsonRpcResult(registrySnapshot([]));
    const { findByText } = await renderRegistryTab({
      workers: [{ id: 'worker-a' }],
      diagnostics: {
        worker: {
          instance: {
            workerId: 'worker-a',
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
      },
      rejections: [{ code: 'registration_rejected', rejectedAt: 9, workerId: 'worker-b' }],
    });

    expect(await findByText('Worker registry admission diagnostics')).not.toBeNull();
    expect(await findByText(/accepted and routing-eligible/)).not.toBeNull();
    expect(await findByText('Admission policy rejected')).not.toBeNull();
  });

  test('lists workflow definitions and activities, then drills into a definition detail', async () => {
    scripted = new ScriptedFetch();
    scripted.enqueueJsonRpcResult(
      registrySnapshot(
        [
          manifestFixture('order-processing', {
            description: 'Processes an order end to end.',
            tags: ['payments'],
            inputSchema: {
              type: 'object',
              required: ['orderId'],
              properties: {
                orderId: { type: 'string' },
                note: { type: 'string' },
              },
            },
            signals: { cancel: { inputSchema: { type: 'object', properties: {} } } },
            updates: {
              expedite: {
                inputSchema: { type: 'object', properties: {} },
                outputSchema: { type: 'object', properties: {} },
              },
            },
            queries: { status: { outputSchema: { type: 'object', properties: {} } } },
            activities: { chargeCard: { inputSchema: { type: 'object', properties: {} } } },
            finalizer: { inputSchema: { type: 'object', properties: {} } },
          }),
          manifestFixture('heartbeat'),
        ],
        {
          chargeCard: {
            queue: 'default',
            inputSchema: {
              type: 'object',
              required: ['amount'],
              properties: { amount: { type: 'number' } },
            },
            retry: {
              maxAttempts: 3,
              initialBackoff: '200ms',
              backoffMultiplier: 2,
              maxBackoff: '2s',
              nonRetryableErrors: ['ValidationError'],
            },
            timeout: '30s',
          },
        },
      ),
    );

    const { findByText, findAllByText, findByTitle, getByRole } = await renderRegistryTab();

    expect(await findByText('order-processing')).not.toBeNull();
    expect(await findByText('chargeCard')).not.toBeNull();
    const fieldCountBadge = await findByText('2 fields');
    expect(fieldCountBadge.getAttribute('data-cinder-variant')).toBe('success');
    expect(fieldCountBadge.getAttribute('data-cinder-size')).toBe('md');

    const noSchemaBadge = await findByText('none');
    expect(noSchemaBadge.getAttribute('data-cinder-variant')).toBe('neutral');
    expect(noSchemaBadge.getAttribute('data-cinder-size')).toBe('md');

    const queueBadge = await findByText('queue: default');
    expect(queueBadge.getAttribute('data-cinder-variant')).toBe('neutral');
    expect(queueBadge.getAttribute('data-cinder-size')).toBe('md');

    const activityFieldCountBadge = await findByText('1 field');
    expect(activityFieldCountBadge.getAttribute('data-cinder-variant')).toBe('success');
    expect(activityFieldCountBadge.getAttribute('data-cinder-size')).toBe('md');

    // Full retry policy, not just maxAttempts — backoff timing and
    // non-retryable errors are operationally significant and were
    // previously hidden entirely.
    expect(await findByText('retry: 3x, 200ms→2s ×2')).not.toBeNull();
    expect(await findByText('never retries: ValidationError')).not.toBeNull();
    expect(await findByText('timeout: 30s')).not.toBeNull();

    await fireEvent.click(getByRole('button', { name: /order-processing/ }));

    expect(await findByText('Processes an order end to end.')).not.toBeNull();

    // Revision identity (WFT-115): the exact revision/contractHash are on
    // the element's `title` (hover-full convention, plan §10.8) even
    // though the visible text is truncated; manifest version verbatim.
    expect(await findByTitle('order-processing-rev')).not.toBeNull();
    expect(await findByTitle('order-processing-hash')).not.toBeNull();
    expect(await findByText('manifest v1')).not.toBeNull();
    expect(await findByText('workflow v1.0.0')).not.toBeNull();

    // The full contract surface (WFT-115) — no longer the #736 gap note.
    expect(await findAllByText('cancel')).not.toHaveLength(0);
    expect(await findAllByText('expedite')).not.toHaveLength(0);
    expect(await findAllByText('status')).not.toHaveLength(0);
    expect(await findAllByText('finalizer')).not.toHaveLength(0);
    const paymentElements = await findAllByText('payments');
    const tagBadge = paymentElements.find(
      (element) => element.getAttribute('data-cinder-variant') !== null,
    );
    expect(tagBadge?.getAttribute('data-cinder-variant')).toBe('neutral');
    expect(tagBadge?.getAttribute('data-cinder-size')).toBe('md');
    const orderIdMatches = await findAllByText('orderId');
    expect(orderIdMatches.length).toBeGreaterThan(0);

    const typeBadges = await findAllByText('string');
    expect(typeBadges).toHaveLength(2);
    for (const typeBadge of typeBadges) {
      expect(typeBadge.getAttribute('data-cinder-monospace')).toBe('');
      expect(typeBadge.getAttribute('data-cinder-size')).toBe('md');
    }

    const requiredBadge = await findByText('required');
    expect(requiredBadge.getAttribute('data-cinder-variant')).toBe('warning');
    expect(requiredBadge.getAttribute('data-cinder-size')).toBe('md');

    const optionalBadge = await findByText('optional');
    expect(optionalBadge.getAttribute('data-cinder-variant')).toBe('neutral');
    expect(optionalBadge.getAttribute('data-cinder-size')).toBe('md');

    await fireEvent.click(getByRole('button', { name: 'Workflow definitions' }));
    expect(await findByText('order-processing')).not.toBeNull();

    await fireEvent.click(getByRole('button', { name: /heartbeat/ }));
    expect(
      await findByText('No input schema declared — this definition accepts an untyped payload.'),
    ).not.toBeNull();

    // `heartbeat`'s fixture contract declares no signals/updates/queries/
    // activities/finalizer at all (WFT-115) — every contract-section panel
    // renders its honest empty note rather than nothing.
    expect(await findByText('No signals declared.')).not.toBeNull();
    expect(await findByText('No updates declared.')).not.toBeNull();
    expect(await findByText('No queries declared.')).not.toBeNull();
    expect(await findByText('No activities declared.')).not.toBeNull();
    expect(await findByText('No finalizer declared.')).not.toBeNull();
  });
});
