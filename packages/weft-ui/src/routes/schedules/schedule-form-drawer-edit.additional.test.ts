import { requireElement } from '../../../tests/dom-test-support.ts';

/**
 * Component tests for `<ScheduleFormDrawer>` against a REAL in-process weft
 * server.
 *
 * The registry-driven workflow-type picker still exercises its free-text
 * fallback here, not the Select: `client.operations[name]` (the registry
 * query) always goes through `HttpClient`'s JSON-RPC catalog transport
 * (`${baseUrl}/jsonrpc`, verified in `weft/src/client/http-operations.ts`).
 * `live-source-test-server.test-support.ts`'s harness is a real `serve()` as
 * of `@lostgradient/weft@0.12.0` and does route `/jsonrpc` now (the
 * `handleRequest()`-only limitation this comment used to describe, tracked
 * as weft#710, is fixed) — this file simply hasn't been extended to also
 * cover the populated-Select path against the real server; that path is
 * covered against a fake `RegistryProbeClient` in
 * `schedule-form-fields.test.ts` instead. These tests still confirm the
 * free-text fallback works end-to-end, which is real coverage on its own.
 *
 * The free-text fallback here is deterministic regardless of when the real
 * registry HTTP round-trip settles relative to a test's assertions: this
 * harness's `Engine` registers no workflows, so `fetchRegisteredWorkflowTypes`
 * always resolves to `[]`, and `schedule-form-fields.svelte` treats a
 * resolved-but-empty array the same as still-loading/errored (WFT-6) — the
 * workflow-type field never switches to a zero-option `Select` no matter how
 * slow or fast the round-trip is on a given test run.
 */
import { fireEvent, render, waitFor } from '@testing-library/svelte';
import { describe, expect, test } from 'bun:test';

import { HttpClient } from '@lostgradient/weft';

import { startLiveSourceTestServer } from '../../lib/live-source/live-source-test-server.test-support.ts';
import ScheduleFormDrawerHarness from './schedule-form-drawer-test-harness.test-harness.svelte';

describe('ScheduleFormDrawer — edit additional', () => {
  test('prefills the cadence from the existing schedule and updates it on save', async () => {
    const server = await startLiveSourceTestServer();
    await server.engine.schedule({
      workflow: 'inventory-sync-sweep',
      id: 'nightly-rollup',
      cron: '0 2 * * *',
      input: { warehouseId: 'wh-main' },
    });
    const client = new HttpClient({ baseUrl: server.baseUrl, token: server.token });

    let closed = false;
    try {
      const { getByRole } = render(ScheduleFormDrawerHarness, {
        props: {
          client,
          mode: 'edit',
          scheduleId: 'nightly-rollup',
          onClose: () => (closed = true),
        },
      });

      const workflowTypeField = await waitFor(() =>
        getByRole('textbox', { name: 'Workflow type' }),
      );
      expect(requireElement(workflowTypeField, HTMLInputElement).value).toBe(
        'inventory-sync-sweep',
      );
      expect(requireElement(workflowTypeField, HTMLInputElement).disabled).toBe(true);

      await fireEvent.click(getByRole('button', { name: 'Save changes' }));

      await waitFor(() => expect(closed).toBe(true));
      const updated = await server.engine.getSchedule('nightly-rollup');
      // Cadence unchanged (no edit made) but the round trip through
      // updateSchedule() must succeed against the real server.
      expect(updated?.cronExpression).toBe('0 2 * * *');
    } finally {
      await server.stop();
    }
  });

  test('prefills revisionPolicy from the fetched ScheduleSummary and leaves it unchanged on an unrelated save (WFT-117)', async () => {
    const server = await startLiveSourceTestServer();
    await server.engine.schedule({
      workflow: 'inventory-sync-sweep',
      id: 'pinned-rollup',
      cron: '0 2 * * *',
      input: { warehouseId: 'wh-main' },
      revisionPolicy: 'pinned',
    });
    const client = new HttpClient({ baseUrl: server.baseUrl, token: server.token });

    let closed = false;
    try {
      const { getByRole } = render(ScheduleFormDrawerHarness, {
        props: {
          client,
          mode: 'edit',
          scheduleId: 'pinned-rollup',
          onClose: () => (closed = true),
        },
      });

      const pinnedRadio = await waitFor(() => getByRole('radio', { name: 'Pinned' }));
      expect(requireElement(pinnedRadio, HTMLInputElement).checked).toBe(true);

      const before = await server.engine.getSchedule('pinned-rollup');
      const pinnedRevisionBefore = before?.pinnedRevision;

      await fireEvent.click(getByRole('button', { name: 'Save changes' }));
      await waitFor(() => expect(closed).toBe(true));

      // Unchanged revisionPolicy must not resend it — the pin is never
      // silently re-captured by an unrelated cadence-only save.
      const after = await server.engine.getSchedule('pinned-rollup');
      expect(after?.revisionPolicy).toBe('pinned');
      expect(after?.pinnedRevision).toBe(pinnedRevisionBefore);
    } finally {
      await server.stop();
    }
  });
});
