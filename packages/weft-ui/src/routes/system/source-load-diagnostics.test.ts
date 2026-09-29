/**
 * Component tests for `<SourceLoadDiagnostics>` (WFT-116): the per-`(name,
 * revision)` `weft.catalog.diagnostics` query and every state it can
 * render — loading, `system:read`-denied, each bounded load state, the
 * not-a-dynamic-source case, a malformed response, and a server fault.
 */
import { render } from '@testing-library/svelte';
import { afterEach, describe, expect, test } from 'bun:test';

import { createQueryClient } from '../../lib/query.ts';
import { AUTHORIZATION_SCOPES } from '../../lib/scopes.svelte.ts';
import SourceLoadDiagnosticsFixture from './source-load-diagnostics-fixture.test-harness.svelte';
import SystemRouteTestHarness from './system-route-test-harness.test-harness.svelte';
import { realClient, ScriptedFetch } from './system-test-support.test-support.ts';

const OPERATION = 'weft.catalog.diagnostics';

function diagnosticsResponse(source?: Record<string, unknown>) {
  return {
    name: 'invoice-reconciliation',
    revision: 'invoice-reconciliation-r1',
    installed: source?.['state'] === 'ready',
    active: false,
    references: {},
    removable: false,
    ...(source === undefined ? {} : { source }),
  };
}

async function renderDiagnostics(
  principalScopes?: readonly (typeof AUTHORIZATION_SCOPES)[number][],
) {
  return render(SystemRouteTestHarness, {
    props: {
      client: realClient(),
      queryClient: createQueryClient(),
      component: SourceLoadDiagnosticsFixture,
      ...(principalScopes === undefined ? {} : { principalScopes }),
    },
  });
}

let scripted: ScriptedFetch | undefined;

afterEach(() => {
  scripted?.restore();
  scripted = undefined;
});

describe('SourceLoadDiagnostics', () => {
  test('shows a loading state while the diagnostics query is pending', async () => {
    scripted = new ScriptedFetch();
    const { findByText } = await renderDiagnostics();
    expect(await findByText('Loading diagnostics…')).not.toBeNull();
  });

  test('renders the denied state without system:read, and never calls the operation', async () => {
    scripted = new ScriptedFetch();
    const withoutSystemRead = AUTHORIZATION_SCOPES.filter((scope) => scope !== 'system:read');
    const { findByText } = await renderDiagnostics(withoutSystemRead);

    expect(await findByText('Requires system:read to view load diagnostics.')).not.toBeNull();
    const diagnosticsCalls = scripted.calls.filter(
      (call) => typeof call.init?.body === 'string' && call.init.body.includes(OPERATION),
    );
    expect(diagnosticsCalls).toHaveLength(0);
  });

  test('renders a ready source with its duration, waiter count, and source kind', async () => {
    scripted = new ScriptedFetch();
    scripted.routeJsonRpcMethod(
      OPERATION,
      diagnosticsResponse({
        kind: 'module',
        requestedRevision: 'invoice-reconciliation-r1',
        state: 'ready',
        loadDurationMs: 2_500,
        waiterCount: 0,
      }),
    );
    const { findByText } = await renderDiagnostics();

    expect(await findByText('Load state: Ready')).not.toBeNull();
    expect(await findByText('2s')).not.toBeNull();
    expect(await findByText('0 callers waiting')).not.toBeNull();
    expect(await findByText('module')).not.toBeNull();
    expect(await findByText('None recorded')).not.toBeNull();
  });

  test('renders an idle source with no fabricated zero duration', async () => {
    scripted = new ScriptedFetch();
    scripted.routeJsonRpcMethod(
      OPERATION,
      diagnosticsResponse({
        kind: 'module',
        requestedRevision: 'invoice-reconciliation-r1',
        state: 'idle',
        waiterCount: 0,
      }),
    );
    const { findByText } = await renderDiagnostics();

    expect(await findByText('Load state: Idle')).not.toBeNull();
    expect(await findByText('Not loaded yet')).not.toBeNull();
  });

  test('says plainly that an in-flight load is server-side and cannot be cancelled from here', async () => {
    scripted = new ScriptedFetch();
    scripted.routeJsonRpcMethod(
      OPERATION,
      diagnosticsResponse({
        kind: 'module',
        requestedRevision: 'invoice-reconciliation-r1',
        state: 'loading',
        waiterCount: 3,
      }),
    );
    const { findByText } = await renderDiagnostics();

    expect(await findByText('Load state: Loading')).not.toBeNull();
    expect(await findByText('3 callers waiting')).not.toBeNull();
    expect(await findByText(/console cannot cancel it/)).not.toBeNull();
    expect(await findByText('In flight')).not.toBeNull();
  });

  test('surfaces the bounded failure category of a failed load with its explanation', async () => {
    scripted = new ScriptedFetch();
    scripted.routeJsonRpcMethod(
      OPERATION,
      diagnosticsResponse({
        kind: 'module',
        requestedRevision: 'invoice-reconciliation-r1',
        state: 'failed',
        loadDurationMs: 40,
        lastFailureCategory: 'resource',
        waiterCount: 0,
      }),
    );
    const { findByText } = await renderDiagnostics();

    expect(await findByText('Load state: Failed')).not.toBeNull();
    expect(await findByText(/Last failure category:/)).not.toBeNull();
    // The category's canonical meaning, not a load-specific gloss on it.
    expect(await findByText(/quota, memory, disk, or capacity limit/)).not.toBeNull();
  });

  test('renders a cancelled load as a first-class state', async () => {
    scripted = new ScriptedFetch();
    scripted.routeJsonRpcMethod(
      OPERATION,
      diagnosticsResponse({
        kind: 'module',
        requestedRevision: 'invoice-reconciliation-r1',
        state: 'cancelled',
        lastFailureCategory: 'cancellation',
        waiterCount: 0,
      }),
    );
    const { findByText } = await renderDiagnostics();

    expect(await findByText('Load state: Cancelled')).not.toBeNull();
    expect(await findByText(/may still be running/)).not.toBeNull();
  });

  test('states that an installed revision has no dynamic source, without claiming how it was registered', async () => {
    scripted = new ScriptedFetch();
    scripted.routeJsonRpcMethod(OPERATION, {
      name: 'order-processing',
      revision: 'order-processing-rev-1',
      installed: true,
      active: true,
      references: {},
      removable: false,
    });
    const { findByText } = await renderDiagnostics();

    expect(
      await findByText(
        'No dynamic source is registered for this workflow. This revision is installed in the catalog.',
      ),
    ).not.toBeNull();
  });

  test('shows the malformed-response state rather than guessing at an unrecognized payload', async () => {
    scripted = new ScriptedFetch();
    scripted.routeJsonRpcMethod(OPERATION, { unexpected: 'shape' });
    const { findByText } = await renderDiagnostics();

    expect(await findByText(/load diagnostics this console doesn't recognize/)).not.toBeNull();
  });

  test('renders a server fault through the shared fault banner', async () => {
    scripted = new ScriptedFetch();
    // A non-retryable fault that is NOT Forbidden: `EngineFailure` would still
    // be inside `shouldRetryQuery`'s backoff at assertion time, and `Forbidden`
    // now degrades to the denied state instead (see the next test).
    scripted.routeJsonRpcError(OPERATION, {
      code: -32602,
      message: 'Field "revision" must be a non-empty string',
      data: { httpStatus: 400, weftCode: 'InvalidParams' },
    });
    const { findByRole } = await renderDiagnostics();

    expect(await findByRole('alert')).not.toBeNull();
  });

  test('degrades to the denied state when system:read is revoked mid-session', async () => {
    // A 403 on a POLLING query must revoke the local scope rather than render a
    // fault banner and keep polling: TanStack Query keeps the last good data,
    // so the data-driven interval would stay armed and re-issue a denied
    // request every 2 or 30 seconds forever.
    scripted = new ScriptedFetch();
    scripted.routeJsonRpcError(OPERATION, {
      code: -32000,
      message: 'forbidden',
      data: { httpStatus: 403, weftCode: 'Forbidden' },
    });
    const { findByText } = await renderDiagnostics();

    expect(await findByText('Requires system:read to view load diagnostics.')).not.toBeNull();
  });
});
