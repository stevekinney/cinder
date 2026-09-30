import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Window, type DetachedWindowAPI } from 'happy-dom';

import type { WorkflowSummary } from '@lostgradient/weft';
import { QueryClient } from '@tanstack/svelte-query';
import { fireEvent, render, waitFor } from '@testing-library/svelte';

import { router } from '../../../lib/router.svelte.ts';
import type { Principal } from '../../../lib/scopes.svelte.ts';
import WorkflowListHarness from './workflow-list.test-harness.svelte';
import { realClient, ScriptedFetch } from './workflow-test-support.test-support.ts';

/**
 * happy-dom's default `window.location` is `about:blank` (no origin), and
 * `history.pushState`/`replaceState` are silent no-ops from a
 * non-hierarchical origin — every test below navigates the real `router`
 * singleton, so it needs a real origin first. Same convention as
 * `src/lib/router.svelte.test.ts`.
 */
function happyDomAPI(): DetachedWindowAPI {
  if (!(window instanceof Window)) {
    throw new Error('expected the test window to be backed by happy-dom');
  }
  return window.happyDOM;
}

function resetLocation(path = '/workflows'): void {
  happyDomAPI().setURL('http://localhost/');
  router.navigate(path, { replace: true });
}

const GRANTED_PRINCIPAL: Principal = {
  scopes: ['workflows:read', 'workflows:write'],
  unauthenticatedAccess: null,
};

function summary(overrides: Partial<WorkflowSummary> = {}): WorkflowSummary {
  return {
    id: 'wf_4a9f1234567890abcdef2c10',
    type: 'order-processing',
    status: 'running',
    version: '1',
    createdAt: Date.now() - 60_000,
    updatedAt: Date.now() - 1_000,
    ...overrides,
  };
}

function newQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

let fetchScript: ScriptedFetch;

beforeEach(() => {
  fetchScript = new ScriptedFetch();
  resetLocation();
});

afterEach(() => {
  fetchScript.restore();
});

describe('WorkflowList', () => {
  // This test navigates the shared `router` singleton to a URL carrying a
  // query string (`?status=failed`), unlike every other test below (plain
  // `/workflows`). Ordered FIRST in the file: Svelte's dev-mode batch
  // flush walks every historical reactive consumer of a shared external
  // `$state` source (here, `router`) on each mutation, including deriveds
  // from components unmounted by EARLIER tests in this same process (a
  // real page load never remounts against the same long-lived module
  // instance the way a same-process test file does) — enough accumulated
  // unmounted consumers plus a further `router.navigate()` call trips a
  // harmless `derived_inert` advisory warning (confirmed via a reproduction
  // harness: identical assertions, zero incorrect values, only the ORDER
  // of tests changes whether the dev warning fires). Running the only
  // query-string navigation first keeps this file warning-free without
  // touching the frozen `router.svelte.ts` singleton.
  test('shows the "no workflows match" empty state when a filter is active and nothing matches', async () => {
    resetLocation('/workflows?status=failed');
    fetchScript.routeUrl('/workflows', { items: [], total: 0, offset: 0, limit: 50 });

    const { findByText } = render(WorkflowListHarness, {
      props: { client: realClient(), principal: GRANTED_PRINCIPAL, queryClient: newQueryClient() },
    });

    expect(await findByText('No workflows match')).not.toBeNull();
  });

  test('renders the table once the list query resolves', async () => {
    fetchScript.routeUrl('/workflows', {
      items: [summary()],
      total: 1,
      offset: 0,
      limit: 50,
    });

    const { findByText } = render(WorkflowListHarness, {
      props: { client: realClient(), principal: GRANTED_PRINCIPAL, queryClient: newQueryClient() },
    });

    expect(await findByText('order-processing')).not.toBeNull();
  });

  test('rows across several types issue one active-pointer fetch per distinct type and render the comparison badges (COR-15)', async () => {
    fetchScript.routeUrl('/workflows', {
      items: [
        summary({ id: 'wf_a1', type: 'order-processing', revision: 'rev-current' }),
        summary({ id: 'wf_a2', type: 'order-processing', revision: 'rev-old' }),
        summary({ id: 'wf_b1', type: 'payment-failing', revision: 'rev-pay' }),
        summary({ id: 'wf_b2', type: 'payment-failing', revision: 'rev-pay' }),
        summary({ id: 'wf_legacy', type: 'payment-failing' }),
      ],
      total: 5,
      offset: 0,
      limit: 50,
    });
    fetchScript.routeJsonRpcMethod('weft.workflows.active.get', {
      revision: 'rev-current',
      generation: 1,
      activatedAt: 1,
    });

    const { findAllByText } = render(WorkflowListHarness, {
      props: { client: realClient(), principal: GRANTED_PRINCIPAL, queryClient: newQueryClient() },
    });

    // order-processing: rev-current matches the (shared) scripted pointer,
    // rev-old does not; payment-failing's two pinned rows both differ from
    // it; the legacy row carries no revision and so gets no badge.
    expect(await findAllByText('Differs from active')).toHaveLength(3);
    expect(await findAllByText('Active')).toHaveLength(1);
    const activeCalls = fetchScript.calls.filter(
      (call) => typeof call.init?.body === 'string' && call.init.body.includes('active.get'),
    );
    expect(activeCalls).toHaveLength(2);
  });

  test('filtering from a later page requests and renders the first filtered page', async () => {
    resetLocation('/workflows?offset=50');
    fetchScript.enqueueJson({
      items: [summary({ id: 'wf_later_page', type: 'later-page-workflow' })],
      total: 51,
      offset: 50,
      limit: 50,
    });
    fetchScript.enqueueJson({
      items: [
        summary({ id: 'wf_first_filtered', type: 'first-filtered-workflow', status: 'failed' }),
      ],
      total: 1,
      offset: 0,
      limit: 50,
    });

    const { findByText, getByRole } = render(WorkflowListHarness, {
      props: { client: realClient(), principal: GRANTED_PRINCIPAL, queryClient: newQueryClient() },
    });

    expect(await findByText('later-page-workflow')).not.toBeNull();
    await fireEvent.click(getByRole('button', { name: 'Failed' }));

    expect(await findByText('first-filtered-workflow')).not.toBeNull();
    await waitFor(() => {
      const requestUrl = new URL(fetchScript.calls.at(-1)!.url);
      expect(requestUrl.searchParams.get('offset')).toBe('0');
      expect(requestUrl.searchParams.get('status')).toBe('failed');
    });
  });

  test('shows the "no workflows yet" empty state when the list is empty and no filter is active', async () => {
    fetchScript.routeUrl('/workflows', { items: [], total: 0, offset: 0, limit: 50 });

    const { findByText } = render(WorkflowListHarness, {
      props: { client: realClient(), principal: GRANTED_PRINCIPAL, queryClient: newQueryClient() },
    });

    expect(await findByText('No workflows yet')).not.toBeNull();
  });

  test('shows the denied lock state without workflows:read', async () => {
    const { findByText } = render(WorkflowListHarness, {
      props: {
        client: realClient(),
        principal: { scopes: [], unauthenticatedAccess: null },
        queryClient: newQueryClient(),
      },
    });

    expect(await findByText('Access restricted')).not.toBeNull();
  });

  test('shows a fault banner when the list request fails', async () => {
    fetchScript.routeUrlStatus('/workflows', 500);

    const { findByText } = render(WorkflowListHarness, {
      props: { client: realClient(), principal: GRANTED_PRINCIPAL, queryClient: newQueryClient() },
    });

    expect(await findByText('Something went wrong')).not.toBeNull();
  });
});
