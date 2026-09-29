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

describe('additional coverage', () => {
  test('renders an activity timeout of exactly 0 — a valid Duration, not the same as "no timeout"', async () => {
    scripted = new ScriptedFetch();
    scripted.enqueueJsonRpcResult(
      registrySnapshot([manifestFixture('order-processing')], {
        chargeCard: { queue: 'default', timeout: 0 },
      }),
    );
    const { findByText } = await renderRegistryTab();
    // A truthy-only guard on `activity.timeout` would suppress this badge
    // for a genuinely configured (if unusual) zero-millisecond timeout.
    expect(await findByText('timeout: 0ms')).not.toBeNull();
  });

  test('shows the honest "no activities" note when the engine has none registered', async () => {
    scripted = new ScriptedFetch();
    scripted.enqueueJsonRpcResult(registrySnapshot([manifestFixture('heartbeat')]));
    const { findByText } = await renderRegistryTab();
    expect(await findByText('No activities registered for this engine.')).not.toBeNull();
  });

  test('a declared root schema that is not `type: object` renders its root type, not "no schema declared"', async () => {
    scripted = new ScriptedFetch();
    scripted.enqueueJsonRpcResult(
      registrySnapshot([
        manifestFixture('order-processing', {
          inputSchema: { type: 'string' },
        }),
      ]),
    );
    const { container, findByRole, queryByText } = await renderRegistryTab();
    await fireEvent.click(await findByRole('button', { name: /order-processing/ }));

    expect(container.textContent).toContain('Declared as string — no object fields to list.');
    expect(
      queryByText('No input schema declared — this definition accepts an untyped payload.'),
    ).toBeNull();
  });

  test('renders a schema field description, when the fragment declares one', async () => {
    scripted = new ScriptedFetch();
    scripted.enqueueJsonRpcResult(
      registrySnapshot([
        manifestFixture('order-processing', {
          inputSchema: {
            type: 'object',
            properties: {
              orderId: { type: 'string', description: 'The order identifier to process.' },
            },
          },
        }),
      ]),
    );
    const { findByRole, findByText } = await renderRegistryTab();
    await fireEvent.click(await findByRole('button', { name: /order-processing/ }));
    expect(await findByText('The order identifier to process.')).not.toBeNull();
  });

  test('renders a nested object field as an expandable schema tree branch', async () => {
    scripted = new ScriptedFetch();
    scripted.enqueueJsonRpcResult(
      registrySnapshot([
        manifestFixture('order-processing', {
          inputSchema: {
            type: 'object',
            required: ['address'],
            properties: {
              address: {
                type: 'object',
                required: ['city'],
                properties: { city: { type: 'string' }, zip: { type: 'string' } },
              },
            },
          },
        }),
      ]),
    );

    const { findAllByText, findByRole } = await renderRegistryTab();

    await fireEvent.click(await findByRole('button', { name: /order-processing/ }));

    const addressMatches = await findAllByText('address');
    expect(addressMatches.length).toBeGreaterThan(0);
    // The nested object's own children render only once its `Tree.Item`
    // branch is expanded (Cinder's `shouldRenderChildren`).
    const expandAddress = await findByRole('button', { name: 'Expand address' });
    await fireEvent.click(expandAddress);
    const cityMatches = await findAllByText('city');
    expect(cityMatches.length).toBeGreaterThan(0);
    const zipMatches = await findAllByText('zip');
    expect(zipMatches.length).toBeGreaterThan(0);
  });
});
