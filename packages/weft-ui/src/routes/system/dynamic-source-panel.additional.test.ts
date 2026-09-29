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

describe('additional coverage', () => {
  test('reports a rejected InvalidParams mutation with the field the server named', async () => {
    scripted = new ScriptedFetch();
    scripted.routeJsonRpcMethod(DIAGNOSTICS, idleDiagnostics());
    scripted.routeJsonRpcError(PRELOAD, {
      code: -32602,
      message: 'Field "revision" must be a non-empty string',
      data: { httpStatus: 400, weftCode: 'InvalidParams' },
    });
    const { container, getByRole, findByText } = await renderPanel();

    await inspect(container, getByRole);
    await findByText('Load state: Idle');
    await fireEvent.click(getByRole('button', { name: 'Preload' }));

    expect(await findByText(/Field "revision"/)).not.toBeNull();
  });

  test('reports a server fault without claiming the revision installed', async () => {
    scripted = new ScriptedFetch();
    scripted.routeJsonRpcMethod(DIAGNOSTICS, idleDiagnostics());
    scripted.routeJsonRpcError(PRELOAD, {
      code: -32000,
      message: 'internal error',
      data: { httpStatus: 500, weftCode: 'EngineFailure' },
    });
    const { container, getByRole, findByText } = await renderPanel();

    await inspect(container, getByRole);
    await findByText('Load state: Idle');
    await fireEvent.click(getByRole('button', { name: 'Preload' }));

    expect(await findByText(/could not preload/)).not.toBeNull();
  });

  test('never renders a preload outcome under a different key’s identity badges', async () => {
    // Regression guard: `onSuccess` used to write the outcome unconditionally.
    // An operator can inspect a different key while a preload is still in
    // flight, and the earlier key's outcome would then land under the new
    // key's badges, reading as a result for a revision never preloaded.
    scripted = new ScriptedFetch();
    scripted.routeJsonRpcMethod(DIAGNOSTICS, idleDiagnostics());

    // Hold the preload open until the test releases it, so the key can be
    // switched while it is genuinely in flight.
    let releasePreload!: () => void;
    const preloadHeld = new Promise<void>((resolve) => {
      releasePreload = resolve;
    });
    scripted.routeJsonRpcDeferred(
      PRELOAD,
      preloadHeld.then(() => ({
        manifest: { revision: REVISION, name: NAME },
        installedAt: 1,
      })),
    );

    const { container, getByRole, findByText, queryByText } = await renderPanel();

    await inspect(container, getByRole);
    await findByText('Load state: Idle');
    await fireEvent.click(getByRole('button', { name: 'Preload' }));

    // The initial diagnostics response is idle. Starting this slow preload
    // must still switch the mounted query to the fast cadence immediately,
    // otherwise it would wait the settled 30-second interval before seeing
    // the server's loading state. The third call proves the 2-second cadence,
    // rather than only the immediate refresh.
    await waitFor(
      () => {
        const diagnosticsCalls = scripted!.calls.filter(
          (call) => typeof call.init?.body === 'string' && call.init.body.includes(DIAGNOSTICS),
        );
        expect(diagnosticsCalls.length).toBeGreaterThan(2);
      },
      { timeout: 2_500 },
    );

    // Switch to a different revision while the first preload is unresolved.
    await inspect(container, getByRole, NAME, 'a-different-revision');
    await findByText('Load state: Idle');

    const preloadButton = () =>
      requireElement(getByRole('button', { name: /Preload/ }), HTMLButtonElement);
    expect(preloadButton().disabled).toBe(true);

    releasePreload();

    // Wait for PROOF the mutation settled, not merely for a quiet moment: an
    // `expect(...).toBeNull()` inside `waitFor` passes on its very first
    // check, before a late write could possibly have landed, which would make
    // this test vacuous (it did, in an earlier revision of it). `onSettled`
    // clears the in-flight key, re-enabling the button — an observable edge
    // that fires on both the fixed and the broken code, so the outcome
    // assertion below is what actually distinguishes them.
    //
    // The settled key's diagnostics invalidation is NOT a usable signal here:
    // that query is no longer mounted, and TanStack Query does not refetch an
    // inactive key on invalidation.
    await waitFor(() => {
      expect(preloadButton().disabled).toBe(false);
    });

    // The settled outcome belongs to the FIRST key, which is no longer shown.
    expect(queryByText(/is installed in the workflow catalog/)).toBeNull();
  });

  test('round-trips an opaque CR/LF revision through the escaped JSON-string mode', async () => {
    scripted = new ScriptedFetch();
    scripted.routeJsonRpcMethod(DIAGNOSTICS, idleDiagnostics());
    scripted.routeJsonRpcMethod(PRELOAD, { manifest: { revision: 'line\r\nrevision' } });
    const { container, getByRole, findByText } = await renderPanel();

    const nameInput = container.querySelector('#weft-dynamic-source-name');
    const revisionInput = container.querySelector('#weft-dynamic-source-revision');
    const escapedRevision = '"line\\r\\nrevision"';
    if (!(nameInput instanceof HTMLInputElement) || !(revisionInput instanceof HTMLInputElement)) {
      throw new Error('lookup inputs not rendered');
    }
    await fireEvent.input(nameInput, { target: { value: NAME } });
    await fireEvent.click(container.querySelector('#weft-dynamic-source-revision-json')!);
    await fireEvent.input(revisionInput, { target: { value: escapedRevision } });
    await fireEvent.click(getByRole('button', { name: 'Inspect' }));

    expect(await findByText('Load state: Idle')).not.toBeNull();
    const diagnosticsCall = scripted.calls.find(
      (call) => typeof call.init?.body === 'string' && call.init.body.includes(DIAGNOSTICS),
    );
    const diagnosticsBody = diagnosticsCall?.init?.body;
    if (typeof diagnosticsBody !== 'string') throw new Error('diagnostics body missing');
    expect(JSON.parse(diagnosticsBody).params.revision).toBe('line\r\nrevision');
    await fireEvent.click(getByRole('button', { name: 'Preload' }));
    await findByText(/is installed in the workflow catalog/);
    const preloadCall = scripted.calls.find(
      (call) => typeof call.init?.body === 'string' && call.init.body.includes(PRELOAD),
    );
    const preloadBody = preloadCall?.init?.body;
    if (typeof preloadBody !== 'string') throw new Error('preload body missing');
    expect(JSON.parse(preloadBody).params.revision).toBe('line\r\nrevision');
  });

  test('selects an opaque CR/LF revision without normalizing the key', async () => {
    const opaqueRevision = 'line\r\nrevision';
    scripted = new ScriptedFetch();
    scripted.routeJsonRpcMethod(DIAGNOSTICS, idleDiagnostics());
    const { container, getByRole, findByText } = await renderPanel({
      sourcePage: sourceList([
        { name: NAME, revision: opaqueRevision, kind: 'module', state: 'idle' },
      ]),
    });

    await findByText(JSON.stringify(opaqueRevision));
    await fireEvent.click(getByRole('button', { name: 'Select' }));

    const revisionInput = container.querySelector('#weft-dynamic-source-revision');
    const jsonCheckbox = container.querySelector('#weft-dynamic-source-revision-json');
    if (
      !(revisionInput instanceof HTMLInputElement) ||
      !(jsonCheckbox instanceof HTMLInputElement)
    ) {
      throw new Error('lookup controls not rendered');
    }
    expect(jsonCheckbox.checked).toBe(true);
    expect(revisionInput.value).toBe(JSON.stringify(opaqueRevision));
    const diagnosticsCall = scripted.calls.find(
      (call) => typeof call.init?.body === 'string' && call.init.body.includes(DIAGNOSTICS),
    );
    const diagnosticsBody = diagnosticsCall?.init?.body;
    if (typeof diagnosticsBody !== 'string') throw new Error('diagnostics body missing');
    expect(JSON.parse(diagnosticsBody).params.revision).toBe(opaqueRevision);
  });

  test.each(['not JSON', '42', 'null', '""'])(
    'does not submit an invalid or empty JSON-string revision: %s',
    async (revision) => {
      scripted = new ScriptedFetch();
      const { container, getByRole } = await renderPanel();
      await fireEvent.click(container.querySelector('#weft-dynamic-source-revision-json')!);
      await inspect(container, getByRole, NAME, revision);
      expect(
        requireElement(getByRole('button', { name: 'Inspect' }), HTMLButtonElement).disabled,
      ).toBe(true);
      expect(
        scripted.calls.filter(
          (call) =>
            typeof call.init?.body === 'string' &&
            (call.init.body.includes(DIAGNOSTICS) || call.init.body.includes(PRELOAD)),
        ),
      ).toHaveLength(0);
    },
  );

  test('clears a previous outcome when a different key is inspected', async () => {
    scripted = new ScriptedFetch();
    scripted.routeJsonRpcMethod(DIAGNOSTICS, idleDiagnostics());
    scripted.routeJsonRpcError(PRELOAD, {
      code: -32000,
      message: 'failed to load',
      data: { httpStatus: 409, weftCode: 'Conflict', reason: 'load-failed' },
    });
    const { container, getByRole, findByText, queryByText } = await renderPanel();

    await inspect(container, getByRole);
    await findByText('Load state: Idle');
    await fireEvent.click(getByRole('button', { name: 'Preload' }));
    await findByText('Refused: load-failed');

    await inspect(container, getByRole, NAME, 'another-revision');
    await waitFor(() => {
      expect(queryByText('Refused: load-failed')?.outerHTML ?? null).toBeNull();
    });
  });
});
