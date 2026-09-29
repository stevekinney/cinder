/**
 * Tests for the `QueryClient` factory + query-key helpers (plan §4, §11.1,
 * T1.5). `queryKeys` and the retry policy are pure logic, no DOM. The
 * mutation `onError → showFault` wiring is exercised against a real rendered
 * `<ToastHost>` rather than a mock, matching this repo's "no mock server, no
 * fixture drift" bias — it's the one piece of this module that only proves
 * anything when checked against Cinder's real toast DOM.
 */
import { render } from '@testing-library/svelte';
import { describe, expect, test } from 'bun:test';

import { HttpClientError } from '@lostgradient/weft';

import { keepPreviousData } from '@tanstack/svelte-query';

import { createQueryClient, queryKeys } from './query.ts';

describe('queryKeys — plan §4 list, verbatim', () => {
  test('workflows.list', () => {
    const filter = { status: 'running' as const };
    expect(queryKeys.workflows.list(filter)).toEqual(['workflows', 'list', filter]);
  });

  test('workflows.detail', () => {
    expect(queryKeys.workflows.detail('wf-1')).toEqual(['workflows', 'detail', 'wf-1']);
  });

  test('workflows.events (with and without a cursor)', () => {
    expect(queryKeys.workflows.events('wf-1', 'cursor-1')).toEqual([
      'workflows',
      'events',
      'wf-1',
      'cursor-1',
    ]);
    expect(queryKeys.workflows.events('wf-1')).toEqual(['workflows', 'events', 'wf-1', undefined]);
  });

  test('workflows.aggregate', () => {
    const filter = { tags: ['nightly'] };
    expect(queryKeys.workflows.aggregate('status', filter)).toEqual([
      'workflows',
      'aggregate',
      'status',
      filter,
    ]);
  });

  test('schedules.list', () => {
    const filter = { status: 'active' as const };
    expect(queryKeys.schedules.list(filter)).toEqual(['schedules', 'list', filter]);
  });

  test('workers.list', () => {
    expect(queryKeys.workers.list()).toEqual(['workers', 'list']);
  });

  test('workers.manifests', () => {
    const workerIds = ['worker-a', 'worker-b'];
    expect(queryKeys.workers.manifests(workerIds)).toEqual(['workers', 'manifests', workerIds]);
  });

  test('workers.manifest', () => {
    expect(queryKeys.workers.manifest('worker-a')).toEqual(['workers', 'manifest', 'worker-a']);
  });

  test('workers.rejections', () => {
    expect(queryKeys.workers.rejections()).toEqual(['workers', 'rejections']);
  });

  test('queues.list', () => {
    expect(queryKeys.queues.list()).toEqual(['queues', 'list']);
  });

  test('diagnostics', () => {
    expect(queryKeys.diagnostics()).toEqual(['diagnostics']);
  });

  test('reviews.list', () => {
    const filter = { status: 'completed' as const };
    expect(queryKeys.reviews.list(filter)).toEqual(['reviews', 'list', filter]);
  });

  test('registry', () => {
    expect(queryKeys.registry()).toEqual(['registry']);
  });

  test('retention', () => {
    expect(queryKeys.retention()).toEqual(['retention']);
  });

  test('metrics', () => {
    expect(queryKeys.metrics()).toEqual(['metrics']);
  });

  test('principal', () => {
    expect(queryKeys.principal()).toEqual(['principal']);
  });

  test('catalog source list and exact diagnostics keys', () => {
    expect(queryKeys.catalog.sources({ limit: 10, offset: 20 })).toEqual([
      'catalog',
      'sources',
      { limit: 10, offset: 20 },
    ]);
    expect(queryKeys.catalog.diagnostics('invoice-reconciliation', 'line\r\nrevision')).toEqual([
      'catalog',
      'diagnostics',
      'invoice-reconciliation',
      'line\r\nrevision',
    ]);
  });
});

/** Pulls the configured `queries.retry` predicate out, typed as a callable — `RetryValue` also allows `boolean | number`, which this factory never uses. */
function retryPredicate() {
  const retry = createQueryClient().getDefaultOptions().queries?.retry;
  if (typeof retry !== 'function') {
    throw new Error('expected createQueryClient() to configure a retry function');
  }
  return retry;
}

describe('createQueryClient — retry policy never retries a 4xx-shaped fault', () => {
  const shouldRetry = retryPredicate();

  test.each([
    ['not-found', new HttpClientError(404, 'x', { faultCode: 'NotFound' })],
    ['conflict', new HttpClientError(409, 'x', { faultCode: 'Conflict' })],
    ['invalid', new HttpClientError(400, 'x', { faultCode: 'InvalidParams' })],
    ['unauthorized (401)', new HttpClientError(401, 'x', { faultCode: 'Unauthorized' })],
    ['unauthorized (403)', new HttpClientError(403, 'x', { faultCode: 'Forbidden' })],
    ['not-supported', new HttpClientError(501, 'x', { faultCode: 'NotImplemented' })],
  ] as const)('never retries %s, even on the first failure', (_label, error) => {
    expect(shouldRetry(0, error)).toBe(false);
  });

  test('retries an internal fault (masked or not) up to the cap', () => {
    const error = new HttpClientError(500, 'Internal server error');
    expect(shouldRetry(0, error)).toBe(true);
    expect(shouldRetry(1, error)).toBe(true);
    expect(shouldRetry(2, error)).toBe(true);
    expect(shouldRetry(3, error)).toBe(false);
  });

  test('retries a Timeout FaultCode despite its 4xx-shaped HTTP status (transient by nature — see faults.ts)', () => {
    const error = new HttpClientError(408, 'x', { faultCode: 'Timeout' });
    expect(shouldRetry(0, error)).toBe(true);
  });

  test('retries an error that never crossed the Weft fault wire (network failure)', () => {
    expect(shouldRetry(0, new TypeError('Failed to fetch'))).toBe(true);
  });

  test('stops retrying once the cap is reached regardless of fault kind', () => {
    expect(shouldRetry(3, new TypeError('Failed to fetch'))).toBe(false);
  });
});

describe('createQueryClient — keepPreviousData on paginated/filtered lists only', () => {
  test('workflows.list, schedules.list, and reviews.list keep the previous page while refetching', () => {
    const client = createQueryClient();
    expect(client.getQueryDefaults(['workflows', 'list']).placeholderData).toBe(keepPreviousData);
    expect(client.getQueryDefaults(['schedules', 'list']).placeholderData).toBe(keepPreviousData);
    expect(client.getQueryDefaults(['reviews', 'list']).placeholderData).toBe(keepPreviousData);
    expect(client.getQueryDefaults(['catalog', 'sources']).placeholderData).toBe(keepPreviousData);
  });

  test('unparameterized single-resource keys are left alone', () => {
    const client = createQueryClient();
    expect(client.getQueryDefaults(['workers', 'list']).placeholderData).toBeUndefined();
    expect(client.getQueryDefaults(['queues', 'list']).placeholderData).toBeUndefined();
    expect(client.getQueryDefaults(['registry']).placeholderData).toBeUndefined();
  });
});

describe('createQueryClient — mutation error reports a toast via the fault mapping', () => {
  test('a mutation failure shows a toast built from the classified treatment', async () => {
    const toastHostModule = await import('../app/toast-host.svelte');
    const ToastHost = toastHostModule.default;
    const { findByText } = render(ToastHost);

    const client = createQueryClient();
    const onError = client.getDefaultOptions().mutations?.onError;
    if (!onError) throw new Error('expected createQueryClient() to configure mutations.onError');

    const error = new HttpClientError(404, 'workflow wf-1 not found', { faultCode: 'NotFound' });
    // `onError`'s full signature takes (error, variables, onMutateResult, context);
    // the factory's implementation only reads `error`.
    onError(error, undefined, undefined, { client, meta: undefined });

    expect(await findByText('Not found: workflow wf-1 not found')).not.toBeNull();
  });
});
