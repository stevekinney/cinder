import { requireElement } from '../../../tests/dom-test-support.ts';

/**
 * Component tests for the selectable `weft.catalog.sources.list` surface inside
 * `<DynamicSourcePanel>`: empty and error states, row selection, continuation
 * pagination, malformed payload guards, and later-page recovery copy.
 */
import { fireEvent, render } from '@testing-library/svelte';
import { afterEach, describe, expect, test } from 'bun:test';

import { createQueryClient, queryKeys } from '../../lib/query.ts';
import DynamicSourceListHarness from './dynamic-source-list-fixture.test-harness.svelte';
import { isCatalogSourceListPage, type CatalogSourceListEntry } from './dynamic-source-list.svelte';
import DynamicSourcePanel from './dynamic-source-panel.svelte';
import SystemRouteTestHarness from './system-route-test-harness.test-harness.svelte';
import { parseJsonObject, realClient, ScriptedFetch } from './system-test-support.test-support.ts';

const DIAGNOSTICS = 'weft.catalog.diagnostics';
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
  sources: readonly CatalogSourceListEntry[] = [
    { name: NAME, revision: REVISION, kind: 'module' as const, state: 'idle' as const },
    { name: NAME, revision: SECOND_REVISION, kind: 'module' as const, state: 'ready' as const },
  ],
  nextOffset?: number,
) {
  return { sources, ...(nextOffset === undefined ? {} : { nextOffset }) };
}

async function renderPanel(options?: {
  readonly sourcePage?: unknown;
  readonly routeSourceList?: boolean;
}) {
  const { sourcePage = sourceList(), routeSourceList = true } = options ?? {};
  if (routeSourceList) scripted?.routeJsonRpcMethod(SOURCES_LIST, sourcePage);
  return render(SystemRouteTestHarness, {
    props: {
      client: realClient(),
      queryClient: createQueryClient(),
      component: DynamicSourcePanel,
    },
  });
}

async function renderSourceList(options?: {
  readonly selectedKey?: { readonly name: string; readonly revision: string } | null;
  readonly sourcePage?: unknown;
  readonly queryClient?: ReturnType<typeof createQueryClient>;
  readonly onSelect?: () => void;
}) {
  const {
    selectedKey = null,
    sourcePage = sourceList(),
    queryClient = createQueryClient(),
    onSelect = () => {},
  } = options ?? {};
  scripted?.routeJsonRpcMethod(SOURCES_LIST, sourcePage);
  return render(DynamicSourceListHarness, {
    props: {
      client: realClient(),
      queryClient,
      selectedKey,
      onSelect,
    },
  });
}

function evaluateSourceListRefetchInterval(
  queryClient: ReturnType<typeof createQueryClient>,
): unknown {
  const query = queryClient.getQueryCache().find({
    queryKey: queryKeys.catalog.sources({ limit: 10, offset: 0 }),
    exact: true,
  });
  if (query === undefined) throw new Error('Source list query was not mounted');
  const observer = query.observers[0];
  if (observer === undefined) throw new Error('Source list observer was not mounted');
  const interval = observer.options.refetchInterval;
  return typeof interval === 'function' ? interval(query) : interval;
}

let scripted: ScriptedFetch | undefined;

afterEach(() => {
  scripted?.restore();
  scripted = undefined;
});

describe('DynamicSourcePanel source list', () => {
  test('loads an empty selectable source list without hiding manual lookup', async () => {
    scripted = new ScriptedFetch();
    const { findByText, getByRole } = await renderPanel({ sourcePage: sourceList([]) });

    expect(await findByText('No dynamic sources registered')).not.toBeNull();
    expect(getByRole('button', { name: 'Inspect' })).not.toBeNull();
  });

  test('renders the system:read requirement after a source-list authorization denial', async () => {
    scripted = new ScriptedFetch();
    scripted.routeJsonRpcError(SOURCES_LIST, {
      code: -32000,
      message: 'forbidden',
      data: { httpStatus: 403, weftCode: 'Forbidden' },
    });
    const { findByText } = await renderPanel({ routeSourceList: false });

    expect(await findByText('Requires system:read to list registered sources.')).not.toBeNull();
  });

  test('selects a listed source and inspects that exact key', async () => {
    scripted = new ScriptedFetch();
    scripted.routeJsonRpcMethod(DIAGNOSTICS, idleDiagnostics());
    const { getAllByRole, findByText } = await renderPanel();

    await findByText(JSON.stringify(REVISION));
    await fireEvent.click(getAllByRole('button', { name: 'Select' })[0]!);

    expect(await findByText('Load state: Idle')).not.toBeNull();
    const diagnosticsCall = scripted.calls.find(
      (call) => typeof call.init?.body === 'string' && call.init.body.includes(DIAGNOSTICS),
    );
    const diagnosticsBody = diagnosticsCall?.init?.body;
    if (typeof diagnosticsBody !== 'string') throw new Error('diagnostics request body missing');
    expect(parseJsonObject(diagnosticsBody)?.['params']).toEqual({
      name: NAME,
      revision: REVISION,
    });
  });

  test('shows a malformed-response error and recovers through Retry', async () => {
    scripted = new ScriptedFetch();
    scripted.enqueueJsonRpcResult({ sources: [{ name: NAME, state: 'unknown' }] });
    scripted.enqueueJsonRpcResult(sourceList());
    const queryClient = createQueryClient();
    // Exercise the settled error and operator retry directly; automatic retry
    // policy has its own tests and would otherwise consume the recovery response.
    queryClient.setQueryDefaults(['catalog', 'sources'], { retry: false });
    const { findByText, getByRole } = render(DynamicSourceListHarness, {
      props: { client: realClient(), queryClient, onSelect: () => {} },
    });

    expect(
      await findByText('Something went wrong. Check your connection and try again.'),
    ).not.toBeNull();
    await fireEvent.click(getByRole('button', { name: 'Retry' }));
    expect(await findByText(JSON.stringify(REVISION))).not.toBeNull();
  });

  test('marks the chosen row as selected while preserving the exact lookup key', async () => {
    scripted = new ScriptedFetch();
    const { findByRole, findByText } = await renderSourceList({
      selectedKey: { name: NAME, revision: REVISION },
    });

    await findByText(JSON.stringify(REVISION));

    expect(await findByRole('button', { name: 'Selected' })).not.toBeNull();
  });

  test('keeps a first page without a continuation on the same page when Next is clicked', async () => {
    scripted = new ScriptedFetch();
    const { getByRole, findByText } = await renderSourceList({
      sourcePage: sourceList([{ name: NAME, revision: REVISION, kind: 'module', state: 'idle' }]),
    });

    await findByText(JSON.stringify(REVISION));
    const nextButton = requireElement(getByRole('button', { name: 'Next' }), HTMLButtonElement);
    expect(nextButton.disabled).toBe(true);
    await fireEvent.click(nextButton);

    expect(getByRole('button', { name: 'Next' })).toBe(nextButton);
    const listCalls = scripted.calls.filter(
      (call) => typeof call.init?.body === 'string' && call.init.body.includes(SOURCES_LIST),
    );
    expect(listCalls).toHaveLength(1);
  });

  test('polls source-list state slowly when every listed source is settled', async () => {
    scripted = new ScriptedFetch();
    const queryClient = createQueryClient();
    const { findByText } = await renderSourceList({ queryClient });

    await findByText(JSON.stringify(REVISION));

    expect(evaluateSourceListRefetchInterval(queryClient)).toBe(30_000);
  });

  test('polls source-list state quickly while any listed source is loading', async () => {
    scripted = new ScriptedFetch();
    const queryClient = createQueryClient();
    const { findByText } = await renderSourceList({
      queryClient,
      sourcePage: sourceList([
        { name: NAME, revision: REVISION, kind: 'module', state: 'loading' },
      ]),
    });

    await findByText(JSON.stringify(REVISION));

    expect(evaluateSourceListRefetchInterval(queryClient)).toBe(2_000);
  });

  test('hides stale previous-page rows while the next source page is loading', async () => {
    scripted = new ScriptedFetch();
    scripted.enqueueJsonRpcResult(
      sourceList([{ name: NAME, revision: REVISION, kind: 'module', state: 'idle' }], 10),
    );
    const { getByRole, findByText, queryByText, queryByTitle } = await renderPanel({
      routeSourceList: false,
    });

    await findByText(JSON.stringify(REVISION));

    let releaseNextPage!: () => void;
    const nextPage = new Promise<void>((resolve) => {
      releaseNextPage = resolve;
    });
    scripted.routeJsonRpcDeferred(
      SOURCES_LIST,
      nextPage.then(() => ({
        sources: [{ name: 'zeta', revision: 'r9', kind: 'module', state: 'idle' }],
      })),
    );

    await fireEvent.click(getByRole('button', { name: 'Next' }));

    const staleSelect = queryByTitle(`Select ${NAME} at revision ${JSON.stringify(REVISION)}`);
    const loadingText = queryByText('Loading sources…');
    const previousDisabled = requireElement(
      getByRole('button', { name: 'Previous' }),
      HTMLButtonElement,
    ).disabled;
    const nextDisabled = requireElement(
      getByRole('button', { name: 'Next' }),
      HTMLButtonElement,
    ).disabled;

    releaseNextPage();
    expect(await findByText('"r9"')).not.toBeNull();

    expect(staleSelect).toBeNull();
    expect(loadingText).not.toBeNull();
    expect(previousDisabled).toBe(true);
    expect(nextDisabled).toBe(true);
  });

  test('loads the next source page using the server continuation offset', async () => {
    scripted = new ScriptedFetch();
    scripted.enqueueJsonRpcResult(
      sourceList([{ name: NAME, revision: REVISION, kind: 'module', state: 'idle' }], 10),
    );
    scripted.enqueueJsonRpcResult({
      sources: [{ name: 'zeta', revision: 'r9', kind: 'module', state: 'idle' }],
    });
    const { getByRole, findByText } = await renderPanel({ routeSourceList: false });

    await findByText(JSON.stringify(REVISION));
    await fireEvent.click(getByRole('button', { name: 'Next' }));

    expect(await findByText('"r9"')).not.toBeNull();
    const listCalls = scripted.calls.filter(
      (call) => typeof call.init?.body === 'string' && call.init.body.includes(SOURCES_LIST),
    );
    const listBody = listCalls.at(-1)?.init?.body;
    if (typeof listBody !== 'string') throw new Error('source list request body missing');
    expect(parseJsonObject(listBody)?.['params']).toEqual({
      limit: 10,
      offset: 10,
    });
  });

  test('shows page recovery copy for an empty later source page', async () => {
    scripted = new ScriptedFetch();
    scripted.enqueueJsonRpcResult(
      sourceList([{ name: NAME, revision: REVISION, kind: 'module', state: 'idle' }], 10),
    );
    scripted.enqueueJsonRpcResult(sourceList([]));
    const { getByRole, findByText } = await renderPanel({ routeSourceList: false });

    await findByText(JSON.stringify(REVISION));
    await fireEvent.click(getByRole('button', { name: 'Next' }));

    expect(await findByText('No sources on this page')).not.toBeNull();
    expect(
      requireElement(getByRole('button', { name: 'Previous' }), HTMLButtonElement).disabled,
    ).toBe(false);
    await fireEvent.click(getByRole('button', { name: 'Previous' }));
    expect(await findByText(JSON.stringify(REVISION))).not.toBeNull();
  });

  test('rejects malformed source states at the response boundary', () => {
    expect(
      isCatalogSourceListPage(
        { sources: [{ name: NAME, revision: REVISION, kind: 'module', state: ['idle'] }] },
        0,
      ),
    ).toBe(false);
  });

  test('rejects non-advancing and unsafe continuation offsets at the response boundary', () => {
    const page = { sources: [{ name: NAME, revision: REVISION, kind: 'module', state: 'idle' }] };

    expect(isCatalogSourceListPage({ ...page, nextOffset: 0 }, 0)).toBe(false);
    expect(isCatalogSourceListPage({ ...page, nextOffset: Number.MAX_SAFE_INTEGER + 1 }, 0)).toBe(
      false,
    );
  });
});
