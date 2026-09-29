import { requireElement } from '../../../tests/dom-test-support.ts';

/**
 * Component tests for the Storage route (plan §9.6, Appendix B "denied
 * lock-states"): the `storage:admin` scope gate.
 */
import { HttpClient } from '@lostgradient/weft';
import { fireEvent, render, within } from '@testing-library/svelte';
import { afterEach, describe, expect, test } from 'bun:test';

import { stubStorageFetch } from './storage-fetch-stub.test-support.ts';
import StorageRouteHarness from './storage-route-test-harness.test-harness.svelte';

function fakeClient(): HttpClient {
  return new HttpClient({ baseUrl: 'http://localhost:7233' });
}

let activeStub: { restore: () => void } | undefined;

afterEach(() => {
  activeStub?.restore();
  activeStub = undefined;
});

describe('Storage route', () => {
  test('shows a lock state naming the required scope when storage:admin is not granted', async () => {
    const { getByText, queryByRole } = render(StorageRouteHarness, {
      props: { client: fakeClient(), scopes: [] },
    });

    expect(getByText('Storage access requires storage:admin')).not.toBeNull();
    expect(getByText('Requires storage:admin')).not.toBeNull();
    // The KV browser tabs never mount when the scope is missing.
    expect(queryByRole('tablist')).toBeNull();
  });

  test('renders the KV browser / Capabilities tabs when storage:admin is granted', async () => {
    activeStub = stubStorageFetch(
      () => new Response(JSON.stringify({ applied: true }), { status: 200 }),
    );

    const { getByText, queryByText } = render(StorageRouteHarness, {
      props: { client: fakeClient() },
    });

    expect(getByText('KV browser')).not.toBeNull();
    expect(getByText('Capabilities')).not.toBeNull();
    expect(queryByText('Storage access requires storage:admin')).toBeNull();
  });

  test('shows the reserved-prefix awareness banner when unlocked', async () => {
    activeStub = stubStorageFetch(
      () => new Response(JSON.stringify({ applied: true }), { status: 200 }),
    );

    const { getByText } = render(StorageRouteHarness, { props: { client: fakeClient() } });

    expect(getByText(/used internally by the/)).not.toBeNull();
  });

  test('switches to the Capabilities tab and renders the conditional-batch probe result', async () => {
    activeStub = stubStorageFetch(
      () => new Response(JSON.stringify({ applied: true }), { status: 200 }),
    );

    const { getByText, findByText } = render(StorageRouteHarness, {
      props: { client: fakeClient() },
    });

    await fireEvent.click(getByText('Capabilities'));

    expect(await findByText('Batch operations')).not.toBeNull();
    // The Batch operations row always renders its own "supported" badge, so
    // an unscoped `findByText('supported')` would match it regardless of
    // whether the conditional-batch probe ever resolved — scope to the
    // Conditional batch row specifically (flagged in WFC-10 PR #14 review).
    const conditionalBatchTerm = await findByText('Conditional batch');
    const conditionalBatchRow = conditionalBatchTerm.closest('.cinder-description-list__row');
    if (!conditionalBatchRow) throw new Error('Conditional batch row not found');
    expect(
      await within(requireElement(conditionalBatchRow, HTMLElement)).findByText('supported'),
    ).not.toBeNull();
  });

  test('passes an undefined conditional-batch result through while the probe is pending or fails', async () => {
    activeStub = stubStorageFetch(
      () =>
        new Response(JSON.stringify({ error: 'boom' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }),
    );

    const { getByText, findByText } = render(StorageRouteHarness, {
      props: { client: fakeClient() },
    });

    await fireEvent.click(getByText('Capabilities'));

    expect(await findByText('checking…')).not.toBeNull();
  });
});
