/**
 * Component tests for `<KvBrowser>` (plan §9.6; design `Weft UI.dc.html`
 * STORAGE "stBrowser"): the get/scan/put/delete/batch operation picker.
 */
import { fireEvent, render } from '@testing-library/svelte';
import { describe, expect, test } from 'bun:test';
import type { StorageConnection } from './storage-client.ts';

import KvBrowserHarness from './kv-browser-test-harness.test-harness.svelte';

function fakeClient(): StorageConnection {
  return { baseUrl: 'http://localhost:7233', headers: {} };
}

describe('KvBrowser', () => {
  test('defaults to the scan panel', () => {
    const { getByText } = render(KvBrowserHarness, { props: { client: fakeClient() } });

    expect(getByText('Scan storage')).not.toBeNull();
  });

  test('switches to the get panel', async () => {
    const { getByRole, findByText } = render(KvBrowserHarness, { props: { client: fakeClient() } });

    await fireEvent.click(getByRole('tab', { name: 'Get' }));

    expect(await findByText('Enter a key')).not.toBeNull();
  });

  test('switches to the put panel', async () => {
    const { getByRole, findByText } = render(KvBrowserHarness, { props: { client: fakeClient() } });

    await fireEvent.click(getByRole('tab', { name: 'Put' }));

    expect(await findByText('Put · confirm')).not.toBeNull();
  });

  test('switches to the delete panel', async () => {
    const { getByRole, findByText } = render(KvBrowserHarness, { props: { client: fakeClient() } });

    await fireEvent.click(getByRole('tab', { name: 'Delete' }));

    expect(await findByText('Delete · confirm')).not.toBeNull();
  });

  test('switches to the batch panel and defaults conditionalBatchSupported to false when omitted', async () => {
    const { getByRole, findByText, queryByText } = render(KvBrowserHarness, {
      props: { client: fakeClient() },
    });

    await fireEvent.click(getByRole('tab', { name: 'Batch' }));

    expect(await findByText('Apply batch · confirm')).not.toBeNull();
    expect(queryByText('Conditional (compare-and-swap)')).toBeNull();
  });

  test('unmounts the previous panel when switching between operations', async () => {
    const { getByRole, findByText, queryByText } = render(KvBrowserHarness, {
      props: { client: fakeClient() },
    });

    await findByText('Scan storage');

    await fireEvent.click(getByRole('tab', { name: 'Get' }));
    expect(await findByText('Enter a key')).not.toBeNull();
    expect(queryByText('Scan storage')).toBeNull();

    await fireEvent.click(getByRole('tab', { name: 'Put' }));
    expect(await findByText('Put · confirm')).not.toBeNull();
    expect(queryByText('Enter a key')).toBeNull();

    await fireEvent.click(getByRole('tab', { name: 'Delete' }));
    expect(await findByText('Delete · confirm')).not.toBeNull();
    expect(queryByText('Put · confirm')).toBeNull();

    await fireEvent.click(getByRole('tab', { name: 'Batch' }));
    expect(await findByText('Apply batch · confirm')).not.toBeNull();
    expect(queryByText('Delete · confirm')).toBeNull();

    await fireEvent.click(getByRole('tab', { name: 'Scan' }));
    expect(await findByText('Scan storage')).not.toBeNull();
    expect(queryByText('Apply batch · confirm')).toBeNull();
  });

  test('passes a true conditionalBatchSupported through to the batch panel', async () => {
    const { getByRole, findByText } = render(KvBrowserHarness, {
      props: { client: fakeClient(), conditionalBatchSupported: true },
    });

    await fireEvent.click(getByRole('tab', { name: 'Batch' }));
    await findByText('Apply batch · confirm');

    expect(await findByText('Conditional (compare-and-swap)')).not.toBeNull();
  });
});
