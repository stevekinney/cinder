/**
 * `start-new` continuation-chain demo fixture (plan §11, Lineage panel
 * "Previous run → This run → No successor" continuation chips —
 * weft#732 item 2, shipped `@lostgradient/weft@0.15.0`). Starts a run under
 * a fixed id, lets it complete, then restarts the SAME id with
 * `onTerminalConflict: 'start-new'` — so the final state's
 * `WorkflowState.restartedFrom` is populated for the console's Lineage
 * panel to render a real continuation chip chain. See
 * `fixtures/workflows.ts` for the append-only contract this file
 * participates in.
 */
import { activity, workflow, type WorkflowHandle } from '@lostgradient/weft';

interface NightlyReconciliationInput {
  runLabel: string;
}

const reconcileLedger = activity({
  name: 'reconcileLedger',
  execute: async (input: { runLabel: string }) => {
    return { runLabel: input.runLabel, reconciled: true };
  },
});

export const nightlyReconciliation = workflow({ name: 'nightly-reconciliation' })
  .activities({ reconcileLedger })
  .execute(async function* (ctx, input: NightlyReconciliationInput) {
    return yield* ctx.run(reconcileLedger, { runLabel: input.runLabel });
  });

/** Registerable workflow map — merged into `fixtures/workflows.ts`'s registry. */
export const restartLineageWorkflows = {
  'nightly-reconciliation': nightlyReconciliation,
};

/** Stable id reused across both starts — `onTerminalConflict: 'start-new'` requires an explicit id, and reusing the SAME id is the whole point (see module doc). */
export const RESTART_LINEAGE_WORKFLOW_ID = 'nightly-reconciliation-demo';

/** Narrow structural interface — see `fixtures/workflows.ts` for the pattern. */
export interface RestartLineageEngine {
  start(
    name: 'nightly-reconciliation',
    input: NightlyReconciliationInput,
    options?: { id?: string; onTerminalConflict?: 'error' | 'start-new' },
  ): Promise<WorkflowHandle>;
}

/**
 * Starts `nightly-reconciliation` under a fixed id, awaits its (fast)
 * completion, then restarts the SAME id with `onTerminalConflict:
 * 'start-new'` and awaits that too. The final `GET /api/v1/workflows/:id`
 * response carries `restartedFrom: { workflowId, workflowExecutionToken,
 * replacedAt }` pointing at the first run — the first run's own record is
 * purged as part of the atomic replace (weft's own documented behavior),
 * which is exactly the boundary the Lineage panel's continuation chips
 * render honestly around (no fabricated "Completed" status on the
 * "Previous run" chip — `RestartLineage` carries no status field).
 */
export async function seedRestartLineage(engine: RestartLineageEngine): Promise<void> {
  const firstRun = await engine.start(
    'nightly-reconciliation',
    { runLabel: 'gen-1' },
    { id: RESTART_LINEAGE_WORKFLOW_ID },
  );
  await firstRun.result();

  const secondRun = await engine.start(
    'nightly-reconciliation',
    { runLabel: 'gen-2' },
    { id: RESTART_LINEAGE_WORKFLOW_ID, onTerminalConflict: 'start-new' },
  );
  await secondRun.result();
}
