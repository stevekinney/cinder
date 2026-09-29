/**
 * Component tests for the Schedules domain router (`index.svelte`) — URL
 * query state switches between list/detail/create/edit, per that file's own
 * doc (no `/schedules/:id` entry in the frozen `routes.ts`).
 */
import { fireEvent, render, waitFor } from '@testing-library/svelte';
import { describe, expect, test } from 'bun:test';
import { Window, type DetachedWindowAPI } from 'happy-dom';

import { HttpClient } from '@lostgradient/weft';

import { startLiveSourceTestServer } from '../../lib/live-source/live-source-test-server.test-support.ts';
import { router } from '../../lib/router.svelte.ts';
import IndexHarness from './index-test-harness.test-harness.svelte';

function happyDomAPI(): DetachedWindowAPI {
  if (!(window instanceof Window)) {
    throw new Error('expected the test window to be backed by happy-dom');
  }
  return window.happyDOM;
}

function resetLocation(path = '/schedules'): void {
  happyDomAPI().setURL('http://localhost/');
  router.navigate(path, { replace: true });
}

describe('Schedules index router', () => {
  test('/schedules renders the list', async () => {
    resetLocation('/schedules');
    const server = await startLiveSourceTestServer();
    const client = new HttpClient({ baseUrl: server.baseUrl, token: server.token });

    try {
      const { getByRole } = render(IndexHarness, { props: { client } });
      await waitFor(() => expect(getByRole('heading', { name: 'Schedules' })).not.toBeNull());
    } finally {
      await server.stop();
    }
  });

  test('/schedules?id=<id> renders the detail page, not the list', async () => {
    const server = await startLiveSourceTestServer();
    await server.engine.schedule({
      workflow: 'inventory-sync-sweep',
      id: 'nightly-rollup',
      cron: '0 2 * * *',
      input: { warehouseId: 'wh-main' },
    });
    resetLocation('/schedules?id=nightly-rollup');
    const client = new HttpClient({ baseUrl: server.baseUrl, token: server.token });

    try {
      const { getByText, queryByRole } = render(IndexHarness, { props: { client } });
      await waitFor(() => expect(getByText('nightly-rollup')).not.toBeNull());
      expect(queryByRole('heading', { name: 'Schedules' })).toBeNull();
    } finally {
      await server.stop();
    }
  });

  test('/schedules?create=1 renders the list with the create drawer open', async () => {
    resetLocation('/schedules?create=1');
    const server = await startLiveSourceTestServer();
    const client = new HttpClient({ baseUrl: server.baseUrl, token: server.token });

    try {
      const { getByRole } = render(IndexHarness, { props: { client } });
      await waitFor(() => expect(getByRole('heading', { name: 'Schedules' })).not.toBeNull());
      expect(getByRole('dialog')).not.toBeNull();
    } finally {
      await server.stop();
    }
  });

  test('/schedules?id=<id>&edit=1 renders the detail page with the edit drawer open', async () => {
    const server = await startLiveSourceTestServer();
    await server.engine.schedule({
      workflow: 'inventory-sync-sweep',
      id: 'nightly-rollup',
      cron: '0 2 * * *',
      input: { warehouseId: 'wh-main' },
    });
    resetLocation('/schedules?id=nightly-rollup&edit=1');
    const client = new HttpClient({ baseUrl: server.baseUrl, token: server.token });

    try {
      const { getByText, getByRole } = render(IndexHarness, { props: { client } });
      await waitFor(() => expect(getByText('nightly-rollup')).not.toBeNull());
      expect(getByRole('dialog')).not.toBeNull();
      expect(getByRole('heading', { name: 'Edit schedule' })).not.toBeNull();
    } finally {
      await server.stop();
    }
  });

  test('closing the create drawer navigates back to the plain list URL', async () => {
    resetLocation('/schedules?create=1');
    const server = await startLiveSourceTestServer();
    const client = new HttpClient({ baseUrl: server.baseUrl, token: server.token });

    try {
      const { getByRole } = render(IndexHarness, { props: { client } });
      await waitFor(() => expect(getByRole('dialog')).not.toBeNull());

      await fireEvent.click(getByRole('button', { name: 'Cancel' }));

      await waitFor(() => expect(window.location.search).toBe(''));
    } finally {
      await server.stop();
    }
  });
});
