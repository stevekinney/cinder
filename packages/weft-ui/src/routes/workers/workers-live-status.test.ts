import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte';
import { afterEach, expect, spyOn, test } from 'bun:test';

import { installFetchImplementation } from '../../lib/live-source/fetch-test-support.ts';
import { createQueryClient, queryKeys } from '../../lib/query.ts';
import type { AuthorizationScope } from '../../lib/scopes.svelte.ts';
import WorkersLiveStatus from './workers-live-status.svelte';
import WorkersRouteTestHarness from './workers-route-test-harness.test-harness.svelte';
import { realClient } from './workers-route-test-support.test-support.ts';

class WorkerEventStream {
  requests = 0;
  aborts = 0;
  #controller: ReadableStreamDefaultController<Uint8Array> | undefined;
  #sequence = 0;
  readonly restore = installFetchImplementation((_request, options) => {
    this.requests += 1;
    const body = new ReadableStream<Uint8Array>({
      start: (controller) => {
        this.#controller = controller;
        options?.signal?.addEventListener(
          'abort',
          () => {
            this.aborts += 1;
            controller.close();
          },
          { once: true },
        );
      },
    });
    return Promise.resolve(
      new Response(body, {
        headers: { 'Content-Type': 'text/event-stream' },
      }),
    );
  });

  send(kind: string): void {
    if (this.#controller === undefined) throw new Error('The fleet stream is not connected.');
    const sequence = ++this.#sequence;
    const envelope = { kind, sequence, cursor: String(sequence), emittedAtMs: 0, payload: {} };
    this.#controller.enqueue(
      new TextEncoder().encode(
        `id: ${sequence}\nevent: ${kind}\ndata: ${JSON.stringify(envelope)}\n\n`,
      ),
    );
  }
}

let events: WorkerEventStream | undefined;
const queryClients = new Set<ReturnType<typeof createQueryClient>>();

afterEach(() => {
  cleanup();
  events?.restore();
  events = undefined;
  for (const queryClient of queryClients) queryClient.clear();
  queryClients.clear();
});

function renderLiveStatus(
  principalScopes: readonly AuthorizationScope[] = ['system:read', 'events:read'],
) {
  const queryClient = createQueryClient();
  queryClients.add(queryClient);
  events = new WorkerEventStream();
  const view = render(WorkersRouteTestHarness, {
    client: realClient(),
    queryClient,
    component: WorkersLiveStatus,
    principalScopes,
  });
  return { ...view, queryClient, events };
}

test('defaults to polling without opening the shared fleet connection', () => {
  const view = renderLiveStatus();
  expect(view.getByRole('switch', { name: 'Live' })).toHaveAttribute('aria-checked', 'false');
  expect(view.getByText('Updated every 30s')).toBeVisible();
  expect(view.events.requests).toBe(0);
});

test('requires events:read before enabling the live subscription', async () => {
  const view = renderLiveStatus(['system:read']);
  const toggle = view.getByRole('switch', { name: 'Live' });
  expect(toggle).toBeDisabled();
  await fireEvent.click(toggle);
  expect(toggle).toHaveAttribute('aria-checked', 'false');
  expect(view.events.requests).toBe(0);
});

test('worker liveness events invalidate all five surfaces and disabling Live releases the connection', async () => {
  const view = renderLiveStatus();
  const invalidate = spyOn(view.queryClient, 'invalidateQueries');
  const toggle = view.getByRole('switch', { name: 'Live' });
  await fireEvent.click(toggle);
  await waitFor(() => expect(view.events.requests).toBe(1));

  view.events.send('workflow:completed');
  view.events.send('worker:connected');
  await waitFor(() => expect(invalidate).toHaveBeenCalledTimes(5));
  expect(invalidate.mock.calls.map(([filters]) => filters?.queryKey)).toEqual([
    queryKeys.workers.list(),
    queryKeys.queues.list(),
    queryKeys.diagnostics(),
    ['workers', 'manifests'],
    queryKeys.workers.rejections(),
  ]);
  view.events.send('worker:disconnected');
  await waitFor(() => expect(invalidate).toHaveBeenCalledTimes(10));
  await fireEvent.click(toggle);
  await waitFor(() => expect(view.events.aborts).toBe(1));
  expect(view.events.requests).toBe(1);
  expect(view.getByText('Updated every 30s')).toBeVisible();
});

test('unmounting releases an active subscription', async () => {
  const view = renderLiveStatus();
  await fireEvent.click(view.getByRole('switch', { name: 'Live' }));
  await waitFor(() => expect(view.events.requests).toBe(1));
  view.unmount();
  await waitFor(() => expect(view.events.aborts).toBe(1));
});
