/**
 * Component tests for the System route shell (`index.svelte`; plan §9.7).
 * Covers URL-owned tab state: default tab, switching tabs updates `?tab=`,
 * and a deep link into a non-default tab renders that tab on load.
 */
import { fireEvent, render } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Window, type DetachedWindowAPI } from 'happy-dom';

import { createQueryClient } from '../../lib/query.ts';
import { router } from '../../lib/router.svelte.ts';
import SystemRoute from './index.svelte';
import type { RegistrySnapshotSource } from './registry-view.ts';
import SystemRouteTestHarness from './system-route-test-harness.test-harness.svelte';
import { realClient, ScriptedFetch } from './system-test-support.test-support.ts';

let scripted: ScriptedFetch | undefined;

function happyDomAPI(): DetachedWindowAPI {
  if (!(window instanceof Window)) {
    throw new Error('expected the test window to be backed by happy-dom');
  }
  return window.happyDOM;
}

/**
 * happy-dom's default `window.location` is `about:blank` (no origin), and
 * `history.pushState`/`replaceState` are silent no-ops from a non-hierarchical
 * origin — same convention `router.svelte.test.ts` (T1.3) establishes: give
 * the window a real origin before every test touches the reactive `router`
 * singleton.
 */
function resetLocation(path = '/system'): void {
  happyDomAPI().setURL('http://localhost/');
  router.navigate(path, { replace: true });
}

beforeEach(() => {
  resetLocation();
});

afterEach(() => {
  scripted?.restore();
  scripted = undefined;
});

async function renderSystemRoute(
  registry: RegistrySnapshotSource = {
    registryVersion: 2,
    generatedAt: '2026-01-01T00:00:00.000Z',
    workflows: [],
    activeRevisions: {},
    activities: {},
  },
) {
  scripted = new ScriptedFetch();
  scripted.routeJsonRpcMethod('weft.system.registry', registry);
  // The "deep-linking to ?tab=alerts" test below mounts `<AlertsTab>`, which
  // subscribes to the harness's shared `FleetEventSource` on mount — an
  // open-ended stream avoids a real fetch failure driving a background
  // reconnect loop for the rest of the test (`ScriptedFetch.routeSseStream`'s
  // own doc: "stays open … never closes on its own").
  scripted.routeSseStream('/v1/events/sse', []);

  return render(SystemRouteTestHarness, {
    props: { client: realClient(), queryClient: createQueryClient(), component: SystemRoute },
  });
}

describe('System route', () => {
  test('defaults to the Registry tab when no ?tab= is present', async () => {
    const { findByRole } = await renderSystemRoute();
    const registryTrigger = await findByRole('tab', { name: 'Registry' });
    expect(registryTrigger.getAttribute('aria-selected')).toBe('true');
  });

  test('clicking a tab updates the URL and renders that tab', async () => {
    const { findByRole } = await renderSystemRoute();

    await fireEvent.click(await findByRole('tab', { name: 'Scopes' }));

    expect(router.search.get('tab')).toBe('scopes');
    const scopesTrigger = await findByRole('tab', { name: 'Scopes' });
    expect(scopesTrigger.getAttribute('aria-selected')).toBe('true');
  });

  test('deep-linking to ?tab=alerts renders the Alerts tab on load', async () => {
    resetLocation('/system?tab=alerts');
    const { findByRole } = await renderSystemRoute();
    const alertsTrigger = await findByRole('tab', { name: 'Alerts' });
    expect(alertsTrigger.getAttribute('aria-selected')).toBe('true');
  });

  test('switching to Metrics, Discovery, Operations, and Health & lease mounts each tab panel', async () => {
    const { findAllByText, findByRole, findByText } = await renderSystemRoute();
    scripted?.routeJsonRpcMethod('weft.system.metrics', {});
    scripted?.routeUrl('/openapi.json', { paths: {} });
    scripted?.routeUrl('/openrpc.json', { methods: [] });
    scripted?.routeUrl('/asyncapi.json', { channels: {} });
    scripted?.routeUrl('/retention', {
      defaultRetention: null,
      sweepIntervalMs: 300000,
      sweepBatchSize: 1000,
      nextSweepAt: null,
      workflowTypes: [],
    });

    await fireEvent.click(await findByRole('tab', { name: 'Metrics' }));
    const metricsMatches = await findAllByText('Active workflows');
    expect(metricsMatches.length).toBeGreaterThan(0);

    await fireEvent.click(await findByRole('tab', { name: 'Discovery' }));
    expect(await findByRole('radio', { name: 'OpenAPI' })).not.toBeNull();

    await fireEvent.click(await findByRole('tab', { name: 'Operations' }));
    expect(
      await findByText("Required scope isn't advertised by the discovery documents yet", {
        exact: false,
      }),
    ).not.toBeNull();

    await fireEvent.click(await findByRole('tab', { name: 'Health & lease' }));
    expect(await findByText('Lease status not available')).not.toBeNull();
  });

  test('an unrecognized ?tab= value falls back to Registry rather than erroring', async () => {
    resetLocation('/system?tab=nonsense');
    const { findByRole } = await renderSystemRoute();
    const registryTrigger = await findByRole('tab', { name: 'Registry' });
    expect(registryTrigger.getAttribute('aria-selected')).toBe('true');
  });

  test('renders public Cinder badges throughout the Registry route', async () => {
    const { findAllByText, findByRole, findByText } = await renderSystemRoute({
      registryVersion: 2,
      generatedAt: '2026-01-01T00:00:00.000Z',
      workflows: [
        {
          manifestVersion: 1,
          name: 'order-processing',
          workflowVersion: '1.0.0',
          revision: 'order-processing-rev',
          contractHash: 'order-processing-hash',
          contract: {
            name: 'order-processing',
            workflowVersion: '1.0.0',
            tags: ['payments'],
            inputSchema: {
              type: 'object',
              required: ['orderId'],
              properties: {
                note: { type: 'string' },
                orderId: { type: 'string' },
              },
            },
          },
        },
        {
          manifestVersion: 1,
          name: 'heartbeat',
          workflowVersion: '1.0.0',
          revision: 'heartbeat-rev',
          contractHash: 'heartbeat-hash',
          contract: { name: 'heartbeat', workflowVersion: '1.0.0' },
        },
      ],
      activeRevisions: {
        'order-processing': 'order-processing-rev',
        heartbeat: 'heartbeat-rev',
      },
      activities: {
        chargeCard: {
          queue: 'default',
          inputSchema: {
            type: 'object',
            properties: { amount: { type: 'number' } },
          },
        },
      },
    });

    const workflowFieldCountBadge = await findByText('2 fields');
    const noSchemaBadge = await findByText('none');
    const queueBadge = await findByText('queue: default');
    const activityFieldCountBadge = await findByText('1 field');
    expect(workflowFieldCountBadge.getAttribute('data-cinder-variant')).toBe('success');
    expect(noSchemaBadge.getAttribute('data-cinder-variant')).toBe('neutral');
    expect(queueBadge.getAttribute('data-cinder-variant')).toBe('neutral');
    expect(activityFieldCountBadge.getAttribute('data-cinder-variant')).toBe('success');

    await fireEvent.click(await findByRole('button', { name: /order-processing/ }));

    const typeBadges = await findAllByText('string');
    expect(typeBadges).toHaveLength(2);
    expect(typeBadges[0]?.getAttribute('data-cinder-monospace')).toBe('');
    const requiredBadge = await findByText('required');
    const optionalBadge = await findByText('optional');
    expect(requiredBadge.getAttribute('data-cinder-variant')).toBe('warning');
    expect(optionalBadge.getAttribute('data-cinder-variant')).toBe('neutral');
  });
});
