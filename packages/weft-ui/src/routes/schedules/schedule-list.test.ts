import { requireElement } from '../../../tests/dom-test-support.ts';

/**
 * Component tests for `<ScheduleList>` against a REAL in-process weft server
 * (`live-source-test-server.test-support.ts` — plan §11: "No mock server, no
 * fixture drift"). `fixtures/workflows.ts` already registers
 * `inventory-sync-sweep` (from `fixtures/schedules.ts`), so schedules are
 * created directly against that real workflow type per test.
 */
import { fireEvent, render, waitFor, within } from '@testing-library/svelte';
import { beforeEach, describe, expect, test } from 'bun:test';
import { Window, type DetachedWindowAPI } from 'happy-dom';
import { flushSync } from 'svelte';

import { HttpClient } from '@lostgradient/weft';

import { startLiveSourceTestServer } from '../../lib/live-source/live-source-test-server.test-support.ts';
import { router } from '../../lib/router.svelte.ts';
import ScheduleListHarness from './schedule-list-test-harness.test-harness.svelte';

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

describe('ScheduleList', () => {
  beforeEach(() => {
    resetLocation();
  });

  test('shows the onboarding empty state when no schedules exist', async () => {
    const server = await startLiveSourceTestServer();
    const client = new HttpClient({ baseUrl: server.baseUrl, token: server.token });

    try {
      const { getByText } = render(ScheduleListHarness, {
        props: { client },
      });

      await waitFor(() => expect(getByText('No schedules')).not.toBeNull());
      expect(getByText('Create one to run workflows on a cadence.')).not.toBeNull();
    } finally {
      await server.stop();
    }
  });

  test('renders a schedule row with its status badge and human-readable cadence', async () => {
    const server = await startLiveSourceTestServer();
    await server.engine.schedule({
      workflow: 'inventory-sync-sweep',
      id: 'nightly-rollup',
      cron: '0 2 * * *',
      input: { warehouseId: 'wh-main' },
    });
    const client = new HttpClient({ baseUrl: server.baseUrl, token: server.token });

    try {
      const { getByText, getByRole } = render(ScheduleListHarness, {
        props: { client },
      });

      await waitFor(() => expect(getByText('nightly-rollup')).not.toBeNull());
      const { getByText: getByTextInTable } = within(getByRole('table'));
      expect(getByTextInTable('Active')).not.toBeNull();
      expect(getByText('Every day at 02:00')).not.toBeNull();
      expect(getByTextInTable('inventory-sync-sweep')).not.toBeNull();
    } finally {
      await server.stop();
    }
  });

  test('a paused schedule shows the Paused badge', async () => {
    const server = await startLiveSourceTestServer();
    const handle = await server.engine.schedule({
      workflow: 'inventory-sync-sweep',
      id: 'weekly-digest',
      cron: '0 9 * * 1',
      input: { warehouseId: 'wh-main' },
    });
    await handle.pause();
    const client = new HttpClient({ baseUrl: server.baseUrl, token: server.token });

    try {
      const { getByText, getByRole } = render(ScheduleListHarness, {
        props: { client },
      });

      await waitFor(() => expect(getByText('weekly-digest')).not.toBeNull());
      const { getByText: getByTextInTable } = within(getByRole('table'));
      expect(getByTextInTable('Paused')).not.toBeNull();
    } finally {
      await server.stop();
    }
  });

  /**
   * T9.4 accessibility pass: before this fix, the row's ONLY navigation
   * affordance was `Table.Row`'s `onclick` — Cinder's `table-row.svelte`
   * spreads `onclick` straight onto a bare `<tr>` with no `tabindex`/keydown
   * handling, so the row was reachable by mouse only. A real `<a href>` is
   * the keyboard path (Tab reaches it, Enter activates it natively — no app
   * JS needed for that part), mirroring `workflow-table.svelte`'s identical
   * id-link pattern.
   */
  test('the schedule id renders as a real link to the detail URL (keyboard-reachable, not row-onclick-only)', async () => {
    const server = await startLiveSourceTestServer();
    await server.engine.schedule({
      workflow: 'inventory-sync-sweep',
      id: 'nightly-rollup',
      cron: '0 2 * * *',
      input: { warehouseId: 'wh-main' },
    });
    const client = new HttpClient({ baseUrl: server.baseUrl, token: server.token });

    try {
      const { getByRole } = render(ScheduleListHarness, {
        props: { client },
      });

      const link = await waitFor(() => getByRole('link', { name: 'nightly-rollup' }));
      expect(link.getAttribute('href')).toContain('id=nightly-rollup');
    } finally {
      await server.stop();
    }
  });

  test('clicking a row navigates to the schedule detail URL', async () => {
    const server = await startLiveSourceTestServer();
    await server.engine.schedule({
      workflow: 'inventory-sync-sweep',
      id: 'nightly-rollup',
      cron: '0 2 * * *',
      input: { warehouseId: 'wh-main' },
    });
    const client = new HttpClient({ baseUrl: server.baseUrl, token: server.token });

    try {
      const { getByText } = render(ScheduleListHarness, {
        props: { client },
      });

      const idCell = await waitFor(() => {
        const cell = getByText('nightly-rollup');
        expect(cell).not.toBeNull();
        return cell;
      });
      await fireEvent.click(idCell);

      expect(window.location.search).toContain('id=nightly-rollup');
    } finally {
      await server.stop();
    }
  });

  test('the Create schedule button is disabled with a reason when schedules:write is missing', async () => {
    const server = await startLiveSourceTestServer();
    const client = new HttpClient({ baseUrl: server.baseUrl, token: server.token });

    try {
      const { getByRole, getByText } = render(ScheduleListHarness, {
        props: { client, scopes: ['schedules:read'] },
      });

      await waitFor(() => {
        expect(
          requireElement(getByRole('button', { name: 'Create schedule' }), HTMLButtonElement)
            .disabled,
        ).toBe(true);
      });
      expect(getByText('Requires schedules:write')).not.toBeNull();
    } finally {
      await server.stop();
    }
  });

  test('the Create schedule button is enabled with schedules:write granted', async () => {
    const server = await startLiveSourceTestServer();
    const client = new HttpClient({ baseUrl: server.baseUrl, token: server.token });

    try {
      const { getByRole, queryByText } = render(ScheduleListHarness, {
        props: { client },
      });

      await waitFor(() => {
        expect(
          requireElement(getByRole('button', { name: 'Create schedule' }), HTMLButtonElement)
            .disabled,
        ).toBe(false);
      });
      expect(queryByText('Requires schedules:write')).toBeNull();
    } finally {
      await server.stop();
    }
  });

  test('pausing an active schedule updates its badge to Paused', async () => {
    const server = await startLiveSourceTestServer();
    await server.engine.schedule({
      workflow: 'inventory-sync-sweep',
      id: 'nightly-rollup',
      cron: '0 2 * * *',
      input: { warehouseId: 'wh-main' },
    });
    const client = new HttpClient({ baseUrl: server.baseUrl, token: server.token });

    try {
      const { getByText, getByRole } = render(ScheduleListHarness, {
        props: { client },
      });

      await waitFor(() => {
        expect(within(getByRole('table')).getByText('Active')).not.toBeNull();
      });

      await fireEvent.click(getByRole('button', { name: 'Actions for nightly-rollup' }));
      await fireEvent.click(await waitFor(() => getByRole('menuitem', { name: /Pause/ })));

      await waitFor(() => {
        expect(within(getByRole('table')).getByText('Paused')).not.toBeNull();
      });
      expect(getByText('nightly-rollup')).not.toBeNull();
    } finally {
      await server.stop();
    }
  });

  test('cancelling a schedule requires Tier-2 confirmation before it takes effect (T8.2 tier sweep)', async () => {
    const server = await startLiveSourceTestServer();
    await server.engine.schedule({
      workflow: 'inventory-sync-sweep',
      id: 'nightly-rollup',
      cron: '0 2 * * *',
      input: { warehouseId: 'wh-main' },
    });
    const client = new HttpClient({ baseUrl: server.baseUrl, token: server.token });

    try {
      const { getByText, getByRole, queryByText } = render(ScheduleListHarness, {
        props: { client },
      });

      await waitFor(() => {
        expect(within(getByRole('table')).getByText('Active')).not.toBeNull();
      });

      await fireEvent.click(getByRole('button', { name: 'Actions for nightly-rollup' }));
      await fireEvent.click(await waitFor(() => getByRole('menuitem', { name: /Cancel/ })));

      // Opening the menu item shows the confirm dialog — the schedule must
      // NOT be cancelled yet (this is exactly the gap the tier sweep fixed:
      // the row action previously mutated on click with no confirm step at
      // all).
      await waitFor(() => {
        expect(getByText('Cancel this schedule?')).not.toBeNull();
      });
      expect(within(getByRole('table')).getByText('Active')).not.toBeNull();

      await fireEvent.click(getByRole('button', { name: 'Cancel schedule' }));

      await waitFor(() => {
        expect(within(getByRole('table')).getByText('Cancelled')).not.toBeNull();
      });
      expect(queryByText('Cancel this schedule?')).toBeNull();
    } finally {
      await server.stop();
    }
  });

  test('dismissing the cancel confirm dialog leaves the schedule active', async () => {
    const server = await startLiveSourceTestServer();
    await server.engine.schedule({
      workflow: 'inventory-sync-sweep',
      id: 'nightly-rollup',
      cron: '0 2 * * *',
      input: { warehouseId: 'wh-main' },
    });
    const client = new HttpClient({ baseUrl: server.baseUrl, token: server.token });

    try {
      const { getByText, getByRole, queryByText } = render(ScheduleListHarness, {
        props: { client },
      });

      await waitFor(() => {
        expect(within(getByRole('table')).getByText('Active')).not.toBeNull();
      });

      await fireEvent.click(getByRole('button', { name: 'Actions for nightly-rollup' }));
      await fireEvent.click(await waitFor(() => getByRole('menuitem', { name: /Cancel/ })));
      await waitFor(() => {
        expect(getByText('Cancel this schedule?')).not.toBeNull();
      });

      await fireEvent.click(getByRole('button', { name: 'Cancel' }));

      flushSync();
      expect(queryByText('Cancel this schedule?')?.outerHTML ?? null).toBeNull();
      expect(within(getByRole('table')).getByText('Active')).not.toBeNull();
    } finally {
      await server.stop();
    }
  });

  test('a fault (unreachable server) renders the fault banner with a retry action', async () => {
    const client = new HttpClient({ baseUrl: 'http://127.0.0.1:1' });

    const { getByRole } = render(ScheduleListHarness, {
      props: { client },
    });

    await waitFor(() => expect(getByRole('button', { name: 'Retry' })).not.toBeNull(), {
      timeout: 3000,
    });
  });

  test('a ?status= URL query param (dashboard-card deep link) pre-filters the status Select', async () => {
    resetLocation('/schedules?status=paused');
    const server = await startLiveSourceTestServer();
    const handle = await server.engine.schedule({
      workflow: 'inventory-sync-sweep',
      id: 'weekly-digest',
      cron: '0 9 * * 1',
      input: { warehouseId: 'wh-main' },
    });
    await handle.pause();
    await server.engine.schedule({
      workflow: 'inventory-sync-sweep',
      id: 'nightly-rollup',
      cron: '0 2 * * *',
      input: { warehouseId: 'wh-main' },
    });
    const client = new HttpClient({ baseUrl: server.baseUrl, token: server.token });

    try {
      const { getByRole, getByText, queryByText } = render(ScheduleListHarness, {
        props: { client },
      });

      await waitFor(() => expect(getByText('weekly-digest')).not.toBeNull());
      expect(queryByText('nightly-rollup')).toBeNull();
      expect(
        requireElement(getByRole('combobox', { name: 'Status' }), HTMLSelectElement).value,
      ).toBe('paused');
    } finally {
      await server.stop();
    }
  });

  test('changing the status Select updates the URL (replacing, not pushing, history)', async () => {
    resetLocation('/schedules');
    const server = await startLiveSourceTestServer();
    const client = new HttpClient({ baseUrl: server.baseUrl, token: server.token });

    try {
      const { getByRole } = render(ScheduleListHarness, { props: { client } });
      const statusSelect = await waitFor(() => getByRole('combobox', { name: 'Status' }));

      await fireEvent.change(statusSelect, { target: { value: 'active' } });

      expect(window.location.search).toBe('?status=active');
    } finally {
      await server.stop();
    }
  });
});
