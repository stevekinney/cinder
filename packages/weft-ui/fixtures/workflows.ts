/**
 * Deterministic demo workflows for the dev harness (plan §10, §11,
 * PROJECT-BRIEF "Dev harness"). Used by `scripts/dev-server.ts` today;
 * integration tests and Playwright seeds grow this file in later phases.
 *
 * **Append-only.** Add new fixtures; never mutate an existing workflow's
 * name, input shape, or activity behavior — other tracks assert against
 * these once Phase 1 lands.
 *
 * **Split by domain.** The four workflows below (order-processing,
 * payment-failing, long-sleeper, review-gate) are the original set and stay
 * exactly as they were. Every additional visual-state specimen (coordination
 * branches, saga compensation, finalizers, async activities, parent/child
 * workflows, long histories, tags + search attributes, failure categories,
 * additional reviews, schedules) lives in its own `fixtures/<domain>.ts`
 * module — each owns its workflow definitions, a narrow structural
 * `*Engine` interface, and a `seed<Domain>()` function — and is merged into
 * this file's `workflows` registry and orchestrated from `seed()` below.
 */
import { activity, workflow, type WorkflowHandle } from '@lostgradient/weft';

import {
  asyncActivityWorkflows,
  seedAsyncActivity,
  type AsyncActivityEngine,
} from './async-activity.ts';
import { childWorkflows, seedChildren, type ChildrenEngine } from './children.ts';
import {
  coordinationWorkflows,
  seedCoordination,
  type CoordinationEngine,
} from './coordination.ts';
import { failureWorkflows, seedFailures, type FailuresEngine } from './failures.ts';
import { finalizerWorkflows, seedFinalizer, type FinalizerEngine } from './finalizer.ts';
import { historyWorkflows, seedHistory, type HistoryEngine } from './history.ts';
import {
  restartLineageWorkflows,
  seedRestartLineage,
  type RestartLineageEngine,
} from './restart-lineage.ts';
import { reviewWorkflows, seedReviews, type ReviewsEngine } from './reviews.ts';
import { sagaWorkflows, seedSaga, type SagaEngine } from './saga.ts';
import { scheduleWorkflows, seedSchedules, type SchedulesEngine } from './schedules.ts';
import { seedTagged, taggedWorkflows, type TaggedEngine } from './tagged.ts';

// ---------------------------------------------------------------------------
// order-processing — activities + one retry, runs to completion.
// ---------------------------------------------------------------------------

interface OrderProcessingInput {
  orderId: string;
  amountCents: number;
  email: string;
}

const chargeCard = activity({
  name: 'chargeCard',
  execute: async (input: { orderId: string; amountCents: number }) => {
    return { chargeId: `ch_${input.orderId}`, amountCents: input.amountCents };
  },
});

// Fails on its first call and succeeds on retry, so the seeded run exercises
// the timeline's retry-attempt rendering. State is module-level (not
// per-workflow) — fine for a dev-only, ephemeral, `MemoryStorage`-backed seed.
let reserveInventoryCallCount = 0;

const reserveInventory = activity({
  name: 'reserveInventory',
  retry: { maxAttempts: 3, initialBackoff: '200ms', backoffMultiplier: 2, maxBackoff: '2s' },
  execute: async (input: { orderId: string }) => {
    reserveInventoryCallCount += 1;
    if (reserveInventoryCallCount % 2 === 1) {
      throw new Error('inventory service temporarily unavailable');
    }
    return { orderId: input.orderId, reserved: true };
  },
});

const sendConfirmationEmail = activity({
  name: 'sendConfirmationEmail',
  execute: async (input: { orderId: string; email: string }) => {
    return { orderId: input.orderId, sentTo: input.email };
  },
});

export const orderProcessing = workflow({ name: 'order-processing' })
  .activities({ chargeCard, reserveInventory, sendConfirmationEmail })
  .execute(async function* (ctx, input: OrderProcessingInput) {
    const charge = yield* ctx.run('chargeCard', {
      orderId: input.orderId,
      amountCents: input.amountCents,
    });
    // Pass the `reserveInventory` activity CALLABLE, not its string name: the
    // colocated `retry` policy on `activity({ retry: {...} })` is only read
    // off the callable reference — `resolveActivityRetryPolicy()` in weft's
    // `core/context/run-operation.ts` returns `undefined` for a by-name
    // string call, silently dropping the policy. Calling by name is fine for
    // activities with no retry policy (`chargeCard`, `sendConfirmationEmail`
    // above); this one needs the callable so the seeded run actually
    // retries-then-succeeds instead of failing permanently on attempt 1.
    const inventory = yield* ctx.run(reserveInventory, { orderId: input.orderId });
    const confirmation = yield* ctx.run('sendConfirmationEmail', {
      orderId: input.orderId,
      email: input.email,
    });
    return { charge, inventory, confirmation };
  });

// ---------------------------------------------------------------------------
// payment-failing — fails with the `application` failure category.
// ---------------------------------------------------------------------------

interface PaymentFailingInput {
  orderId: string;
  amountCents: number;
}

const declineCard = activity({
  name: 'declineCard',
  execute: async (input: { orderId: string }) => {
    // A plain thrown Error with no retry policy fails on the first attempt
    // with the default `application` failure category (weft classifies
    // unrecognized thrown errors as `application` unless they match a
    // specific timeout/cancellation/resource/system error shape).
    throw new Error(`payment declined for order ${input.orderId}`);
  },
});

export const paymentFailing = workflow({ name: 'payment-failing' })
  .activities({ declineCard })
  .execute(async function* (ctx, input: PaymentFailingInput) {
    yield* ctx.run('declineCard', { orderId: input.orderId });
    return { amountCents: input.amountCents };
  });

// ---------------------------------------------------------------------------
// long-sleeper — stays `running` behind a durable sleep.
// ---------------------------------------------------------------------------

interface LongSleeperInput {
  label: string;
}

export const longSleeper = workflow({ name: 'long-sleeper' }).execute(async function* (
  ctx,
  input: LongSleeperInput,
) {
  yield* ctx.sleep('24h');
  return { label: input.label, awoke: true };
});

// ---------------------------------------------------------------------------
// review-gate — parks on a human review request.
// ---------------------------------------------------------------------------

interface ReviewGateInput {
  artifact: string;
}

export const reviewGate = workflow({ name: 'review-gate' }).execute(async function* (
  ctx,
  input: ReviewGateInput,
) {
  const decision = yield* ctx.review({
    artifact: input.artifact,
    reviewers: ['ops@example.com'],
    timeout: 24 * 60 * 60 * 1000,
  });
  return { decision };
});

// ---------------------------------------------------------------------------
// signal-stepped — parks on a named signal before each of N durable steps.
// T1.4's LiveSource realtime-transport integration tests drive it
// deterministically via `engine.signal(id, 'advance')` to produce a
// controlled catch-up phase (steps committed before subscribing) followed
// by a controlled live phase (steps committed after), without racing real
// wall-clock timing the way a fast-completing workflow like
// order-processing would.
// ---------------------------------------------------------------------------

interface SignalSteppedInput {
  steps: number;
}

const recordStep = activity({
  name: 'recordStep',
  execute: async (input: { index: number }) => {
    return { index: input.index };
  },
});

export const signalStepped = workflow({ name: 'signal-stepped' })
  .activities({ recordStep })
  .execute(async function* (ctx, input: SignalSteppedInput) {
    const results: number[] = [];
    for (let index = 0; index < input.steps; index += 1) {
      yield* ctx.waitForSignal('advance');
      const step = yield* ctx.run('recordStep', { index });
      results.push(step.index);
    }
    return { results };
  });

// ---------------------------------------------------------------------------
// Registry + seed
// ---------------------------------------------------------------------------

/** Registerable workflow map — pass directly to `Engine.create({ workflows })`. */
export const workflows = {
  'order-processing': orderProcessing,
  'payment-failing': paymentFailing,
  'long-sleeper': longSleeper,
  'review-gate': reviewGate,
  'signal-stepped': signalStepped,
  ...coordinationWorkflows,
  ...sagaWorkflows,
  ...finalizerWorkflows,
  ...asyncActivityWorkflows,
  ...childWorkflows,
  ...historyWorkflows,
  ...taggedWorkflows,
  ...failureWorkflows,
  ...reviewWorkflows,
  ...scheduleWorkflows,
  ...restartLineageWorkflows,
};

/**
 * The subset of `Engine`'s (or a `WeftClient`'s) `start` overloads `seed`
 * needs — a narrow structural interface rather than the full `Engine<...>`
 * type. The concrete registry type `Engine.create({ workflows })` infers
 * (`EngineCreateWorkflowRegistry<...>`) is not exported from
 * `@lostgradient/weft`, and the FULL `Engine<Concrete>` class is not
 * structurally assignable to a plain `Engine` parameter (its `register()`
 * method's return type varies with the registry). A single-method interface
 * naming just the four calls `seed` makes sidesteps both problems: TypeScript
 * checks method-to-overload assignability per call shape, and a concrete
 * `Engine<Registry>` (or `LocalClient`/`HttpClient`) satisfies it directly.
 *
 * Every other fixture domain (coordination, saga, finalizer, async
 * activity, children, history, tagged, failures, reviews, schedules) follows
 * the same pattern with its own narrow interface + seeder, colocated with
 * its workflow definitions. `FixtureEngine` below intersects all of them so
 * a single `engine` value can be handed to every domain seeder in turn.
 */
interface FixtureWorkflowStarter {
  start(name: 'order-processing', input: OrderProcessingInput): Promise<WorkflowHandle>;
  start(name: 'payment-failing', input: PaymentFailingInput): Promise<WorkflowHandle>;
  start(name: 'long-sleeper', input: LongSleeperInput): Promise<WorkflowHandle>;
  start(name: 'review-gate', input: ReviewGateInput): Promise<WorkflowHandle>;
  start(name: 'signal-stepped', input: SignalSteppedInput): Promise<WorkflowHandle>;
}

/** The full structural surface `seed()` needs across every fixture domain. */
export type FixtureEngine = FixtureWorkflowStarter &
  CoordinationEngine &
  SagaEngine &
  FinalizerEngine &
  AsyncActivityEngine &
  ChildrenEngine &
  HistoryEngine &
  TaggedEngine &
  FailuresEngine &
  ReviewsEngine &
  SchedulesEngine &
  RestartLineageEngine;

/**
 * Starts one run of every fixture workflow, plus every domain-specific
 * specimen from the sibling fixture modules.
 *
 * Terminal-bound runs (`order-processing`, `payment-failing`, and every
 * domain seeder that expects its run to complete or fail) are awaited so
 * their terminal state is durably committed before the dev server starts
 * serving — otherwise a curl issued right after boot could race the commit
 * and see `running` instead of the settled state. Runs that never reach a
 * terminal state by design (`long-sleeper`, `review-gate`, and the pending
 * specimens inside the domain seeders) are deliberately left running.
 */
export async function seed(engine: FixtureEngine): Promise<void> {
  const orderHandle = await engine.start('order-processing', {
    orderId: 'ord_1001',
    amountCents: 4999,
    email: 'customer@example.com',
  } satisfies OrderProcessingInput);
  await orderHandle.result();

  const paymentHandle = await engine.start('payment-failing', {
    orderId: 'ord_1002',
    amountCents: 12_000,
  } satisfies PaymentFailingInput);
  await paymentHandle.result().catch(() => {
    // Expected — payment-failing always fails.
  });

  await engine.start('long-sleeper', {
    label: 'demo-long-sleeper',
  } satisfies LongSleeperInput);

  await engine.start('review-gate', {
    artifact: 'Q3 marketing copy draft',
  } satisfies ReviewGateInput);

  await engine.start('signal-stepped', {
    steps: 3,
  } satisfies SignalSteppedInput);

  await seedCoordination(engine);
  await seedSaga(engine);
  await seedFinalizer(engine);
  await seedAsyncActivity(engine);
  await seedChildren(engine);
  await seedHistory(engine);
  await seedTagged(engine);
  await seedFailures(engine);
  await seedReviews(engine);
  await seedSchedules(engine);
  await seedRestartLineage(engine);
}
