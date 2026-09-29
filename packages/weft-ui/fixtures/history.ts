/**
 * Long-history demo fixture (plan §11, Appendix B — long-running history
 * views/virtualization). Loops a trivial activity well past 200 durable
 * steps so the timeline, checkpoints, and events views have a live specimen
 * with a genuinely long history. See `fixtures/workflows.ts` for the
 * append-only contract this file participates in.
 */
import { activity, workflow, type WorkflowHandle } from '@lostgradient/weft';

interface AuditTrailSweepInput {
  batchId: string;
  steps: number;
}

/** Comfortably above the plan's ">200-step" acceptance bar. */
const LONG_HISTORY_STEP_COUNT = 220;

const advanceCounter = activity({
  name: 'advanceCounter',
  execute: async (input: { value: number }) => {
    return { value: input.value + 1 };
  },
});

export const auditTrailSweep = workflow({ name: 'audit-trail-sweep' })
  .activities({ advanceCounter })
  .execute(async function* (ctx, input: AuditTrailSweepInput) {
    let value = 0;
    for (let step = 0; step < input.steps; step++) {
      const result = yield* ctx.run(advanceCounter, { value });
      value = result.value;
    }
    return { batchId: input.batchId, finalValue: value };
  });

/** Registerable workflow map — merged into `fixtures/workflows.ts`'s registry. */
export const historyWorkflows = {
  'audit-trail-sweep': auditTrailSweep,
};

/** Narrow structural interface — see `fixtures/workflows.ts` for the pattern. */
export interface HistoryEngine {
  start(name: 'audit-trail-sweep', input: AuditTrailSweepInput): Promise<WorkflowHandle>;
}

/**
 * Starts and settles the long-history sweep. Every step is a trivial local
 * activity against in-memory storage, so 220 sequential checkpoints resolve
 * in well under a second — awaited so the full history is durably committed
 * before the dev server starts serving.
 */
export async function seedHistory(engine: HistoryEngine): Promise<void> {
  const handle = await engine.start('audit-trail-sweep', {
    batchId: 'batch-2026-07-a',
    steps: LONG_HISTORY_STEP_COUNT,
  });
  await handle.result();
}
