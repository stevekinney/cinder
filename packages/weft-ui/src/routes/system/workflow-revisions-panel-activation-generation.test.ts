/**
 * Component tests for `<WorkflowRevisionsPanel>`'s Activate/Refresh mutation
 * (WFT-115) — two regressions found in review that the sibling
 * `workflow-revisions-panel-activation.test.ts` didn't cover: an
 * `incompatible` refusal must preserve a previously-confirmed durable
 * generation (not discard it back to `activeQuery`'s possibly-stale cache),
 * and the outcome banner's verb ("Activated"/"Refreshed") must bind to the
 * mutation that actually completed, not to whichever confirm dialog happens
 * to be open when the banner renders. Split from
 * `workflow-revisions-panel-activation.test.ts` to keep both files under the
 * repo's 500-line implementation-file cap. Shared fixtures live in
 * `workflow-revisions-panel-fixtures.test-support.ts`.
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

describe('WorkflowRevisionsPanel activation — generation preservation and outcome verb binding', () => {
  test('an incompatible refusal preserves the confirmed durable generation for a LATER attempt, surviving an intervening stale refresh', async () => {
    scripted = new ScriptedFetch();
    scripted.routeJsonRpcMethod('weft.workflows.revisions.list', [
      revisionRecord('order-processing-rev-1'),
      revisionRecord('order-processing-rev-2'),
    ]);
    // `activeQuery`'s in-memory cache is stuck at generation 3 for the
    // ENTIRE test — it never reflects the generation-9 truth a stale
    // refusal below reports, modeling the documented in-memory-only
    // staleness window this fix exists for.
    scripted.routeJsonRpcMethod(
      'weft.workflows.active.get',
      activePointer('order-processing-rev-1', 3),
    );

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

    const { getByRole, findByText } = await renderPanel();

    // Attempt 1: a stale refusal reports currentGeneration 9 — the newest
    // durable truth this panel now knows, well past activeQuery's stuck 3.
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
    const activateFirst = await waitFor(() => getByRole('button', { name: 'Activate' }));
    await fireEvent.click(activateFirst);
    const firstDialog = await waitFor(() => getByRole('dialog'));
    await fireEvent.click(within(firstDialog).getByRole('button', { name: 'Activate' }));
    await findByText(/current generation 9/);
    expect(lastActivateExpectedGeneration()).toBe(3);

    // Attempt 2: an incompatible refusal. It submits 9 (the pending value
    // from attempt 1) and — because the server only evaluates compatibility
    // after the generation fence passes — that refusal CONFIRMS 9 is still
    // the current durable generation, even though nothing durable changed.
    scripted.routeJsonRpcError('weft.workflows.revisions.activate', {
      code: -32021,
      message: 'Candidate revision is incompatible with the currently active revision',
      data: {
        weftCode: 'Conflict',
        httpStatus: 409,
        reason: 'incompatible',
        compatibilityReasons: ['contract-hash-mismatch'],
      },
    });
    const activateSecond = await waitFor(() => getByRole('button', { name: 'Activate' }));
    await fireEvent.click(activateSecond);
    const secondDialog = await waitFor(() => getByRole('dialog'));
    await fireEvent.click(within(secondDialog).getByRole('button', { name: 'Activate' }));
    await findByText('Incompatible');
    expect(lastActivateExpectedGeneration()).toBe(9);

    // Attempt 3: with the (buggy) prior behavior, the incompatible outcome
    // in attempt 2 would have reset the pending generation to `null`,
    // falling back to activeQuery's still-stuck cache (3) here and
    // guaranteeing yet another stale refusal. The fix carries 9 forward.
    scripted.routeJsonRpcMethod('weft.workflows.revisions.activate', {
      applied: true,
      pointer: activePointer('order-processing-rev-2', 10),
    });
    const activateThird = await waitFor(() => getByRole('button', { name: 'Activate' }));
    await fireEvent.click(activateThird);
    const thirdDialog = await waitFor(() => getByRole('dialog'));
    await fireEvent.click(within(thirdDialog).getByRole('button', { name: 'Activate' }));
    await findByText('Compatible');
    expect(lastActivateExpectedGeneration()).toBe(9);
  });

  test("the outcome banner's verb reflects the mutation that actually completed, not whichever dialog is currently open", async () => {
    scripted = new ScriptedFetch();
    scripted.routeJsonRpcMethod('weft.workflows.revisions.list', [
      revisionRecord('order-processing-rev-1'),
      revisionRecord('order-processing-rev-2'),
    ]);
    scripted.routeJsonRpcMethod(
      'weft.workflows.active.get',
      activePointer('order-processing-rev-1'),
    );
    scripted.routeJsonRpcMethod('weft.workflows.revisions.activate', {
      applied: true,
      pointer: activePointer('order-processing-rev-2', 2),
    });

    const { getByRole, findByText } = await renderPanel();

    // Activate the non-active candidate (rev-2) to completion.
    const activateButton = await waitFor(() => getByRole('button', { name: 'Activate' }));
    await fireEvent.click(activateButton);
    const activateDialog = await waitFor(() => getByRole('dialog'));
    await fireEvent.click(within(activateDialog).getByRole('button', { name: 'Activate' }));
    expect(await findByText(/^Activated revision/)).not.toBeNull();

    // Now open the ALREADY-active row's Refresh dialog without confirming
    // it. `confirmIsRefresh` (which tracks the currently open dialog) flips
    // to true the instant this opens — the already-rendered banner from
    // the completed Activate above must not be relabeled "Refreshed" by
    // that alone.
    const refreshButton = await waitFor(() => getByRole('button', { name: 'Refresh' }));
    await fireEvent.click(refreshButton);
    await waitFor(() => getByRole('dialog'));

    expect(await findByText(/^Activated revision/)).not.toBeNull();
  });
});
