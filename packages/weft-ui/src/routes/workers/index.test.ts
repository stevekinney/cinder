/**
 * Component test for the Workers route root (`index.svelte`, plan §9.4).
 *
 * Regression coverage for a real bug found during the final release-gate
 * dev-harness pass: every one of the route's four inline fault fallbacks
 * (Fleet overview, Workers list, Task queues, Diagnostics) hardcoded the
 * `EmptyState` title to the literal string `"Something went wrong"` —
 * `FAULT_TREATMENT_TITLE.internal`'s exact text — regardless of the actual
 * classified fault kind. A 401 (`unauthorized`) therefore showed the wrong
 * heading ("Something went wrong" instead of "Not authorized") even though
 * the description text underneath it was correct. Confirmed live against
 * `bun scripts/dev-server.ts` (`weft.workers.list` 401s for an anonymous
 * caller under that harness's real, documented auth posture — see that
 * file's own module doc) before fixing `index.svelte` to derive the title
 * from `FAULT_TREATMENT_TITLE[faultTreatment(error).kind]`, matching every
 * other fault-rendering call site in this codebase
 * (`fault-boundary.svelte`, `schedules/fault-banner.svelte`,
 * `system/query-fault-banner.svelte`, …).
 *
 * See `index-actions.test.ts` for the route root's happy-path tab renders,
 * worker/queue selection, drain/resume mutations, dead-letter clearing, and
 * loading-skeleton coverage — split into its own file purely to stay under
 * this repo's `max-lines` lint budget.
 */
import { act, fireEvent, render } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Window, type DetachedWindowAPI } from 'happy-dom';

import { createQueryClient } from '../../lib/query.ts';
import { router } from '../../lib/router.svelte.ts';
import WorkersRoute from './index.svelte';
import WorkersRouteTestHarness from './workers-route-test-harness.test-harness.svelte';
import { realClient, ScriptedFetch } from './workers-route-test-support.test-support.ts';

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

async function renderWorkersRoute() {
  scripted?.routeJsonRpcMethod('weft.workers.rejections', { items: [], limit: 25 });
  return render(WorkersRouteTestHarness, {
    props: {
      client: realClient(),
      queryClient: createQueryClient(),
      component: WorkersRoute,
      principalScopes: ['system:read', 'system:admin'],
    },
  });
}

describe('Workers route — fault title mapping', () => {
  test('teardown does not read a destroyed task selection', async () => {
    scripted = new ScriptedFetch();
    scripted.routeJsonRpcMethod('weft.workers.list', { items: [], deployments: [] });
    scripted.routeJsonRpcMethod('weft.task.queues.list', { items: [] });
    scripted.routeJsonRpcMethod('weft.tasks.diagnostics', {
      items: [],
      summary: {
        stuckQueued: 0,
        staleInflight: 0,
        retryStorms: 0,
        allWorkersAtCapacity: 0,
        deadLettered: 0,
        delayed: 0,
        unadoptedTerminal: 0,
      },
    });
    const originalWarn = console.warn;
    const warnings: unknown[][] = [];
    console.warn = (...arguments_: unknown[]) => {
      warnings.push(arguments_);
      originalWarn(...arguments_);
    };
    try {
      const view = await renderWorkersRoute();
      await view.findByText('No workers connected');
      view.unmount();
      router.navigate('/workers?tab=queues');
      await act();
      expect(warnings).toEqual([]);
    } finally {
      console.warn = originalWarn;
    }
  });

  test('a 401 on the Fleet overview tab shows "Not authorized", not the internal-fault title', async () => {
    scripted = new ScriptedFetch();
    scripted.routeJsonRpcMethodError(
      'weft.workers.list',
      401,
      'authentication required',
      'Unauthorized',
    );
    scripted.routeJsonRpcMethod('weft.task.queues.list', { items: [] });
    scripted.routeJsonRpcMethod('weft.tasks.diagnostics', {
      items: [],
      summary: {
        stuckQueued: 0,
        staleInflight: 0,
        retryStorms: 0,
        allWorkersAtCapacity: 0,
        deadLettered: 0,
        delayed: 0,
        unadoptedTerminal: 0,
      },
    });

    const { findByText, queryByText } = await renderWorkersRoute();

    expect(await findByText('Not authorized')).not.toBeNull();
    expect(await findByText('authentication required')).not.toBeNull();
    // The bug this test guards against: the title must not fall back to the
    // `internal` treatment's title for a fault that classified as something
    // else.
    expect(queryByText('Something went wrong')).toBeNull();
  });

  test('a 401 on the Task queues tab shows "Not authorized", not the internal-fault title', async () => {
    scripted = new ScriptedFetch();
    scripted.routeJsonRpcMethod('weft.workers.list', { items: [], deployments: [] });
    scripted.routeJsonRpcMethodError(
      'weft.task.queues.list',
      401,
      'authentication required',
      'Unauthorized',
    );
    scripted.routeJsonRpcMethod('weft.tasks.diagnostics', {
      items: [],
      summary: {
        stuckQueued: 0,
        staleInflight: 0,
        retryStorms: 0,
        allWorkersAtCapacity: 0,
        deadLettered: 0,
        delayed: 0,
        unadoptedTerminal: 0,
      },
    });

    const { findByRole, findByText, queryByText } = await renderWorkersRoute();

    await fireEvent.click(await findByRole('tab', { name: 'Task queues' }));

    expect(await findByText('Not authorized')).not.toBeNull();
    expect(queryByText('Something went wrong')).toBeNull();
  });
});
