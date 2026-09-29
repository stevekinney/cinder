/**
 * Component tests for `<HealthTab>` (plan §9.7 T7.5). Covers the honest
 * lease-not-available note, retention rendering, the recover-all Tier-2
 * confirm flow, and the codegen preview.
 */
import { fireEvent, render } from '@testing-library/svelte';
import { afterEach, describe, expect, test } from 'bun:test';

import ToastHost from '../../app/toast-host.svelte';
import { createQueryClient } from '../../lib/query.ts';
import HealthTab from './health-tab.svelte';
import SystemRouteTestHarness from './system-route-test-harness.test-harness.svelte';
import { realClient, ScriptedFetch } from './system-test-support.test-support.ts';

let scripted: ScriptedFetch | undefined;

afterEach(() => {
  scripted?.restore();
  scripted = undefined;
});

function routeBaseline(fetch: ScriptedFetch): void {
  fetch.routeUrl('/retention', {
    defaultRetention: null,
    sweepIntervalMs: 300000,
    sweepBatchSize: 1000,
    nextSweepAt: null,
    workflowTypes: [],
  });
  fetch.routeJsonRpcMethod('weft.system.registry', {
    registryVersion: 2,
    generatedAt: '2026-01-01T00:00:00.000Z',
    workflows: [
      {
        manifestVersion: 1,
        name: 'order-processing',
        workflowVersion: '1.0.0',
        revision: 'order-processing-rev',
        contractHash: 'order-processing-hash',
        contract: {
          name: 'order-processing',
          workflowVersion: '1.0.0',
          inputSchema: {
            type: 'object',
            required: ['orderId'],
            properties: { orderId: { type: 'string' } },
          },
        },
      },
    ],
    activeRevisions: { 'order-processing': 'order-processing-rev' },
    activities: {},
  });
}

/**
 * Every test in this file mounts its own `HealthTab`, which owns two
 * concurrent `createQuery`s (registry + retention) and a `createMutation`.
 * Callers explicitly `unmount()` at the end of each test (on top of
 * `@testing-library/svelte`'s own global `afterEach(cleanup)`) to guarantee
 * this test's in-flight query/mutation machinery is torn down before the
 * next test installs a fresh `ScriptedFetch` — without it, a still-settling
 * promise from one test's component occasionally resolved during the next
 * test's run and read from the wrong (already-restored) fetch mock, an
 * intermittent cross-test flake observed empirically.
 */
async function renderHealthTab() {
  return render(SystemRouteTestHarness, {
    props: { client: realClient(), queryClient: createQueryClient(), component: HealthTab },
  });
}

describe('HealthTab', () => {
  test('shows the honest lease-not-available note', async () => {
    scripted = new ScriptedFetch();
    routeBaseline(scripted);
    const { findByText, unmount } = await renderHealthTab();
    expect(await findByText('Lease status not available')).not.toBeNull();
    unmount();
  });

  test('renders retention overview fields', async () => {
    scripted = new ScriptedFetch();
    routeBaseline(scripted);
    const { findByText, unmount } = await renderHealthTab();
    expect(await findByText('300000ms')).not.toBeNull();
    expect(await findByText('1000')).not.toBeNull();
    unmount();
  });

  test('renders a codegen preview for the first schema-bearing workflow', async () => {
    scripted = new ScriptedFetch();
    routeBaseline(scripted);
    const { findByText, unmount } = await renderHealthTab();
    // Root cause of the original flake here: `CodeBlock`'s syntax
    // highlighting is a two-phase, client-only enhancement (its own module
    // doc) — first paint is a single plain-text node (a multi-word string
    // match succeeds), then Shiki loads asynchronously and re-renders the
    // line as one `<span>` per token, fragmenting any multi-token string
    // across siblings. Whether an assertion lands before or after that
    // swap is a race, so asserting on the FULL line intermittently failed
    // once Shiki won the race — not a timeout-margin issue (confirmed: it
    // still failed with 3000ms headroom, since a longer wait only made
    // catching the fragmented state MORE likely). Asserting on
    // `OrderProcessingInput` alone is robust either way: it's Shiki's own
    // single token in the highlighted state, and obviously still one text
    // node in the plain-text state.
    expect(await findByText('OrderProcessingInput', { exact: false })).not.toBeNull();
    unmount();
  });

  test('recover-all requires Tier-2 confirmation before calling the operation, then shows a success toast', async () => {
    scripted = new ScriptedFetch();
    routeBaseline(scripted);
    scripted.routeJsonRpcMethod('weft.recover.all', { recovered: ['wf_1'] });

    // `showToast` (`src/app/toast-host.svelte`, Foundation-frozen) no-ops
    // with a `console.error` when called with no `<ToastHost>` mounted —
    // correct in production (exactly one host is always mounted by the real
    // app shell) but this test's own mutation calls it in `onSuccess`, so a
    // real host is mounted here too, matching `toast-host.test.ts`'s own
    // pattern. This also verifies the success toast copy, which was
    // previously untested.
    const { findByText: findToastByText } = render(ToastHost);

    const { findByRole, findByText, findAllByRole, unmount } = await renderHealthTab();

    await fireEvent.click(await findByRole('button', { name: 'Recover all' }));
    expect(await findByText('Recover all workflows?')).not.toBeNull();

    const buttons = await findAllByRole('button', { name: 'Recover all' });
    expect(buttons.length).toBe(2);
    await fireEvent.click(buttons[buttons.length - 1]!);

    expect(await findToastByText('Recovery triggered — 1 workflow(s) recovered.')).not.toBeNull();

    const bodies = scripted.calls
      .map((call) => (typeof call.init?.body === 'string' ? call.init.body : ''))
      .filter((body) => body.includes('weft.recover.all'));
    expect(bodies.length).toBeGreaterThan(0);
    unmount();
  });

  test('conformance panel shows the copyable CLI command, not a run button', async () => {
    scripted = new ScriptedFetch();
    routeBaseline(scripted);
    const { findByText, queryByRole, unmount } = await renderHealthTab();
    expect(await findByText('weft conformance -- <worker-command>')).not.toBeNull();
    expect(queryByRole('button', { name: 'Run' })).toBeNull();
    unmount();
  });

  test('a failing retention fetch shows the fault banner', async () => {
    scripted = new ScriptedFetch();
    scripted.routeJsonRpcMethod('weft.system.registry', {
      registryVersion: 2,
      generatedAt: '2026-01-01T00:00:00.000Z',
      workflows: [],
      activeRevisions: {},
      activities: {},
    });
    // 403, not 500: `shouldRetryQuery` (`query.ts`) retries a classified
    // `internal` fault (with backoff, which this test isn't set up to wait
    // out) but never a classified `unauthorized` one — `retentionQuery`
    // has no per-query `retry: false` override, so it inherits that shared
    // default.
    scripted.routeUrlStatus('/retention', 403, 'Forbidden');
    const { findByText, unmount } = await renderHealthTab();
    expect(await findByText('Not authorized')).not.toBeNull();
    unmount();
  });

  test('a failing registry fetch shows the fault banner in the codegen preview panel', async () => {
    scripted = new ScriptedFetch();
    scripted.routeUrl('/retention', {
      defaultRetention: null,
      sweepIntervalMs: 300000,
      sweepBatchSize: 1000,
      nextSweepAt: null,
      workflowTypes: [],
    });
    // See the retention test above for why 403, not 500.
    scripted.routeUrlStatus('/jsonrpc', 403, 'Forbidden');
    const { findByText, unmount } = await renderHealthTab();
    expect(await findByText('Not authorized')).not.toBeNull();
    unmount();
  });

  test('shows an honest empty state when no registered workflow has an input schema', async () => {
    scripted = new ScriptedFetch();
    scripted.routeUrl('/retention', {
      defaultRetention: null,
      sweepIntervalMs: 300000,
      sweepBatchSize: 1000,
      nextSweepAt: null,
      workflowTypes: [],
    });
    scripted.routeJsonRpcMethod('weft.system.registry', {
      registryVersion: 2,
      generatedAt: '2026-01-01T00:00:00.000Z',
      workflows: [
        {
          manifestVersion: 1,
          name: 'heartbeat',
          workflowVersion: '1.0.0',
          revision: 'heartbeat-rev',
          contractHash: 'heartbeat-hash',
          contract: { name: 'heartbeat', workflowVersion: '1.0.0' },
        },
      ],
      activeRevisions: { heartbeat: 'heartbeat-rev' },
      activities: {},
    });
    const { findByText, unmount } = await renderHealthTab();
    expect(await findByText('No workflow with an input schema is registered yet.')).not.toBeNull();
    unmount();
  });
});
