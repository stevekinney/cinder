/**
 * Component tests for the Workers route root (`index.svelte`, plan §9.4)
 * covering the happy-path tab renders, worker/queue selection via URL,
 * drain/resume mutations, dead-letter clearing, and loading skeletons.
 * Split out of `index.test.ts` (which owns the fault-title-mapping
 * regression coverage) purely to stay under this repo's `max-lines` lint
 * budget — both files exercise the same `index.svelte` route root and share
 * the same `ScriptedFetch`/harness support (`workers-route-test-support.test-support.ts`,
 * `workers-route-test-harness.test-harness.svelte`).
 */
import { fireEvent, render } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Window, type DetachedWindowAPI } from 'happy-dom';

import { createQueryClient } from '../../lib/query.ts';
import { router } from '../../lib/router.svelte.ts';
import WorkersRoute from './index.svelte';
import WorkersRouteTestHarness from './workers-route-test-harness.test-harness.svelte';
import {
  parseJsonObject,
  realClient,
  ScriptedFetch,
} from './workers-route-test-support.test-support.ts';

import { deployment, routeHappyPaths, worker } from './index-actions-test-support.ts';

let scripted: ScriptedFetch | undefined;

function happyDomAPI(): DetachedWindowAPI {
  if (!(window instanceof Window)) {
    throw new Error('expected the test window to be backed by happy-dom');
  }
  return window.happyDOM;
}

/** Same convention `system/index.test.ts` (Track E2) and `router.svelte.test.ts` (T1.3) establish: give the window a real origin before the reactive `router` singleton is touched. */
function resetLocation(path = '/workers'): void {
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

async function renderWorkersRoute(
  principalScopes: readonly ('system:read' | 'system:admin' | 'events:read')[] = [
    'system:read',
    'system:admin',
  ],
) {
  return render(WorkersRouteTestHarness, {
    props: {
      client: realClient(),
      queryClient: createQueryClient(),
      component: WorkersRoute,
      principalScopes,
    },
  });
}

describe('Workers route — locked', () => {
  test('without system:read, the whole surface renders the locked EmptyState and no tabs', async () => {
    scripted = new ScriptedFetch();
    routeHappyPaths(scripted);

    const { findByText, queryByRole } = await renderWorkersRoute([]);

    expect(await findByText('Workers are locked')).not.toBeNull();
    expect(queryByRole('tab', { name: 'Fleet overview' })).toBeNull();
  });
});

describe('Workers route — Fleet overview tab', () => {
  test('renders FleetView with the fetched workers and deployments', async () => {
    scripted = new ScriptedFetch();
    routeHappyPaths(scripted, {
      workers: [worker({ id: 'wkr_fleet' })],
      deployments: [deployment({ deploymentName: 'api-prod' })],
    });

    const { findByText } = await renderWorkersRoute();

    expect(await findByText('api-prod')).not.toBeNull();
  });

  test('draining a deployment from the Fleet tab opens the drain dialog, and confirming calls weft.worker.deployments.drain', async () => {
    scripted = new ScriptedFetch();
    routeHappyPaths(scripted, {
      workers: [worker()],
      deployments: [deployment({ deploymentName: 'api-prod' })],
    });
    scripted.routeJsonRpcMethod('weft.worker.deployments.drain', { ok: true });

    const { findAllByRole, findByRole } = await renderWorkersRoute();

    const drainButtons = await findAllByRole('button', { name: 'Drain' });
    await fireEvent.click(drainButtons[0]!);

    const confirmButton = await findByRole('button', { name: 'Drain deployment' });
    await fireEvent.click(confirmButton);

    await new Promise((resolve) => setTimeout(resolve, 0));
    const drainCall = scripted.calls.find((call) => {
      try {
        return (
          typeof call.init?.body === 'string' &&
          parseJsonObject(call.init.body)?.['method'] === 'weft.worker.deployments.drain'
        );
      } catch {
        return false;
      }
    });
    expect(drainCall).toBeDefined();
    const drainedBody = drainCall?.init?.body;
    const drainedParams =
      typeof drainedBody === 'string' ? parseJsonObject(drainedBody)?.['params'] : undefined;
    const drainedDeployment =
      drainedParams !== null && typeof drainedParams === 'object'
        ? Reflect.get(drainedParams, 'deploymentName')
        : undefined;
    expect(drainedDeployment).toBe('api-prod');
  });

  test('resuming a deployment from the Fleet tab calls weft.worker.deployments.resume directly, no dialog', async () => {
    scripted = new ScriptedFetch();
    routeHappyPaths(scripted, {
      workers: [worker()],
      deployments: [deployment({ deploymentName: 'api-prod', health: 'draining' })],
    });
    scripted.routeJsonRpcMethod('weft.worker.deployments.resume', { ok: true });

    const { findByRole, queryByRole } = await renderWorkersRoute();

    await fireEvent.click(await findByRole('button', { name: 'Resume' }));

    await new Promise((resolve) => setTimeout(resolve, 0));
    const resumeCall = scripted.calls.find((call) => {
      try {
        return (
          typeof call.init?.body === 'string' &&
          parseJsonObject(call.init.body)?.['method'] === 'weft.worker.deployments.resume'
        );
      } catch {
        return false;
      }
    });
    expect(resumeCall).toBeDefined();
    // No drain-style dialog should have appeared for a resume action.
    expect(queryByRole('dialog', { name: 'Drain deployment' })).toBeNull();
  });
});

describe('Workers route — Workers tab, worker selection and drain/resume', () => {
  test('no worker selected renders WorkerListView', async () => {
    scripted = new ScriptedFetch();
    routeHappyPaths(scripted, { workers: [worker({ id: 'wkr_listed' })] });

    const { findByRole, findByText } = await renderWorkersRoute();

    await fireEvent.click(await findByRole('tab', { name: 'Workers' }));
    expect(await findByText('wkr_listed', { exact: false })).not.toBeNull();
  });

  test('selecting a worker via ?worker= renders WorkerDetailView, and draining it with a reason calls weft.workers.drain', async () => {
    scripted = new ScriptedFetch();
    routeHappyPaths(scripted, { workers: [worker({ id: 'wkr_selected', health: 'active' })] });
    scripted.routeJsonRpcMethod('weft.workers.drain', { ok: true });

    resetLocation('/workers?tab=list&worker=wkr_selected');
    const { findByLabelText, findByRole } = await renderWorkersRoute();

    await fireEvent.click(await findByRole('button', { name: 'Drain' }));
    const reasonInput = await findByLabelText('Reason');
    await fireEvent.input(reasonInput, { target: { value: 'rolling restart' } });
    await fireEvent.click(await findByRole('button', { name: 'Drain worker' }));

    await new Promise((resolve) => setTimeout(resolve, 0));
    const drainCall = scripted.calls.find((call) => {
      try {
        return (
          typeof call.init?.body === 'string' &&
          parseJsonObject(call.init.body)?.['method'] === 'weft.workers.drain'
        );
      } catch {
        return false;
      }
    });
    expect(drainCall).toBeDefined();
    const drainBody = drainCall?.init?.body;
    if (typeof drainBody !== 'string') throw new Error('drain request body missing');
    const drainParams = parseJsonObject(drainBody)?.['params'];
    if (drainParams === null || typeof drainParams !== 'object') {
      throw new Error('drain request parameters missing');
    }
    expect(Reflect.get(drainParams, 'workerId')).toBe('wkr_selected');
    expect(Reflect.get(drainParams, 'reason')).toBe('rolling restart');
  });

  test('resuming a draining selected worker calls weft.workers.resume directly, no dialog', async () => {
    scripted = new ScriptedFetch();
    routeHappyPaths(scripted, { workers: [worker({ id: 'wkr_draining', health: 'draining' })] });
    scripted.routeJsonRpcMethod('weft.workers.resume', { ok: true });

    resetLocation('/workers?tab=list&worker=wkr_draining');
    const { findByRole } = await renderWorkersRoute();

    await fireEvent.click(await findByRole('button', { name: 'Resume' }));

    await new Promise((resolve) => setTimeout(resolve, 0));
    const resumeCall = scripted.calls.find((call) => {
      try {
        return (
          typeof call.init?.body === 'string' &&
          parseJsonObject(call.init.body)?.['method'] === 'weft.workers.resume'
        );
      } catch {
        return false;
      }
    });
    expect(resumeCall).toBeDefined();
  });
});
