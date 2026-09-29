/**
 * Component tests for `<WorkflowRevisionsPanel>` (WFT-115): data mapping,
 * permission gating, and the loading/denied/malformed-response/empty/
 * server-fault query states. The Activate/Refresh mutation and its
 * outcomes live in the sibling `workflow-revisions-panel-activation.test.ts`
 * — this file crossed the repo's 500-line implementation-file cap combined.
 * Shared fixtures (`revisionRecord`/`activePointer`/`renderPanel`) live in
 * `workflow-revisions-panel-fixtures.test-support.ts`.
 */
import { fireEvent, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, test } from 'bun:test';

import { AUTHORIZATION_SCOPES } from '../../lib/scopes.svelte.ts';
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

describe('WorkflowRevisionsPanel', () => {
  test('shows a loading state while queries are pending', async () => {
    scripted = new ScriptedFetch();
    const { getByLabelText } = await renderPanel();
    expect(getByLabelText('Loading revisions')).not.toBeNull();
  });

  test('renders the denied state without workflows:read, and calls no revisions/active operations', async () => {
    scripted = new ScriptedFetch();
    const readOnlyMinusRevisions = AUTHORIZATION_SCOPES.filter(
      (scope) => scope !== 'workflows:read',
    );
    const { findByText } = await renderPanel(readOnlyMinusRevisions);
    expect(await findByText('Requires workflows:read to view installed revisions.')).not.toBeNull();
    const catalogCalls = scripted.calls.filter(
      (call) => typeof call.init?.body === 'string' && call.init.body.includes('weft.workflows.'),
    );
    expect(catalogCalls).toHaveLength(0);
  });

  test('shows the malformed-response state when the revisions payload is not an array', async () => {
    scripted = new ScriptedFetch();
    scripted.routeJsonRpcMethod('weft.workflows.revisions.list', { not: 'an array' });
    scripted.routeJsonRpcMethod(
      'weft.workflows.active.get',
      activePointer('order-processing-rev-1'),
    );
    const { findByText } = await renderPanel();
    expect(await findByText(/revisions list this console doesn't recognize/)).not.toBeNull();
  });

  test('shows the malformed-response state when the array has a mix of valid and malformed records — never a silently partial list', async () => {
    scripted = new ScriptedFetch();
    // Regression: an earlier version filtered per-record, so a malformed
    // entry for the workflow's OWN active revision left every surviving
    // row reading "Installed" (no Active badge) — the array shape is valid
    // JSON, but one entry fails the structural guard, and that alone must
    // make the whole response malformed rather than a plausible-looking
    // partial list.
    scripted.routeJsonRpcMethod('weft.workflows.revisions.list', [
      revisionRecord('order-processing-rev-1'),
      { manifest: 'not-an-object', installedAt: 1 },
    ]);
    scripted.routeJsonRpcMethod(
      'weft.workflows.active.get',
      activePointer('order-processing-rev-1'),
    );
    const { findByText, queryByText } = await renderPanel();
    expect(await findByText(/revisions list this console doesn't recognize/)).not.toBeNull();
    expect(queryByText('Installed')).toBeNull();
    expect(queryByText('Active')).toBeNull();
  });

  test('shows the explicit empty state when no revisions are installed', async () => {
    scripted = new ScriptedFetch();
    scripted.routeJsonRpcMethod('weft.workflows.revisions.list', []);
    scripted.routeJsonRpcError('weft.workflows.active.get', {
      code: -32020,
      message: 'never activated',
      data: { weftCode: 'NotFound', httpStatus: 404 },
    });
    const { findByText } = await renderPanel();
    expect(await findByText('No revisions installed for this workflow yet.')).not.toBeNull();
  });

  test('a revisions.list server fault renders the fault banner with a working retry', async () => {
    scripted = new ScriptedFetch();
    // `MethodNotFound` (-> the 'not-found' treatment) rather than
    // `EngineFailure`: both queries use `query.ts`'s default retry policy
    // (never overridden here, unlike e.g. `mcp-panel.svelte`'s `retry:
    // false`), which retries an `internal`-treatment fault up to 3 times
    // with backoff — genuine production behavior, but multiple seconds of
    // real backoff in a unit test. A non-retrying treatment still exercises
    // exactly the same `{:else if revisionsQuery.isError}` branch this
    // test targets, deterministically and fast.
    scripted.routeJsonRpcError('weft.workflows.revisions.list', {
      code: -32020,
      message: 'weft.workflows.revisions.list is not available on this server',
      data: { weftCode: 'MethodNotFound', httpStatus: 404 },
    });
    scripted.routeJsonRpcMethod(
      'weft.workflows.active.get',
      activePointer('order-processing-rev-1'),
    );
    const { findByText, findByRole } = await renderPanel();
    expect(await findByText('Not found')).not.toBeNull();

    const callsBeforeRetry = scripted.calls.length;
    const retryButton = await findByRole('button', { name: /retry/i });
    await fireEvent.click(retryButton);
    await waitFor(() => {
      expect(scripted?.calls.length).toBeGreaterThan(callsBeforeRetry);
    });
  });

  test('an active.get server fault (not the never-activated NotFound case) renders the fault banner instead of silently hiding the active badge', async () => {
    scripted = new ScriptedFetch();
    scripted.routeJsonRpcMethod('weft.workflows.revisions.list', [
      revisionRecord('order-processing-rev-1'),
    ]);
    // `Forbidden` (-> the 'unauthorized' treatment, non-retrying) rather
    // than `EngineFailure` — see the sibling test above for why a
    // retryable `internal` fault is the wrong choice for a fast, focused
    // unit test of this branch. `activeQuery`'s own catch only special-
    // cases `NotFound`; every other fault code (this one included) falls
    // through to `throw error`, reaching `activeQuery.isError` untouched.
    scripted.routeJsonRpcError('weft.workflows.active.get', {
      code: -32030,
      message: 'Caller lacks workflows:read for this workflow catalog entry',
      data: { weftCode: 'Forbidden', httpStatus: 403 },
    });
    const { findByText, findByRole, queryByText } = await renderPanel();
    expect(await findByText('Not authorized')).not.toBeNull();
    // Never silently falls back to "every row is just Installed" — the
    // fault banner replaces the row list entirely.
    expect(queryByText('Installed')).toBeNull();

    const callsBeforeRetry = scripted.calls.length;
    const retryButton = await findByRole('button', { name: /retry/i });
    await fireEvent.click(retryButton);
    await waitFor(() => {
      expect(scripted?.calls.length).toBeGreaterThan(callsBeforeRetry);
    });
  });

  test('lists installed revisions, flagging exactly one as Active and offering Activate on the rest', async () => {
    scripted = new ScriptedFetch();
    scripted.routeJsonRpcMethod('weft.workflows.revisions.list', [
      revisionRecord('order-processing-rev-1'),
      revisionRecord('order-processing-rev-2'),
    ]);
    scripted.routeJsonRpcMethod(
      'weft.workflows.active.get',
      activePointer('order-processing-rev-1'),
    );

    const { findByText, getByRole } = await renderPanel();
    expect(await findByText('Active')).not.toBeNull();
    expect(await findByText('Installed')).not.toBeNull();
    expect(getByRole('button', { name: 'Refresh' })).not.toBeNull();
    expect(getByRole('button', { name: 'Activate' })).not.toBeNull();
  });

  test('renders "no active revision" when the workflow has never been activated (active.get NotFound)', async () => {
    scripted = new ScriptedFetch();
    scripted.routeJsonRpcMethod('weft.workflows.revisions.list', [
      revisionRecord('order-processing-rev-1'),
    ]);
    scripted.routeJsonRpcError('weft.workflows.active.get', {
      code: -32020,
      message: 'Workflow "order-processing" has never been activated',
      data: { weftCode: 'NotFound', httpStatus: 404, resource: 'workflow-active-revision' },
    });

    const { findByText } = await renderPanel();
    expect(await findByText('No active revision — never activated.')).not.toBeNull();
  });

  test('Activate is disabled-with-reason without workflows:admin — never hidden', async () => {
    scripted = new ScriptedFetch();
    scripted.routeJsonRpcMethod('weft.workflows.revisions.list', [
      revisionRecord('order-processing-rev-1'),
      revisionRecord('order-processing-rev-2'),
    ]);
    scripted.routeJsonRpcMethod(
      'weft.workflows.active.get',
      activePointer('order-processing-rev-1'),
    );

    const readOnly = AUTHORIZATION_SCOPES.filter((scope) => scope !== 'workflows:admin');
    const { getByRole } = await renderPanel(readOnly);
    const activateButton = await waitFor(() => getByRole('button', { name: 'Activate' }));
    expect(activateButton.hasAttribute('disabled')).toBe(true);
    expect(activateButton.getAttribute('title')).toBe('Requires workflows:admin');
  });

  test('a malformed (successful but structurally invalid) active.get response is rejected, not silently treated as never-activated', async () => {
    scripted = new ScriptedFetch();
    scripted.routeJsonRpcMethod('weft.workflows.revisions.list', [
      revisionRecord('order-processing-rev-1'),
    ]);
    // Structurally invalid: missing `generation`/`activatedAt`, so
    // `isWorkflowCatalogActivePointerLike` rejects it — a real, successful
    // response the console cannot trust, distinct from a genuine
    // never-activated `NotFound` fault.
    scripted.routeJsonRpcMethod('weft.workflows.active.get', {
      revision: 'order-processing-rev-1',
    });

    const { findByText, queryByText } = await renderPanel();
    // 'Invalid input' — the panel throws this as an `Unprocessable`-coded
    // `HttpClientError`, not a plain `Error`, specifically so it does NOT
    // hit `query.ts`'s retryable-fault path (see the module's own comment).
    expect(await findByText('Invalid input')).not.toBeNull();
    // Never silently falls back to "no active revision" for a malformed
    // (as opposed to genuinely absent) active pointer.
    expect(queryByText('No active revision — never activated.')).toBeNull();
  });

  // The "Refreshing…" indicator's own condition is covered directly (not
  // through component fetch-timing, which has no reliable observable
  // window against `ScriptedFetch`'s effectively-synchronous responses) by
  // `isBackgroundRefreshing`'s unit tests in `workflow-revisions-view.test.ts`.

  test('when the active pointer names a revision not present in the resolved rows (a cross-query race), an explicit note appears instead of silently understating the active revision', async () => {
    scripted = new ScriptedFetch();
    // `revisionsQuery` and `activeQuery` are independent, unordered
    // fetches — this models the narrow race where the active pointer names
    // a revision this particular `revisions.list` response doesn't
    // include, rather than a malformed record (already covered above).
    scripted.routeJsonRpcMethod('weft.workflows.revisions.list', [
      revisionRecord('order-processing-rev-1'),
    ]);
    scripted.routeJsonRpcMethod(
      'weft.workflows.active.get',
      activePointer('order-processing-rev-missing'),
    );

    const { findByText, queryByText } = await renderPanel();
    expect(
      await findByText(
        "This workflow has an active revision the current list doesn't include yet — refreshing.",
      ),
    ).not.toBeNull();
    // Never silently reads as "never activated" — the pointer IS non-null.
    expect(queryByText('No active revision — never activated.')).toBeNull();
    // No row can honestly claim to be the active one either.
    expect(queryByText('Active')).toBeNull();
  });
});
