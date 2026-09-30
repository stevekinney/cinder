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

import {
  buildWorkflowContract,
  deriveWorkflowRevision,
  HttpClient,
  normalizeWorkflowContract,
  workflow,
  workflowSource,
} from '@lostgradient/weft';
import type { QueryClient } from '@tanstack/svelte-query';

import { startLiveSourceTestServer } from '../../lib/live-source/live-source-test-server.test-support.ts';
import ScheduleFormDrawerHarness from './schedule-form-drawer-test-harness.test-harness.svelte';
import { scheduleDetailQueryKey } from './schedule-queries.ts';

describe('ScheduleFormDrawer — edit', () => {
  test('changing revisionPolicy from active-at-fire to pinned and saving sends the new value (WFT-117)', async () => {
    const server = await startLiveSourceTestServer();
    await server.engine.schedule({
      workflow: 'inventory-sync-sweep',
      id: 'to-be-pinned',
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
          scheduleId: 'to-be-pinned',
          onClose: () => (closed = true),
        },
      });

      await waitFor(() => getByRole('radio', { name: 'Active at fire' }));
      await fireEvent.click(getByRole('radio', { name: 'Pinned' }));
      await fireEvent.click(getByRole('button', { name: 'Save changes' }));
      await waitFor(() => expect(closed).toBe(true));

      const after = await server.engine.getSchedule('to-be-pinned');
      expect(after?.revisionPolicy).toBe('pinned');
    } finally {
      await server.stop();
    }
  });

  test('a background refetch that swaps `form` mid-edit does not leak the stale revisionPolicy draft onto the new form (Codex review, PR #978, round 2)', async () => {
    // Reproduces the exact race the finding described: an external actor
    // (e.g. the System route's Activate flow) changes the schedule's
    // `revisionPolicy` on the server WHILE this drawer is open; a refetch
    // of `editDetailQuery` then reconstructs `form` as a brand-new
    // `ScheduleFormState` carrying the externally-updated value. Before the
    // `{#key form}` fix, `schedule-form-fields.svelte`'s one-shot draft
    // would have kept the OLD 'active-at-fire' value and silently written
    // it back into the new form, so a subsequent unrelated save would have
    // reverted the external pin. This proves it doesn't.
    const server = await startLiveSourceTestServer();
    await server.engine.schedule({
      workflow: 'inventory-sync-sweep',
      id: 'externally-pinned',
      cron: '0 2 * * *',
      input: { warehouseId: 'wh-main' },
    });
    const client = new HttpClient({ baseUrl: server.baseUrl, token: server.token });

    let closed = false;
    let queryClient: QueryClient | undefined;
    try {
      const { getByRole } = render(ScheduleFormDrawerHarness, {
        props: {
          client,
          mode: 'edit',
          scheduleId: 'externally-pinned',
          onClose: () => (closed = true),
          onQueryClient: (qc) => (queryClient = qc),
        },
      });

      await waitFor(() => {
        const radio = requireElement(
          getByRole('radio', { name: 'Active at fire' }),
          HTMLInputElement,
        );
        expect(radio.checked).toBe(true);
      });

      // Out-of-band change: NOT through this drawer's own form submission.
      await server.engine.updateSchedule('externally-pinned', '0 2 * * *', {
        revisionPolicy: 'pinned',
      });
      if (queryClient === undefined) throw new Error('queryClient was never captured');
      await queryClient.invalidateQueries({
        queryKey: scheduleDetailQueryKey('externally-pinned'),
      });

      await waitFor(() => {
        const radio = requireElement(getByRole('radio', { name: 'Pinned' }), HTMLInputElement);
        expect(radio.checked).toBe(true);
      });

      // An unrelated save after the refetch — must not resend the OLD draft.
      await fireEvent.click(getByRole('button', { name: 'Save changes' }));
      await waitFor(() => expect(closed).toBe(true));

      const after = await server.engine.getSchedule('externally-pinned');
      expect(after?.revisionPolicy).toBe('pinned');
    } finally {
      await server.stop();
    }
  });

  test('a rejected revision-policy save (ambiguous dynamic-source revision, no catalog active pointer) renders a fault instead of silently pinning (review, PR #978)', async () => {
    // `resolveScheduleRevisionForPin()` (engine-side) requires an
    // unambiguous revision for the type being pinned — for a
    // `registerSource()`-registered type with more than one candidate
    // revision and no catalog active pointer resolved, it throws
    // `DynamicWorkflowSourceUnavailableError` (reason `'ambiguous-revision'`).
    // This is a REAL rejection reachable through the edit drawer's own new
    // `revisionPolicy` `RadioGroup`: the schedule below is created while its
    // workflow type has exactly one registered dynamic-source revision
    // (unambiguous — creation succeeds), a SECOND revision is then
    // registered for the same type (simulating a later deploy adding a
    // candidate, with nobody ever having called `engine.workflows.activate()`),
    // and only THEN does the operator try to switch the schedule to `pinned`.
    //
    // `mapScheduleErrorToFault()` maps `DynamicWorkflowSourceUnavailableError`
    // to a `Conflict` fault (COR-19), so the console renders the explicit
    // "Conflict" banner — not a silent, wrongly-applied pin and not a masked
    // generic internal failure.
    const server = await startLiveSourceTestServer();
    const workflowType = 'ambiguous-pin-target';

    // `workflowSource()`'s `revision` is not a free-form label — it must
    // equal the exact content-derived revision
    // `buildWorkflowManifestFromDefinition()` computes from the loaded
    // module's contract (documentation/guides/workflow-versioning.md,
    // "`workflowSource()`: a typed, serializable source descriptor").
    // Two distinct `workflowVersion`s produce two distinct derived
    // revisions for the same workflow name, which is what this test needs
    // to register a genuinely ambiguous second candidate.
    async function derivedRevisionFor(version: string): Promise<string> {
      const contract = buildWorkflowContract({ name: workflowType, version });
      return deriveWorkflowRevision(normalizeWorkflowContract(contract));
    }
    const buildSource = async (version: string) =>
      workflowSource(
        {
          name: workflowType,
          location: `./fixtures/${workflowType}-${version}.ts`,
          exportName: 'target',
          revision: await derivedRevisionFor(version),
        },
        async () => ({
          // This workflow is never actually started in this test (only its
          // dynamic-source registration matters, for revision ambiguity) —
          // the trivial `yield* ctx.sleep()` exists solely so this is a real
          // generator body, satisfying `require-yield`, not because it ever
          // runs.
          target: workflow({ name: workflowType, version }).execute(async function* (ctx) {
            yield* ctx.sleep('1ms');
            return 'done';
          }),
        }),
      );

    server.engine.registerSource(await buildSource('1.0.0'));
    await server.engine.schedule({
      workflow: workflowType,
      id: 'ambiguous-pin-schedule',
      cron: '0 2 * * *',
      input: {},
    });
    // Registered AFTER creation succeeded on the sole-candidate fast path —
    // this is what makes the type ambiguous for the pin attempt below.
    server.engine.registerSource(await buildSource('2.0.0'));

    const client = new HttpClient({ baseUrl: server.baseUrl, token: server.token });

    let closed = false;
    try {
      const { getByRole, getByText } = render(ScheduleFormDrawerHarness, {
        props: {
          client,
          mode: 'edit',
          scheduleId: 'ambiguous-pin-schedule',
          onClose: () => (closed = true),
        },
      });

      await waitFor(() => getByRole('radio', { name: 'Active at fire' }));
      await fireEvent.click(getByRole('radio', { name: 'Pinned' }));
      await fireEvent.click(getByRole('button', { name: 'Save changes' }));

      await waitFor(() => expect(getByText('Conflict')).not.toBeNull());
      expect(closed).toBe(false);

      // The rejected mutation must not have silently pinned the schedule.
      const after = await server.engine.getSchedule('ambiguous-pin-schedule');
      expect(after?.revisionPolicy).toBe('active-at-fire');
      expect(after?.pinnedRevision).toBeUndefined();
    } finally {
      await server.stop();
    }
  });

  test('renders the not-found fault when the schedule no longer exists', async () => {
    const server = await startLiveSourceTestServer();
    const client = new HttpClient({ baseUrl: server.baseUrl, token: server.token });

    try {
      const { getByText } = render(ScheduleFormDrawerHarness, {
        props: { client, mode: 'edit', scheduleId: 'missing', onClose: () => {} },
      });

      await waitFor(() => expect(getByText('Not found')).not.toBeNull());
    } finally {
      await server.stop();
    }
  });
});
