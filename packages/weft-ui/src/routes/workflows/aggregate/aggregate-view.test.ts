import { requireElement } from '../../../../tests/dom-test-support.ts';

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Window, type DetachedWindowAPI } from 'happy-dom';

import { QueryClient } from '@tanstack/svelte-query';
import { within } from '@testing-library/dom';
import { render } from '@testing-library/svelte';

import { router } from '../../../lib/router.svelte.ts';
import type { Principal } from '../../../lib/scopes.svelte.ts';
import { realClient, ScriptedFetch } from '../list/workflow-test-support.test-support.ts';
import AggregateViewHarness from './aggregate-view.test-harness.svelte';

const GRANTED_PRINCIPAL: Principal = {
  scopes: ['workflows:read'],
  unauthenticatedAccess: null,
};

function happyDomAPI(): DetachedWindowAPI {
  if (!(window instanceof Window)) {
    throw new Error('expected the test window to be backed by happy-dom');
  }
  return window.happyDOM;
}

function resetLocation(path = '/workflows?view=aggregate'): void {
  happyDomAPI().setURL('http://localhost/');
  router.navigate(path, { replace: true });
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

describe('AggregateView', () => {
  test('renders a group row per aggregate group, defaulting to status', async () => {
    fetchScript.routeJsonRpcMethod('weft.workflows.aggregate', {
      total: 23,
      truncated: false,
      groups: [
        { key: 'failed', count: 14 },
        { key: 'running', count: 9 },
      ],
    });

    const { container, findByText } = render(AggregateViewHarness, {
      props: { client: realClient(), principal: GRANTED_PRINCIPAL, queryClient: newQueryClient() },
    });

    expect(await findByText('23 total')).not.toBeNull();
    // Scoped to this view's own group table — `BarChart` renders its own
    // hidden accessible data-table summary with the same group labels
    // (`.cinder-sr-only`), so an unscoped `findByText('failed')` matches
    // more than one element.
    const table = container.querySelector('.weft-aggregate-view__table');
    if (!table) throw new Error('expected the group table to be present');
    expect(within(requireElement(table, HTMLElement)).getByText('failed')).not.toBeNull();
    expect(within(requireElement(table, HTMLElement)).getByText('running')).not.toBeNull();
  });

  test('a group row links to the pre-filtered workflow list', async () => {
    fetchScript.routeJsonRpcMethod('weft.workflows.aggregate', {
      total: 14,
      truncated: false,
      groups: [{ key: 'failed', count: 14 }],
    });

    const { findByRole } = render(AggregateViewHarness, {
      props: { client: realClient(), principal: GRANTED_PRINCIPAL, queryClient: newQueryClient() },
    });

    const link = await findByRole('link', { name: 'failed' });
    expect(link.getAttribute('href')).toBe('/workflows?status=failed');
  });

  test('the "(none)" bucket (null key) renders without a drill-through link', async () => {
    fetchScript.routeJsonRpcMethod('weft.workflows.aggregate', {
      total: 3,
      truncated: false,
      groups: [{ key: null, count: 3 }],
    });

    const { container, findByText, queryByRole } = render(AggregateViewHarness, {
      props: { client: realClient(), principal: GRANTED_PRINCIPAL, queryClient: newQueryClient() },
    });

    await findByText('3 total');
    const table = container.querySelector('.weft-aggregate-view__table');
    if (!table) throw new Error('expected the group table to be present');
    expect(within(requireElement(table, HTMLElement)).getByText('(none)')).not.toBeNull();
    expect(queryByRole('link', { name: '(none)' })).toBeNull();
  });

  test('shows the empty state when no groups match', async () => {
    fetchScript.routeJsonRpcMethod('weft.workflows.aggregate', {
      total: 0,
      truncated: false,
      groups: [],
    });

    const { findByText } = render(AggregateViewHarness, {
      props: { client: realClient(), principal: GRANTED_PRINCIPAL, queryClient: newQueryClient() },
    });

    expect(await findByText('No data to aggregate')).not.toBeNull();
  });

  test('shows the denied lock state without workflows:read', async () => {
    const { findByText } = render(AggregateViewHarness, {
      props: {
        client: realClient(),
        principal: { scopes: [], unauthenticatedAccess: null },
        queryClient: newQueryClient(),
      },
    });

    expect(await findByText('Access restricted')).not.toBeNull();
  });

  test('shows a fault banner for the 100k-distinct-keys guard (Unprocessable)', async () => {
    fetchScript.routeJsonRpcMethodUnprocessable(
      'weft.workflows.aggregate',
      'Aggregate exceeded the distinct-key cap',
    );

    const { findByText } = render(AggregateViewHarness, {
      props: { client: realClient(), principal: GRANTED_PRINCIPAL, queryClient: newQueryClient() },
    });

    expect(await findByText('Invalid input')).not.toBeNull();
  });
});
