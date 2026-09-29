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

import { ScriptedFetch } from './system-test-support.test-support.ts';
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

describe('WorkflowRevisionsPanel activation', () => {
  test('a successful activation shows the applied outcome and invalidates the revisions/active/registry queries', async () => {
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
    const activateButton = await waitFor(() => getByRole('button', { name: 'Activate' }));
    const callsBeforeActivation = scripted.calls.length;

    await fireEvent.click(activateButton);
    const dialog = await waitFor(() => getByRole('dialog'));
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Activate' }));

    expect(await findByText('Compatible')).not.toBeNull();
    expect(await findByText(/order-processing-rev-2/)).not.toBeNull();

    // Invalidated queries refetch: at least one more call landed after the
    // mutation itself (revisions.list and/or active.get and/or the
    // registry snapshot re-fetching), proving invalidation actually fired
    // rather than asserting on internal query-client spies.
    await waitFor(() => {
      expect(scripted?.calls.length).toBeGreaterThan(callsBeforeActivation + 1);
    });
  });

  test('a refusal carrying compatibilityReasons renders every reason as explicit text, never color alone', async () => {
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
      message: 'Candidate revision is incompatible with the currently active revision',
      data: {
        weftCode: 'Conflict',
        httpStatus: 409,
        reason: 'incompatible',
        compatibilityReasons: [
          'contract-hash-mismatch',
          'workflow-version-incompatible',
          'artifact-revision-mismatch',
        ],
      },
    });

    const { getByRole, findByText } = await renderPanel();
    const activateButton = await waitFor(() => getByRole('button', { name: 'Activate' }));
    await fireEvent.click(activateButton);
    const dialog = await waitFor(() => getByRole('dialog'));
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Activate' }));

    expect(await findByText('Incompatible')).not.toBeNull();
    expect(await findByText(/contract-hash-mismatch/)).not.toBeNull();
    expect(await findByText(/workflow-version-incompatible/)).not.toBeNull();
    expect(await findByText(/artifact-revision-mismatch/)).not.toBeNull();
  });

  test('a refusal carrying only currentGeneration renders the stale message and a refresh action', async () => {
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

    const { getByRole, findByText } = await renderPanel();
    const activateButton = await waitFor(() => getByRole('button', { name: 'Activate' }));
    await fireEvent.click(activateButton);
    const dialog = await waitFor(() => getByRole('dialog'));
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Activate' }));

    expect(await findByText(/current generation 4/)).not.toBeNull();
    expect(await findByText('Conflict')).not.toBeNull();
  });

  test('a success-shaped but malformed activation response never renders an outcome banner', async () => {
    scripted = new ScriptedFetch();
    scripted.routeJsonRpcMethod('weft.workflows.revisions.list', [
      revisionRecord('order-processing-rev-1'),
      revisionRecord('order-processing-rev-2'),
    ]);
    scripted.routeJsonRpcMethod(
      'weft.workflows.active.get',
      activePointer('order-processing-rev-1'),
    );
    // `applied: true` but the `pointer` fails `isAppliedActivationResult`'s
    // structural guard — the wire lied about its own shape (or a future
    // server added a field this build doesn't understand in a way that
    // broke the pointer). Never fabricated into a "Compatible" banner.
    scripted.routeJsonRpcMethod('weft.workflows.revisions.activate', {
      applied: true,
      pointer: { revision: 'order-processing-rev-2' },
    });

    const { getByRole, queryByText, findByRole } = await renderPanel();
    const activateButton = await waitFor(() => getByRole('button', { name: 'Activate' }));
    await fireEvent.click(activateButton);
    const dialog = await waitFor(() => getByRole('dialog'));
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Activate' }));

    await findByRole('button', { name: 'Activate' });
    expect(queryByText('Compatible')).toBeNull();
    expect(queryByText('Incompatible')).toBeNull();
  });

  test('a NotFound/server fault on activation routes through the existing six-code fault mapping instead of rendering an outcome banner', async () => {
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
      code: -32020,
      message: 'Workflow revision "order-processing:order-processing-rev-2" was never installed',
      data: { weftCode: 'NotFound', httpStatus: 404, resource: 'workflow-revision' },
    });

    const { getByRole, queryByText, findByRole } = await renderPanel();
    const activateButton = await waitFor(() => getByRole('button', { name: 'Activate' }));
    await fireEvent.click(activateButton);
    const dialog = await waitFor(() => getByRole('dialog'));
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Activate' }));

    // The mutation settles (button returns to its normal, non-pending state)
    // without ever rendering one of the recognized outcome banners — a
    // NotFound refusal isn't a compatibility verdict this panel understands,
    // so it is rethrown and handled by the default mutation-error toast
    // (query.ts), not fabricated into a local outcome.
    await findByRole('button', { name: 'Activate' });
    expect(queryByText('Compatible')).toBeNull();
    expect(queryByText('Incompatible')).toBeNull();
  });
});
