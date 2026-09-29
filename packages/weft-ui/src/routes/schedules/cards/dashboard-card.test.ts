/**
 * Component tests for the Schedule health dashboard card, against a REAL
 * in-process weft server.
 */
import { fireEvent, render, waitFor } from '@testing-library/svelte';
import { beforeEach, describe, expect, test } from 'bun:test';
import { Window, type DetachedWindowAPI } from 'happy-dom';

import { HttpClient } from '@lostgradient/weft';

import { startLiveSourceTestServer } from '../../../lib/live-source/live-source-test-server.test-support.ts';
import { router } from '../../../lib/router.svelte.ts';
import DashboardCardHarness from './dashboard-card-test-harness.test-harness.svelte';

function happyDomAPI(): DetachedWindowAPI {
  if (!(window instanceof Window)) {
    throw new Error('expected the test window to be backed by happy-dom');
  }
  return window.happyDOM;
}

function resetLocation(path = '/'): void {
  happyDomAPI().setURL('http://localhost/');
  router.navigate(path, { replace: true });
}

describe('Schedules dashboard card', () => {
  beforeEach(() => {
    resetLocation();
  });

  test('shows active/paused counts and the total', async () => {
    const server = await startLiveSourceTestServer();
    await server.engine.schedule({
      workflow: 'inventory-sync-sweep',
      id: 'nightly-rollup',
      cron: '0 2 * * *',
      input: { warehouseId: 'wh-main' },
    });
    const pausedHandle = await server.engine.schedule({
      workflow: 'inventory-sync-sweep',
      id: 'weekly-digest',
      cron: '0 9 * * 1',
      input: { warehouseId: 'wh-main' },
    });
    await pausedHandle.pause();
    const client = new HttpClient({ baseUrl: server.baseUrl, token: server.token });

    try {
      const { getByText } = render(DashboardCardHarness, { props: { client } });
      await waitFor(() => expect(getByText('2 schedules')).not.toBeNull());
      expect(getByText('Schedule health')).not.toBeNull();
    } finally {
      await server.stop();
    }
  });

  test('clicking the Active segment deep-links to the pre-filtered list URL', async () => {
    const server = await startLiveSourceTestServer();
    await server.engine.schedule({
      workflow: 'inventory-sync-sweep',
      id: 'nightly-rollup',
      cron: '0 2 * * *',
      input: { warehouseId: 'wh-main' },
    });
    const client = new HttpClient({ baseUrl: server.baseUrl, token: server.token });

    try {
      const { getByText } = render(DashboardCardHarness, { props: { client } });
      const activeLabel = await waitFor(() => getByText('Active'));

      await fireEvent.click(activeLabel.closest('button')!);

      expect(window.location.pathname).toBe('/schedules');
      expect(window.location.search).toBe('?status=active');
    } finally {
      await server.stop();
    }
  });

  test('an empty schedule roster shows zero counts, not an error', async () => {
    const server = await startLiveSourceTestServer();
    const client = new HttpClient({ baseUrl: server.baseUrl, token: server.token });

    try {
      const { getByText } = render(DashboardCardHarness, { props: { client } });
      await waitFor(() => expect(getByText('0 schedules')).not.toBeNull());
    } finally {
      await server.stop();
    }
  });

  test('a fault renders the shared dashboard-card error treatment', async () => {
    const client = new HttpClient({ baseUrl: 'http://127.0.0.1:1' });

    const { container } = render(DashboardCardHarness, { props: { client } });
    await waitFor(
      () => {
        expect(container.querySelector('.weft-dashboard-card__error')).not.toBeNull();
      },
      { timeout: 3000 },
    );
  });
});
