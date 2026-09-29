/**
 * Parent/child workflow demo fixture (plan §11, Appendix B "Children"
 * panel, Lineage panel "children"). The parent awaits one child to
 * completion and detaches a second, long-running child — a live specimen of
 * a completed parent with a still-running child underneath it. See
 * `fixtures/workflows.ts` for the append-only contract this file
 * participates in.
 */
import { activity, workflow, type WorkflowHandle } from '@lostgradient/weft';

interface ValidateShipmentInput {
  orderId: string;
}

interface MonitorDeliveryInput {
  orderId: string;
}

interface FulfillmentParentInput {
  orderId: string;
}

const confirmAddress = activity({
  name: 'confirmAddress',
  execute: async (input: { orderId: string }) => {
    return { orderId: input.orderId, addressConfirmed: true };
  },
});

export const validateShipment = workflow({ name: 'validate-shipment' })
  .activities({ confirmAddress })
  .execute(async function* (ctx, input: ValidateShipmentInput) {
    return yield* ctx.run(confirmAddress, { orderId: input.orderId });
  });

export const monitorDelivery = workflow({ name: 'monitor-delivery' }).execute(async function* (
  ctx,
  input: MonitorDeliveryInput,
) {
  // Stays running indefinitely, independent of the parent — demonstrates a
  // live child workflow under an already-completed parent.
  yield* ctx.sleep('24h');
  return { orderId: input.orderId, delivered: true };
});

export const fulfillmentParent = workflow({ name: 'fulfillment-parent' }).execute(async function* (
  ctx,
  input: FulfillmentParentInput,
) {
  const validated = yield* ctx.startChild<{ orderId: string; addressConfirmed: boolean }>(
    'validate-shipment',
    { orderId: input.orderId },
  );
  const monitor = yield* ctx.startChild(
    'monitor-delivery',
    { orderId: input.orderId },
    {
      parentClosePolicy: 'abandon',
    },
  );
  return { validated, monitorChildId: monitor.id };
});

/** Registerable workflow map — merged into `fixtures/workflows.ts`'s registry. */
export const childWorkflows = {
  'validate-shipment': validateShipment,
  'monitor-delivery': monitorDelivery,
  'fulfillment-parent': fulfillmentParent,
};

/** Narrow structural interface — see `fixtures/workflows.ts` for the pattern. */
export interface ChildrenEngine {
  start(name: 'fulfillment-parent', input: FulfillmentParentInput): Promise<WorkflowHandle>;
}

/**
 * Starts the parent and awaits it. Only the awaited `validate-shipment`
 * child gates parent completion; the abandoned `monitor-delivery` child
 * keeps running independently, so this leaves a completed parent with a
 * live running child underneath it.
 */
export async function seedChildren(engine: ChildrenEngine): Promise<void> {
  const handle = await engine.start('fulfillment-parent', { orderId: 'ord_4001' });
  await handle.result();
}
