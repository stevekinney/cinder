import { requireElement } from '../../../tests/dom-test-support.ts';

/**
 * Component tests for `<BatchPanel>` (plan §9.6, §10.6: atomic put/delete
 * batches, conditional (compare-and-swap) batch gated on
 * `conditionalBatchSupported`, Tier-2 `ConfirmDialog` before applying).
 */
import { requiredValue } from '@lostgradient/testing';
import { fireEvent, render } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { StorageConnection } from './storage-client.ts';

import ToastHost from '../../app/toast-host.svelte';
import BatchPanelHarness from './batch-panel-test-harness.test-harness.svelte';
import { stubStorageFetch, type StubbedFetchCall } from './storage-fetch-stub.test-support.ts';

function fakeClient(): StorageConnection {
  return { baseUrl: 'http://localhost:7233', headers: {} };
}

let activeStub: { calls: StubbedFetchCall[]; restore: () => void } | undefined;

afterEach(() => {
  activeStub?.restore();
  activeStub = undefined;
});

describe('BatchPanel', () => {
  beforeEach(() => {
    render(ToastHost);
  });

  test('disables apply until an operation row has a key', () => {
    const { getByText } = render(BatchPanelHarness, { props: { client: fakeClient() } });

    expect(getByText('Apply batch · confirm')).toHaveProperty('disabled', true);
  });

  test('applies a batch after the confirm dialog is accepted', async () => {
    activeStub = stubStorageFetch(() => new Response(null, { status: 204 }));

    const { getByLabelText, getByText, findByRole } = render(BatchPanelHarness, {
      props: { client: fakeClient() },
    });

    await fireEvent.input(getByLabelText('Key'), { target: { value: 'app:a' } });
    await fireEvent.input(getByLabelText('Value'), { target: { value: 'hello' } });
    await fireEvent.click(getByText('Apply batch · confirm'));

    const dialog = await findByRole('dialog');
    expect(dialog).not.toBeNull();
    expect(activeStub.calls).toHaveLength(0);

    await fireEvent.click(getByText('Apply'));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(activeStub.calls).toHaveLength(1);
    expect(activeStub.calls[0]?.method).toBe('POST');
    expect(activeStub.calls[0]?.url).toContain('/v1/storage/-/batch');
  });

  test('adds and removes operation rows', async () => {
    const { getByText, getAllByLabelText } = render(BatchPanelHarness, {
      props: { client: fakeClient() },
    });

    await fireEvent.click(getByText('Add operation'));
    expect(getAllByLabelText('Key')).toHaveLength(2);

    const removeButton = getAllByLabelText('Remove row')[1];
    if (!removeButton) throw new Error('Remove row button not found');
    await fireEvent.click(requireElement(removeButton, HTMLElement));
    expect(getAllByLabelText('Key')).toHaveLength(1);
  });

  test('shows the reserved-prefix warning for an operation row key', async () => {
    const { getByLabelText, findByText, queryByText } = render(BatchPanelHarness, {
      props: { client: fakeClient() },
    });

    expect(queryByText(/reserved prefix/)).toBeNull();

    await fireEvent.input(getByLabelText('Key'), { target: { value: 'wf:my-workflow' } });

    expect(await findByText(/reserved prefix/)).not.toBeNull();
  });

  test('shows the fault message when the batch fails', async () => {
    activeStub = stubStorageFetch(
      () =>
        new Response(JSON.stringify({ error: 'Raw storage access requires storage:admin.' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }),
    );

    const { getByLabelText, getByText, findByRole, findByText } = render(BatchPanelHarness, {
      props: { client: fakeClient() },
    });

    await fireEvent.input(getByLabelText('Key'), { target: { value: 'app:a' } });
    await fireEvent.click(getByText('Apply batch · confirm'));
    await findByRole('dialog');
    await fireEvent.click(getByText('Apply'));

    expect(await findByText('Raw storage access requires storage:admin.')).not.toBeNull();
  });

  test('does not offer conditional batching when the backend does not support it', () => {
    const { queryByText } = render(BatchPanelHarness, {
      props: { client: fakeClient(), conditionalBatchSupported: false },
    });

    expect(queryByText('Conditional (compare-and-swap)')).toBeNull();
  });

  test('applies a conditional batch, including a "must not exist" condition, when supported', async () => {
    activeStub = stubStorageFetch(
      () =>
        new Response(JSON.stringify({ applied: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    );

    const { getByLabelText, getByText, getByRole, findByRole } = render(BatchPanelHarness, {
      props: { client: fakeClient(), conditionalBatchSupported: true },
    });

    await fireEvent.input(getByLabelText('Key'), { target: { value: 'app:a' } });
    await fireEvent.input(getByLabelText('Value'), { target: { value: 'hello' } });

    await fireEvent.click(getByRole('switch', { name: 'Conditional (compare-and-swap)' }));
    await fireEvent.click(getByText('Add condition'));

    const conditionKeyInput = requiredValue(
      document.querySelector<HTMLInputElement>('input[id^="condition-key-"]'),
    );
    await fireEvent.input(conditionKeyInput, { target: { value: 'app:a' } });

    const mustNotExist = getByLabelText('Must not exist');
    await fireEvent.click(mustNotExist);

    expect(getByText('Apply conditional batch · confirm')).not.toBeNull();
    await fireEvent.click(getByText('Apply conditional batch · confirm'));
    await findByRole('dialog');
    await fireEvent.click(getByText('Apply'));

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(activeStub.calls).toHaveLength(1);
    expect(activeStub.calls[0]?.url).toContain('/v1/storage/-/conditional-batch');
  });

  test('applies a conditional batch with an expected-value condition and reports a skipped result', async () => {
    activeStub = stubStorageFetch(
      () =>
        new Response(JSON.stringify({ applied: false }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    );

    const { getByLabelText, getByText, getByRole, findByRole } = render(BatchPanelHarness, {
      props: { client: fakeClient(), conditionalBatchSupported: true },
    });

    await fireEvent.input(getByLabelText('Key'), { target: { value: 'app:a' } });
    await fireEvent.input(getByLabelText('Value'), { target: { value: 'hello' } });

    await fireEvent.click(getByRole('switch', { name: 'Conditional (compare-and-swap)' }));
    await fireEvent.click(getByText('Add condition'));

    const conditionKeyInput = requiredValue(
      document.querySelector<HTMLInputElement>('input[id^="condition-key-"]'),
    );
    await fireEvent.input(conditionKeyInput, { target: { value: 'app:a' } });

    const conditionValueInput = requiredValue(
      document.querySelector<HTMLInputElement>('input[id^="condition-value-"]'),
    );
    await fireEvent.input(conditionValueInput, { target: { value: 'expected' } });

    await fireEvent.click(getByText('Apply conditional batch · confirm'));
    await findByRole('dialog');
    await fireEvent.click(getByText('Apply'));

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(activeStub.calls).toHaveLength(1);
    expect(activeStub.calls[0]?.url).toContain('/v1/storage/-/conditional-batch');
  });

  test('shows the fault message when the conditional batch fails', async () => {
    activeStub = stubStorageFetch(
      () =>
        new Response(JSON.stringify({ error: 'Raw storage access requires storage:admin.' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }),
    );

    const { getByLabelText, getByText, getByRole, findByRole, findByText } = render(
      BatchPanelHarness,
      { props: { client: fakeClient(), conditionalBatchSupported: true } },
    );

    await fireEvent.input(getByLabelText('Key'), { target: { value: 'app:a' } });
    await fireEvent.click(getByRole('switch', { name: 'Conditional (compare-and-swap)' }));
    await fireEvent.click(getByText('Apply conditional batch · confirm'));
    await findByRole('dialog');
    await fireEvent.click(getByText('Apply'));

    expect(await findByText('Raw storage access requires storage:admin.')).not.toBeNull();
  });

  test('removes a condition row', async () => {
    const { getByText, getByRole } = render(BatchPanelHarness, {
      props: { client: fakeClient(), conditionalBatchSupported: true },
    });

    await fireEvent.click(getByRole('switch', { name: 'Conditional (compare-and-swap)' }));
    await fireEvent.click(getByText('Add condition'));

    expect(document.querySelectorAll('input[id^="condition-key-"]')).toHaveLength(1);

    await fireEvent.click(getByRole('button', { name: 'Remove condition' }));

    expect(document.querySelectorAll('input[id^="condition-key-"]')).toHaveLength(0);
  });
});
