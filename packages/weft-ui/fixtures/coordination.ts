/**
 * Coordination-branch demo fixture (plan §11, Appendix B "Timeline
 * (coordination + saga + finalizer)"). Exercises `ctx.race`, `ctx.all`, and
 * `ctx.speculate` in a single run so the timeline has a live specimen of
 * every coordination-branch group. See `fixtures/workflows.ts` for the
 * append-only contract this file participates in.
 */
import { activity, workflow, type WorkflowHandle } from '@lostgradient/weft';

interface CheckoutCoordinationInput {
  orderId: string;
  sku: string;
  customerId: string;
  email: string;
  phone: string;
}

const checkInventoryCache = activity({
  name: 'checkInventoryCache',
  execute: async (input: { sku: string }) => {
    return { sku: input.sku, source: 'cache' as const, inStock: true };
  },
});

const checkInventoryDatabase = activity({
  name: 'checkInventoryDatabase',
  execute: async (input: { sku: string }) => {
    // Real (short) latency so the cache branch reliably wins the race in the
    // demo. Both branches still run to completion — ctx.race only discards
    // the loser's result, it doesn't cancel the losing activity.
    await Bun.sleep(30);
    return { sku: input.sku, source: 'database' as const, inStock: true };
  },
});

const notifyEmail = activity({
  name: 'notifyEmail',
  execute: async (input: { email: string; orderId: string }) => {
    return { channel: 'email' as const, sentTo: input.email, orderId: input.orderId };
  },
});

const notifySms = activity({
  name: 'notifySms',
  execute: async (input: { phone: string; orderId: string }) => {
    return { channel: 'sms' as const, sentTo: input.phone, orderId: input.orderId };
  },
});

const notifyOpsChannel = activity({
  name: 'notifyOpsChannel',
  execute: async (input: { orderId: string }) => {
    return { channel: 'ops' as const, orderId: input.orderId };
  },
});

const fetchPersonalizedOffer = activity({
  name: 'fetchPersonalizedOffer',
  execute: async (input: { customerId: string }) => {
    return { customerId: input.customerId, offer: '10% off your next order' };
  },
});

export const checkoutCoordination = workflow({ name: 'checkout-coordination' })
  .activities({
    checkInventoryCache,
    checkInventoryDatabase,
    notifyEmail,
    notifySms,
    notifyOpsChannel,
    fetchPersonalizedOffer,
  })
  .execute(async function* (ctx, input: CheckoutCoordinationInput) {
    // ctx.race — two independent stock lookups; only the faster branch's
    // result advances the workflow, but both show up in the timeline.
    const stock = yield* ctx.race([
      ctx.run(checkInventoryCache, { sku: input.sku }),
      ctx.run(checkInventoryDatabase, { sku: input.sku }),
    ]);

    // ctx.all — three independent notification fan-outs that must all land
    // before checkout confirms.
    const [email, sms, ops] = yield* ctx.all([
      ctx.run(notifyEmail, { email: input.email, orderId: input.orderId }),
      ctx.run(notifySms, { phone: input.phone, orderId: input.orderId }),
      ctx.run(notifyOpsChannel, { orderId: input.orderId }),
    ]);

    // ctx.speculate — an optional personalization branch that does not gate
    // checkout completion.
    const offer = yield* ctx.speculate(async function* (branch) {
      return yield* branch.run(fetchPersonalizedOffer, { customerId: input.customerId });
    });

    return { stock, notifications: { email, sms, ops }, offer };
  });

/** Registerable workflow map — merged into `fixtures/workflows.ts`'s registry. */
export const coordinationWorkflows = {
  'checkout-coordination': checkoutCoordination,
};

/** Narrow structural interface — see `fixtures/workflows.ts` for the pattern. */
export interface CoordinationEngine {
  start(name: 'checkout-coordination', input: CheckoutCoordinationInput): Promise<WorkflowHandle>;
}

/**
 * Starts and settles the coordination demo. Awaited so the run is a
 * genuinely completed terminal by the time the dev server starts serving —
 * every branch (race/all/speculate) is purely local and resolves in
 * milliseconds, so awaiting it here does not meaningfully delay boot.
 */
export async function seedCoordination(engine: CoordinationEngine): Promise<void> {
  const handle = await engine.start('checkout-coordination', {
    orderId: 'ord_2001',
    sku: 'sku-fleece-hoodie-m',
    customerId: 'cust_4471',
    email: 'shopper@example.com',
    phone: '+15555550123',
  });
  await handle.result();
}
