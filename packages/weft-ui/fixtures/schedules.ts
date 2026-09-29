/**
 * Schedule demo fixture (plan §11, Appendix B "Schedule list … / detail
 * (overlap text, queued runs) / create-edit (cron preview, backfill
 * warning)"). Registers one active every-5-minutes cron schedule and one
 * paused schedule. See `fixtures/workflows.ts` for the append-only contract
 * this file participates in.
 */
import {
  activity,
  workflow,
  type ScheduleDefinition,
  type ScheduleHandle,
  type WorkflowHandle,
} from '@lostgradient/weft';

interface InventorySyncInput {
  warehouseId: string;
}

const syncInventoryLevels = activity({
  name: 'syncInventoryLevels',
  execute: async (input: { warehouseId: string }) => {
    return { warehouseId: input.warehouseId, synced: true };
  },
});

export const inventorySyncSweep = workflow({ name: 'inventory-sync-sweep' })
  .activities({ syncInventoryLevels })
  .execute(async function* (ctx, input: InventorySyncInput) {
    return yield* ctx.run(syncInventoryLevels, { warehouseId: input.warehouseId });
  });

/** Registerable workflow map — merged into `fixtures/workflows.ts`'s registry. */
export const scheduleWorkflows = {
  'inventory-sync-sweep': inventorySyncSweep,
};

/** Narrow structural interface — see `fixtures/workflows.ts` for the pattern. */
export interface SchedulesEngine {
  start(name: 'inventory-sync-sweep', input: InventorySyncInput): Promise<WorkflowHandle>;
  schedule(definition: ScheduleDefinition<InventorySyncInput>): Promise<ScheduleHandle>;
}

/**
 * Registers an active every-5-minutes schedule and a second, paused
 * schedule. Also starts one immediate, non-scheduled run of the same
 * workflow so the schedule's target type has a completed run to link back
 * to, independent of whether either schedule has fired yet.
 */
export async function seedSchedules(engine: SchedulesEngine): Promise<void> {
  const primingHandle = await engine.start('inventory-sync-sweep', { warehouseId: 'wh-main' });
  await primingHandle.result();

  await engine.schedule({
    workflow: 'inventory-sync-sweep',
    id: 'inventory-sync-every-5-minutes',
    cron: '*/5 * * * *',
    input: { warehouseId: 'wh-main' },
    description: 'Sync inventory levels across warehouses every 5 minutes.',
  });

  const nightlyAudit = await engine.schedule({
    workflow: 'inventory-sync-sweep',
    id: 'nightly-inventory-audit',
    cron: '0 3 * * *',
    input: { warehouseId: 'wh-overflow' },
    description: 'Nightly full inventory reconciliation (currently paused).',
  });
  await nightlyAudit.pause();
}
