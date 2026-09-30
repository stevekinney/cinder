import { render, waitFor } from '@testing-library/svelte';
import { describe, expect, test } from 'bun:test';

import { HttpClientError } from '@lostgradient/weft';
import { QueryClient } from '@tanstack/svelte-query';

import { distinctWorkflowTypes } from './active-revision-comparisons.svelte.ts';
import Harness from './active-revision-comparisons.test-harness.svelte';
import { queryKeys } from './query.ts';

function newQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

/** A `weft.workflows.active.get` fake that records every requested name and answers from `activeByName` (missing name faults NotFound). */
function activeClient(activeByName: Record<string, string>) {
  const requested: string[] = [];
  return {
    requested,
    client: {
      operations: {
        'weft.workflows.active.get': async (input: { name: string }) => {
          requested.push(input.name);
          const revision = activeByName[input.name];
          if (revision === undefined) {
            throw new HttpClientError(404, 'not found', { faultCode: 'NotFound' });
          }
          return { revision, generation: 1, activatedAt: 1 };
        },
      },
    },
  };
}

describe('distinctWorkflowTypes', () => {
  test('drops duplicates and blanks, preserving first-seen order', () => {
    expect(distinctWorkflowTypes(['b', 'a', 'b', '', 'a', 'c'])).toEqual(['b', 'a', 'c']);
  });
});

describe('createActiveRevisionComparisons', () => {
  test('N rows across M distinct types issue exactly M active-pointer fetches, and each row is classified against its own type', async () => {
    const { client, requested } = activeClient({ alpha: 'rev-a', beta: 'rev-b' });

    const { getByTestId } = render(Harness, {
      props: {
        client,
        queryClient: newQueryClient(),
        rows: [
          { type: 'alpha', revision: 'rev-a' },
          { type: 'alpha', revision: 'rev-old' },
          { type: 'beta', revision: 'rev-b' },
          { type: 'alpha', revision: undefined },
          { type: 'beta', revision: 'rev-old' },
        ],
      },
    });

    await waitFor(() => expect(getByTestId('row-0').textContent).toBe('active'));
    expect(getByTestId('row-1').textContent).toBe('stale');
    expect(getByTestId('row-2').textContent).toBe('active');
    expect(getByTestId('row-3').textContent).toBe('unpinned');
    expect(getByTestId('row-4').textContent).toBe('stale');
    expect([...requested].sort()).toEqual(['alpha', 'beta']);
  });

  test('shares queryKeys.catalog.active(type) with the existing consumers: the fetched pointer lands in that cache entry, and invalidating it (as the System panels do on activation) re-classifies the rows', async () => {
    const active = { alpha: 'rev-a' };
    const { client, requested } = activeClient(active);
    const queryClient = newQueryClient();

    const { getByTestId } = render(Harness, {
      props: { client, queryClient, rows: [{ type: 'alpha', revision: 'rev-b' }] },
    });

    await waitFor(() => expect(getByTestId('row-0').textContent).toBe('stale'));
    expect(queryClient.getQueryData<unknown>(queryKeys.catalog.active('alpha'))).toEqual({
      revision: 'rev-a',
      generation: 1,
      activatedAt: 1,
    });

    active.alpha = 'rev-b';
    await queryClient.invalidateQueries({ queryKey: queryKeys.catalog.active('alpha') });
    await waitFor(() => expect(getByTestId('row-0').textContent).toBe('active'));
    expect(requested).toEqual(['alpha', 'alpha']);
  });

  test('a pointer another consumer is already fetching under the same key is not fetched twice', async () => {
    const { client, requested } = activeClient({ alpha: 'rev-a' });
    const queryClient = newQueryClient();
    const existingConsumer = queryClient.fetchQuery({
      queryKey: queryKeys.catalog.active('alpha'),
      queryFn: async () => {
        const pointer = await client.operations['weft.workflows.active.get']({ name: 'alpha' });
        return pointer;
      },
    });

    const { getByTestId } = render(Harness, {
      props: { client, queryClient, rows: [{ type: 'alpha', revision: 'rev-a' }] },
    });

    await existingConsumer;
    await waitFor(() => expect(getByTestId('row-0').textContent).toBe('active'));
    expect(requested).toEqual(['alpha']);
  });

  test('a never-activated type (NotFound) reads as unknown', async () => {
    const missing = activeClient({});
    const { getByTestId } = render(Harness, {
      props: {
        client: missing.client,
        queryClient: newQueryClient(),
        rows: [{ type: 'ghost', revision: 'rev-x' }],
      },
    });
    await waitFor(() => expect(missing.requested).toEqual(['ghost']));
    expect(getByTestId('row-0').textContent).toBe('unknown');
  });

  test('a disabled gate reads as unknown and fetches nothing', () => {
    const denied = activeClient({ alpha: 'rev-a' });
    const { getByTestId } = render(Harness, {
      props: {
        client: denied.client,
        queryClient: newQueryClient(),
        rows: [{ type: 'alpha', revision: 'rev-a' }],
        enabled: false,
      },
    });
    expect(getByTestId('row-0').textContent).toBe('unknown');
    expect(denied.requested).toEqual([]);
  });

  test('rows without a persisted revision fetch nothing', () => {
    const idle = activeClient({ alpha: 'rev-a' });
    const { getByTestId } = render(Harness, {
      props: {
        client: idle.client,
        queryClient: newQueryClient(),
        rows: [{ type: 'alpha', revision: undefined }],
      },
    });
    expect(getByTestId('row-0').textContent).toBe('unpinned');
    expect(idle.requested).toEqual([]);
  });

  test('a failed lookup reads as unknown rather than reusing stale data', async () => {
    let attempts = 0;
    const client = {
      operations: {
        'weft.workflows.active.get': async () => {
          attempts += 1;
          throw new HttpClientError(403, 'forbidden', { faultCode: 'Forbidden' });
        },
      },
    };
    const { getByTestId } = render(Harness, {
      props: {
        client,
        queryClient: newQueryClient(),
        rows: [{ type: 'alpha', revision: 'rev-a' }],
      },
    });
    await waitFor(() => expect(attempts).toBe(1));
    expect(getByTestId('row-0').textContent).toBe('unknown');
  });
});
