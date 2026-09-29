/**
 * Async-activity-completion demo fixture (plan §11, Appendix B "Async
 * completion panel"). The activity calls `ctx.completeAsync()` and is
 * deliberately never completed from outside the engine, so this run stays
 * `running` with a pending async activity — a live specimen of a workflow
 * awaiting external completion. See `fixtures/workflows.ts` for the
 * append-only contract this file participates in.
 */
import { activity, workflow, type ActivityContext, type WorkflowHandle } from '@lostgradient/weft';

interface PrintShippingLabelInput {
  orderId: string;
  carrier: string;
}

const printShippingLabel = activity({
  name: 'printShippingLabel',
  execute: async (
    _input: { orderId: string; carrier: string },
    activityContext?: ActivityContext,
  ) => {
    // Hands off to an out-of-band label-printing service. The activity parks
    // here until something outside the engine calls
    // `engine.completeAsyncActivity(token, result)` (or the matching
    // `client.activity.complete()`), keyed on the durable task token
    // announced via the `activity:async-pending` event.
    return activityContext!.completeAsync();
  },
});

export const shipPackageAsync = workflow({ name: 'ship-package-async' })
  .activities({ printShippingLabel })
  .execute(async function* (ctx, input: PrintShippingLabelInput) {
    const label = yield* ctx.run(printShippingLabel, {
      orderId: input.orderId,
      carrier: input.carrier,
    });
    return { orderId: input.orderId, label };
  });

/** Registerable workflow map — merged into `fixtures/workflows.ts`'s registry. */
export const asyncActivityWorkflows = {
  'ship-package-async': shipPackageAsync,
};

/** Narrow structural interface — see `fixtures/workflows.ts` for the pattern. */
export interface AsyncActivityEngine {
  start(name: 'ship-package-async', input: PrintShippingLabelInput): Promise<WorkflowHandle>;
}

/**
 * Starts the label-printing workflow and deliberately leaves it pending —
 * no `completeAsyncActivity`/`failAsyncActivity` call happens here, so the
 * console always has a live "awaiting external completion" specimen.
 */
export async function seedAsyncActivity(engine: AsyncActivityEngine): Promise<void> {
  await engine.start('ship-package-async', { orderId: 'ord_3001', carrier: 'ups' });
}
