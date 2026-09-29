/**
 * Component tests for `<WorkflowRevisionsPanel>`'s Activate/Refresh mutation
 * (WFT-115): successful and rejected outcomes (both `compatibilityReasons`
 * and `currentGeneration`-only shapes), the malformed-response and
 * non-compatibility-fault paths, query invalidation, the durable-generation
 * reuse after a stale refusal, and the Activate-vs-Refresh confirm-dialog
 * wording split. The loading/denied/malformed-revisions-list/empty/query-
 * fault states live in the sibling `workflow-revisions-panel.test.ts`; the
 * incompatible-outcome generation-preservation and completed-mutation-verb
 * regression tests live in
 * `workflow-revisions-panel-activation-generation.test.ts` — this file
 * crossed the repo's 500-line implementation-file cap combined with those.
 * Shared fixtures live in `workflow-revisions-panel-fixtures.test-support.ts`.
 */
import { fireEvent, waitFor, within } from '@testing-library/svelte';
import { afterEach, describe, expect, test } from 'bun:test';

import { parseJsonObject, ScriptedFetch } from './system-test-support.test-support.ts';
import {
  activePointer,
  renderPanel,
  revisionRecord,
} from './workflow-revisions-panel-fixtures.test-support.ts';

let scripted: ScriptedFetch | undefined;

afterEach(() => {
  scripted?.restore();
  scripted = undefined;
});

describe('additional coverage', () => {
  test('the stale-outcome Refresh button refetches revisions and the active pointer', async () => {
    scripted = new ScriptedFetch();
    scripted.routeJsonRpcMethod('weft.workflows.revisions.list', [
      revisionRecord('order-processing-rev-1'),
      revisionRecord('order-processing-rev-2'),
    ]);
    scripted.routeJsonRpcMethod(
      'weft.workflows.active.get',
      activePointer('order-processing-rev-1'),
    );
    scripted.routeJsonRpcError('weft.workflows.revisions.activate', {
      code: -32021,
      message: 'Stale expectedGeneration: the current durable generation is 4',
      data: {
        weftCode: 'Conflict',
        httpStatus: 409,
        reason: 'stale-generation',
        currentGeneration: 4,
      },
    });

    const { getByRole, findByText, getAllByRole } = await renderPanel();
    const activateButton = await waitFor(() => getByRole('button', { name: 'Activate' }));
    await fireEvent.click(activateButton);
    const dialog = await waitFor(() => getByRole('dialog'));
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Activate' }));
    await findByText(/current generation 4/);

    const callsBeforeRefresh = scripted.calls.length;
    // Two "Refresh" buttons now exist: the active row's own Refresh action
    // and the stale-outcome banner's Refresh action — the LAST one rendered
    // is the outcome banner's (it renders after the row list in document
    // order).
    const refreshButtons = getAllByRole('button', { name: 'Refresh' });
    const outcomeRefresh = refreshButtons[refreshButtons.length - 1];
    if (outcomeRefresh) await fireEvent.click(outcomeRefresh);

    await waitFor(() => {
      expect(scripted?.calls.length).toBeGreaterThan(callsBeforeRefresh);
    });
  });

  test("a retry after a stale refusal sends the refusal's own currentGeneration, not the (possibly still-stale) activeQuery cache", async () => {
    scripted = new ScriptedFetch();
    scripted.routeJsonRpcMethod('weft.workflows.revisions.list', [
      revisionRecord('order-processing-rev-1'),
      revisionRecord('order-processing-rev-2'),
    ]);
    // activeQuery's own cached generation (3) is what the FIRST attempt
    // must use — and, per `weft.workflows.active.get`'s documented
    // in-memory-only contract, is exactly the value a same-process refetch
    // could keep returning even after another process already moved the
    // durable generation to 9. The fix under test is that the SECOND
    // attempt must prefer the refusal's own `currentGeneration` (9) over
    // this stale cache value, not that this route ever changes.
    scripted.routeJsonRpcMethod(
      'weft.workflows.active.get',
      activePointer('order-processing-rev-1', 3),
    );
    scripted.routeJsonRpcError('weft.workflows.revisions.activate', {
      code: -32021,
      message: 'Stale expectedGeneration: the current durable generation is 9',
      data: {
        weftCode: 'Conflict',
        httpStatus: 409,
        reason: 'stale-generation',
        currentGeneration: 9,
      },
    });

    const { getByRole, findByText } = await renderPanel();
    const activateButton = await waitFor(() => getByRole('button', { name: 'Activate' }));
    await fireEvent.click(activateButton);
    const dialog = await waitFor(() => getByRole('dialog'));
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Activate' }));
    await findByText(/current generation 9/);

    function lastActivateExpectedGeneration(): unknown {
      const activateCalls = (scripted?.calls ?? []).filter((call) => {
        if (typeof call.init?.body !== 'string') return false;
        try {
          return (
            parseJsonObject(call.init.body)?.['method'] === 'weft.workflows.revisions.activate'
          );
        } catch {
          return false;
        }
      });
      const last = activateCalls[activateCalls.length - 1];
      if (!last || typeof last.init?.body !== 'string') return undefined;
      const parsed = parseJsonObject(last.init.body);
      const params = parsed?.['params'];
      return params !== null && typeof params === 'object'
        ? Reflect.get(params, 'expectedGeneration')
        : undefined;
    }

    expect(lastActivateExpectedGeneration()).toBe(3);

    // Now let a retry succeed, most-recently-registered route wins.
    scripted.routeJsonRpcMethod('weft.workflows.revisions.activate', {
      applied: true,
      pointer: activePointer('order-processing-rev-2', 10),
    });

    const activateAgain = await waitFor(() => getByRole('button', { name: 'Activate' }));
    await fireEvent.click(activateAgain);
    const dialogAgain = await waitFor(() => getByRole('dialog'));
    await fireEvent.click(within(dialogAgain).getByRole('button', { name: 'Activate' }));
    await findByText('Compatible');

    expect(lastActivateExpectedGeneration()).toBe(9);
  });

  test('after a stale refusal reports a generation OLDER than what activeQuery already has cached, the next attempt still submits the newer cached value', async () => {
    scripted = new ScriptedFetch();
    scripted.routeJsonRpcMethod('weft.workflows.revisions.list', [
      revisionRecord('order-processing-rev-1'),
      revisionRecord('order-processing-rev-2'),
    ]);
    // `activeQuery` is already resolved at generation 5 for the whole test
    // — no refetch race to win: this scenario isolates the pure
    // max-of-two-known-generations logic (`resolveExpectedGeneration`)
    // from any query-refetch timing.
    scripted.routeJsonRpcMethod(
      'weft.workflows.active.get',
      activePointer('order-processing-rev-1', 5),
    );
    // The refusal itself reports `currentGeneration: 4` — LOWER than what
    // `activeQuery` already has. A naive "always prefer the refusal's
    // pending value" rule would downgrade to 4 and keep resubmitting a
    // stale generation forever; the fix takes the max of the two known
    // values instead.
    scripted.routeJsonRpcError('weft.workflows.revisions.activate', {
      code: -32021,
      message: 'Stale expectedGeneration: the current durable generation is 4',
      data: {
        weftCode: 'Conflict',
        httpStatus: 409,
        reason: 'stale-generation',
        currentGeneration: 4,
      },
    });

    const { getByRole, findByText } = await renderPanel();
    const activateButton = await waitFor(() => getByRole('button', { name: 'Activate' }));
    await fireEvent.click(activateButton);
    const dialog = await waitFor(() => getByRole('dialog'));
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Activate' }));
    await findByText(/current generation 4/);

    scripted.routeJsonRpcMethod('weft.workflows.revisions.activate', {
      applied: true,
      pointer: activePointer('order-processing-rev-2', 6),
    });

    function lastActivateExpectedGeneration(): unknown {
      const activateCalls = (scripted?.calls ?? []).filter((call) => {
        if (typeof call.init?.body !== 'string') return false;
        try {
          return (
            parseJsonObject(call.init.body)?.['method'] === 'weft.workflows.revisions.activate'
          );
        } catch {
          return false;
        }
      });
      const last = activateCalls[activateCalls.length - 1];
      if (!last || typeof last.init?.body !== 'string') return undefined;
      const parsed = parseJsonObject(last.init.body);
      const params = parsed?.['params'];
      return params !== null && typeof params === 'object'
        ? Reflect.get(params, 'expectedGeneration')
        : undefined;
    }

    // The FIRST attempt (before any refusal exists) used `activeQuery`'s
    // own generation, 5 — confirm that baseline before checking the
    // post-refusal attempt below.
    expect(lastActivateExpectedGeneration()).toBe(5);

    const activateAgain = await waitFor(() => getByRole('button', { name: 'Activate' }));
    await fireEvent.click(activateAgain);
    const dialogAgain = await waitFor(() => getByRole('dialog'));
    await fireEvent.click(within(dialogAgain).getByRole('button', { name: 'Activate' }));
    await findByText('Compatible');

    // Still 5 — the pending refusal's OLDER value (4) never overrides the
    // newer one already known from `activeQuery`.
    expect(lastActivateExpectedGeneration()).toBe(5);
  });

  test('activating the already-active revision (labeled Refresh) opens a re-stamp-worded confirm dialog and applies, reporting "Refreshed" not "Activated"', async () => {
    scripted = new ScriptedFetch();
    scripted.routeJsonRpcMethod('weft.workflows.revisions.list', [
      revisionRecord('order-processing-rev-1'),
      revisionRecord('order-processing-rev-2'),
      revisionRecord('order-processing-rev-3'),
    ]);
    scripted.routeJsonRpcMethod(
      'weft.workflows.active.get',
      activePointer('order-processing-rev-1', 3),
    );
    scripted.routeJsonRpcMethod('weft.workflows.revisions.activate', {
      applied: true,
      pointer: activePointer('order-processing-rev-1', 4),
    });

    const { getByRole, findByText } = await renderPanel();
    const refreshButton = await waitFor(() => getByRole('button', { name: 'Refresh' }));
    await fireEvent.click(refreshButton);
    const dialog = await waitFor(() => getByRole('dialog'));
    // The dialog itself must use re-stamp wording, not the generic
    // Activate copy — an operator confirming a same-revision refresh
    // should never read language implying a different revision is about
    // to go live.
    expect(within(dialog).getByText(/re-stamps it as the active revision/)).not.toBeNull();
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Refresh' }));

    expect(await findByText('Compatible')).not.toBeNull();
    expect(await findByText(/^Refreshed revision/)).not.toBeNull();
  });

  test('activating a different, non-active candidate opens the generic Activate-worded confirm dialog', async () => {
    scripted = new ScriptedFetch();
    scripted.routeJsonRpcMethod('weft.workflows.revisions.list', [
      revisionRecord('order-processing-rev-1'),
      revisionRecord('order-processing-rev-2'),
    ]);
    scripted.routeJsonRpcMethod(
      'weft.workflows.active.get',
      activePointer('order-processing-rev-1'),
    );

    const { getByRole } = await renderPanel();
    const activateButton = await waitFor(() => getByRole('button', { name: 'Activate' }));
    await fireEvent.click(activateButton);
    const dialog = await waitFor(() => getByRole('dialog'));
    expect(within(dialog).getByText(/Weft evaluates compatibility/)).not.toBeNull();
    expect(within(dialog).getByRole('button', { name: 'Activate' })).not.toBeNull();
  });
});
