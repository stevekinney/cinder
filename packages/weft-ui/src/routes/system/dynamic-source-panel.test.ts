import { requireElement } from '../../../tests/dom-test-support.ts';

/**
 * Component tests for `<DynamicSourcePanel>` (WFT-116): the lookup form's
 * empty/stale states, the `workflows:admin` gate on Preload, concurrent-
 * submission deduplication, every preload outcome the bounded fault set
 * produces, and the query invalidation each outcome performs.
 */
import { fireEvent, render, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, test } from 'bun:test';

import { createQueryClient } from '../../lib/query.ts';
import { AUTHORIZATION_SCOPES } from '../../lib/scopes.svelte.ts';
import DynamicSourcePanel from './dynamic-source-panel.svelte';
import SystemRouteTestHarness from './system-route-test-harness.test-harness.svelte';
import { realClient, ScriptedFetch } from './system-test-support.test-support.ts';

const DIAGNOSTICS = 'weft.catalog.diagnostics';
const PRELOAD = 'weft.workflows.revisions.preload';
const SOURCES_LIST = 'weft.catalog.sources.list';

const NAME = 'invoice-reconciliation';
const REVISION = 'invoice-reconciliation-r1';
const SECOND_REVISION = 'invoice-reconciliation-r2';

function idleDiagnostics() {
  return {
    name: NAME,
    revision: REVISION,
    installed: false,
    active: false,
    references: {},
    removable: false,
    source: { kind: 'module', requestedRevision: REVISION, state: 'idle', waiterCount: 0 },
  };
}

function sourceList(
  sources = [
    { name: NAME, revision: REVISION, kind: 'module' as const, state: 'idle' as const },
    { name: NAME, revision: SECOND_REVISION, kind: 'module' as const, state: 'ready' as const },
  ],
  nextOffset?: number,
) {
  return { sources, ...(nextOffset === undefined ? {} : { nextOffset }) };
}

async function renderPanel(options?: {
  readonly principalScopes?: readonly (typeof AUTHORIZATION_SCOPES)[number][];
  readonly sourcePage?: unknown;
  readonly routeSourceList?: boolean;
}) {
  const { principalScopes, sourcePage = sourceList(), routeSourceList = true } = options ?? {};
  if (routeSourceList) scripted?.routeJsonRpcMethod(SOURCES_LIST, sourcePage);
  return render(SystemRouteTestHarness, {
    props: {
      client: realClient(),
      queryClient: createQueryClient(),
      component: DynamicSourcePanel,
      ...(principalScopes === undefined ? {} : { principalScopes }),
    },
  });
}

/** Fills both inputs and submits the lookup, leaving the result region rendered. */
async function inspect(
  container: HTMLElement,
  getByRole: (role: string, options: { name: string | RegExp }) => HTMLElement,
  name = NAME,
  revision = REVISION,
): Promise<void> {
  const nameInput = container.querySelector('#weft-dynamic-source-name');
  const revisionInput = container.querySelector('#weft-dynamic-source-revision');
  if (!(nameInput instanceof HTMLInputElement) || !(revisionInput instanceof HTMLInputElement)) {
    throw new Error('lookup inputs not rendered');
  }
  await fireEvent.input(nameInput, { target: { value: name } });
  await fireEvent.input(revisionInput, { target: { value: revision } });
  await fireEvent.click(getByRole('button', { name: 'Inspect' }));
}

let scripted: ScriptedFetch | undefined;

afterEach(() => {
  scripted?.restore();
  scripted = undefined;
});

describe('DynamicSourcePanel', () => {
  test('starts empty, explaining that both fields are required and why', async () => {
    scripted = new ScriptedFetch();
    const { findByText, getByRole } = await renderPanel();

    expect(await findByText(/No source inspected yet/)).not.toBeNull();
    expect(
      requireElement(getByRole('button', { name: 'Inspect' }), HTMLButtonElement).disabled,
    ).toBe(true);
  });

  test('renders the submitted key’s diagnostics after Inspect', async () => {
    scripted = new ScriptedFetch();
    scripted.routeJsonRpcMethod(DIAGNOSTICS, idleDiagnostics());
    const { container, getByRole, findByText } = await renderPanel();

    await inspect(container, getByRole);
    expect(await findByText('Load state: Idle')).not.toBeNull();
  });

  test('flags the rendered result as stale once the inputs no longer match it', async () => {
    scripted = new ScriptedFetch();
    scripted.routeJsonRpcMethod(DIAGNOSTICS, idleDiagnostics());
    const { container, getByRole, findByText } = await renderPanel();

    await inspect(container, getByRole);
    await findByText('Load state: Idle');

    const revisionInput = container.querySelector('#weft-dynamic-source-revision');
    if (!(revisionInput instanceof HTMLInputElement)) throw new Error('revision input missing');
    await fireEvent.input(revisionInput, { target: { value: 'something-else' } });

    expect(await findByText(/Showing the last inspected key/)).not.toBeNull();
  });

  test('disables Preload without workflows:admin', async () => {
    scripted = new ScriptedFetch();
    scripted.routeJsonRpcMethod(DIAGNOSTICS, idleDiagnostics());
    const withoutAdmin = AUTHORIZATION_SCOPES.filter((scope) => scope !== 'workflows:admin');
    const { container, getByRole, findByText } = await renderPanel({
      principalScopes: withoutAdmin,
    });

    await inspect(container, getByRole);
    await findByText('Load state: Idle');

    expect(
      requireElement(getByRole('button', { name: 'Preload' }), HTMLButtonElement).disabled,
    ).toBe(true);
  });

  test('reports a successful preload and invalidates the catalog queries', async () => {
    scripted = new ScriptedFetch();
    scripted.routeJsonRpcMethod(DIAGNOSTICS, idleDiagnostics());
    scripted.routeJsonRpcMethod(PRELOAD, {
      manifest: { revision: REVISION, name: NAME },
      installedAt: 1_700_000_000_000,
    });
    const { container, getByRole, findByText } = await renderPanel();

    await inspect(container, getByRole);
    await findByText('Load state: Idle');
    await fireEvent.click(getByRole('button', { name: 'Preload' }));

    expect(await findByText(/is installed in the workflow catalog/)).not.toBeNull();
    expect(await findByText(/describe the responding engine process/)).not.toBeNull();
    // The diagnostics key is invalidated on every settled outcome, so the
    // operation is called again after the mutation resolves.
    await waitFor(() => {
      const diagnosticsCalls = (scripted?.calls ?? []).filter(
        (call) => typeof call.init?.body === 'string' && call.init.body.includes(DIAGNOSTICS),
      );
      expect(diagnosticsCalls.length).toBeGreaterThan(1);
    });
    await waitFor(() => {
      const listCalls = (scripted?.calls ?? []).filter(
        (call) => typeof call.init?.body === 'string' && call.init.body.includes(SOURCES_LIST),
      );
      expect(listCalls.length).toBeGreaterThan(1);
    });
  });

  test('deduplicates concurrent submissions by disabling the control while pending', async () => {
    scripted = new ScriptedFetch();
    scripted.routeJsonRpcMethod(DIAGNOSTICS, idleDiagnostics());
    const response = Promise.withResolvers<unknown>();
    scripted.routeJsonRpcDeferred(PRELOAD, response.promise);
    const { container, getByRole, findByText } = await renderPanel();

    await inspect(container, getByRole);
    await findByText('Load state: Idle');

    const button = requireElement(getByRole('button', { name: 'Preload' }), HTMLButtonElement);
    try {
      await fireEvent.click(button);
      await waitFor(() => expect(button).toBeDisabled());
      await fireEvent.click(button);
      await fireEvent.click(button);
      expect(
        scripted.calls.filter(
          (call) => typeof call.init?.body === 'string' && call.init.body.includes(PRELOAD),
        ),
      ).toHaveLength(1);
    } finally {
      response.resolve({
        manifest: { revision: REVISION, name: NAME },
        installedAt: 1,
      });
    }

    await findByText(/is installed in the workflow catalog/);
    const preloadCalls = scripted.calls.filter(
      (call) => typeof call.init?.body === 'string' && call.init.body.includes(PRELOAD),
    );
    expect(preloadCalls).toHaveLength(1);
  });

  test('explains a NotFound refusal for a key with no registered source', async () => {
    scripted = new ScriptedFetch();
    scripted.routeJsonRpcMethod(DIAGNOSTICS, idleDiagnostics());
    scripted.routeJsonRpcError(PRELOAD, {
      code: -32000,
      message: 'no source',
      data: { httpStatus: 404, weftCode: 'NotFound', resource: 'workflow-source' },
    });
    const { container, getByRole, findByText } = await renderPanel();

    await inspect(container, getByRole);
    await findByText('Load state: Idle');
    await fireEvent.click(getByRole('button', { name: 'Preload' }));

    expect(await findByText(/No dynamic workflow source is registered/)).not.toBeNull();
  });

  test('revokes workflows:admin locally when a preload is forbidden, so the control stops inviting it', async () => {
    scripted = new ScriptedFetch();
    scripted.routeJsonRpcMethod(DIAGNOSTICS, idleDiagnostics());
    scripted.routeJsonRpcError(PRELOAD, {
      code: -32000,
      message: 'forbidden',
      data: { httpStatus: 403, weftCode: 'Forbidden' },
    });
    const { container, getByRole, findByText } = await renderPanel();

    await inspect(container, getByRole);
    await findByText('Load state: Idle');
    expect(
      requireElement(getByRole('button', { name: 'Preload' }), HTMLButtonElement).disabled,
    ).toBe(false);

    await fireEvent.click(getByRole('button', { name: 'Preload' }));
    await findByText(/not allowed to preload workflow revisions/);

    // Without the local revoke, `adminGate` stays enabled and keeps inviting a
    // request the server will reject for the rest of the session.
    await waitFor(() => {
      expect(
        requireElement(getByRole('button', { name: 'Preload' }), HTMLButtonElement).disabled,
      ).toBe(true);
    });
  });

  test('renders a load-failed conflict with its bounded reason and no invented cause', async () => {
    scripted = new ScriptedFetch();
    scripted.routeJsonRpcMethod(DIAGNOSTICS, idleDiagnostics());
    scripted.routeJsonRpcError(PRELOAD, {
      code: -32000,
      message: 'failed to load',
      data: { httpStatus: 409, weftCode: 'Conflict', reason: 'load-failed' },
    });
    const { container, getByRole, findByText } = await renderPanel();

    await inspect(container, getByRole);
    await findByText('Load state: Idle');
    await fireEvent.click(getByRole('button', { name: 'Preload' }));

    expect(await findByText('Refused: load-failed')).not.toBeNull();
    expect(await findByText(/bounded failure category/)).not.toBeNull();
  });

  test('lists every source-validation reason a validation-failed conflict carries', async () => {
    scripted = new ScriptedFetch();
    scripted.routeJsonRpcMethod(DIAGNOSTICS, idleDiagnostics());
    scripted.routeJsonRpcError(PRELOAD, {
      code: -32000,
      message: 'invalid',
      data: {
        httpStatus: 409,
        weftCode: 'Conflict',
        reason: 'validation-failed',
        sourceValidationReasons: ['missing-export', 'artifact-revision-mismatch'],
      },
    });
    const { container, getByRole, findByText } = await renderPanel();

    await inspect(container, getByRole);
    await findByText('Load state: Idle');
    await fireEvent.click(getByRole('button', { name: 'Preload' }));

    expect(await findByText(/missing-export/)).not.toBeNull();
    expect(await findByText(/artifact-revision-mismatch/)).not.toBeNull();
  });
});
