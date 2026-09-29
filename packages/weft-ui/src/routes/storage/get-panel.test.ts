/**
 * Component tests for `<GetPanel>` (plan §9.6, Appendix B "get … not
 * found/loading/fault states").
 */
import { fireEvent, render } from '@testing-library/svelte';
import { afterEach, describe, expect, test } from 'bun:test';
import type { StorageConnection } from './storage-client.ts';

import GetPanelHarness from './get-panel-test-harness.test-harness.svelte';
import { stubStorageFetch } from './storage-fetch-stub.test-support.ts';

function fakeClient(): StorageConnection {
  return { baseUrl: 'http://localhost:7233', headers: {} };
}

let activeStub: { restore: () => void } | undefined;

afterEach(() => {
  activeStub?.restore();
  activeStub = undefined;
});

describe('GetPanel', () => {
  test('shows a prompt before any lookup', async () => {
    const { getByText } = render(GetPanelHarness, { props: { client: fakeClient() } });

    expect(getByText('Enter a key')).not.toBeNull();
  });

  test('shows the value when the key is found', async () => {
    activeStub = stubStorageFetch(
      () => new Response(new TextEncoder().encode('{"owner":"ops"}'), { status: 200 }),
    );

    const { getByLabelText, getByText, findByText } = render(GetPanelHarness, {
      props: { client: fakeClient() },
    });

    await fireEvent.input(getByLabelText('Exact key'), { target: { value: 'app:config' } });
    await fireEvent.click(getByText('Get'));

    expect(await findByText('"ops"')).not.toBeNull();
  });

  test('shows a not-found empty state for a missing key', async () => {
    activeStub = stubStorageFetch(() => new Response(null, { status: 404 }));

    const { getByLabelText, getByText, findByText } = render(GetPanelHarness, {
      props: { client: fakeClient() },
    });

    await fireEvent.input(getByLabelText('Exact key'), { target: { value: 'app:missing' } });
    await fireEvent.click(getByText('Get'));

    expect(await findByText('Key not found')).not.toBeNull();
  });

  test('shows the fault message when the lookup is forbidden', async () => {
    activeStub = stubStorageFetch(
      () =>
        new Response(JSON.stringify({ error: 'Raw storage access requires storage:admin.' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }),
    );

    const { getByLabelText, getByText, findByText } = render(GetPanelHarness, {
      props: { client: fakeClient() },
    });

    await fireEvent.input(getByLabelText('Exact key'), { target: { value: 'app:x' } });
    await fireEvent.click(getByText('Get'));

    expect(await findByText('Raw storage access requires storage:admin.')).not.toBeNull();
  });
});
