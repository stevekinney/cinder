/**
 * Component tests for `<DeletePanel>` (plan §9.6, §10.6: Tier-2
 * `ConfirmDialog` on deletes; reserved-prefix inline warning), modeled on
 * `put-panel.test.ts`'s coverage of the same destructive-write-confirmation
 * shape.
 */
import { fireEvent, render } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { StorageConnection } from './storage-client.ts';

import ToastHost from '../../app/toast-host.svelte';
import DeletePanelHarness from './delete-panel-test-harness.test-harness.svelte';
import { stubStorageFetch, type StubbedFetchCall } from './storage-fetch-stub.test-support.ts';

function fakeClient(): StorageConnection {
  return { baseUrl: 'http://localhost:7233', headers: {} };
}

let activeStub: { calls: StubbedFetchCall[]; restore: () => void } | undefined;

afterEach(() => {
  activeStub?.restore();
  activeStub = undefined;
});

describe('DeletePanel', () => {
  beforeEach(() => {
    render(ToastHost);
  });

  test('does not delete until the confirm dialog is accepted', async () => {
    activeStub = stubStorageFetch(() => new Response(null, { status: 204 }));

    const { getByLabelText, getByText, findByRole } = render(DeletePanelHarness, {
      props: { client: fakeClient() },
    });

    await fireEvent.input(getByLabelText('Key'), { target: { value: 'app:config' } });
    await fireEvent.click(getByText('Delete · confirm'));

    const dialog = await findByRole('dialog');
    expect(dialog).not.toBeNull();
    expect(activeStub.calls).toHaveLength(0);
  });

  test('deletes after the confirm dialog is accepted', async () => {
    activeStub = stubStorageFetch(() => new Response(null, { status: 204 }));

    const { getByLabelText, getByText, findByRole } = render(DeletePanelHarness, {
      props: { client: fakeClient() },
    });

    await fireEvent.input(getByLabelText('Key'), { target: { value: 'app:config' } });
    await fireEvent.click(getByText('Delete · confirm'));
    await findByRole('dialog');
    await fireEvent.click(getByText('Delete'));

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(activeStub.calls).toHaveLength(1);
    expect(activeStub.calls[0]?.method).toBe('DELETE');
    expect(activeStub.calls[0]?.url).toContain('/v1/storage/app%3Aconfig');
  });

  test('shows the reserved-prefix warning when the key matches a Weft-owned prefix', async () => {
    const { getByLabelText, findByText, queryByText } = render(DeletePanelHarness, {
      props: { client: fakeClient() },
    });

    expect(queryByText(/reserved prefix/)).toBeNull();

    await fireEvent.input(getByLabelText('Key'), { target: { value: 'wf:my-workflow' } });

    expect(await findByText(/reserved prefix/)).not.toBeNull();
  });

  test('shows the fault message when the delete fails', async () => {
    activeStub = stubStorageFetch(
      () =>
        new Response(JSON.stringify({ error: 'Raw storage access requires storage:admin.' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }),
    );

    const { getByLabelText, getByText, findByRole, findByText } = render(DeletePanelHarness, {
      props: { client: fakeClient() },
    });

    await fireEvent.input(getByLabelText('Key'), { target: { value: 'app:x' } });
    await fireEvent.click(getByText('Delete · confirm'));
    await findByRole('dialog');
    await fireEvent.click(getByText('Delete'));

    expect(await findByText('Raw storage access requires storage:admin.')).not.toBeNull();
  });
});
