/**
 * Failure-category demo fixtures (plan §11, Appendix B failure-category
 * filters). Weft's failure taxonomy is `application | timeout | cancellation
 * | resource | system`, and `failureCategory` is only ever populated on
 * `status: 'failed'` workflows (see weft's `classifyErrorAsFailureCategory`).
 * `paymentFailing` in `fixtures/workflows.ts` already covers `application`
 * (a plain thrown `Error`); this file covers the remaining four by throwing
 * errors named to match weft's classifier, plus one genuinely non-`Error`
 * throw for `system` (the only path that reaches it — every other
 * classification call site defaults unrecognized `Error`s to
 * `application`). See `fixtures/workflows.ts` for the append-only contract
 * this file participates in.
 */
import { activity, workflow, type WorkflowHandle } from '@lostgradient/weft';

interface FailureDemoInput {
  orderId: string;
}

const triggerTimeoutStyleFailure = activity({
  name: 'triggerTimeoutStyleFailure',
  execute: async (input: { orderId: string }) => {
    const error = new Error(`upstream carrier API did not respond for order ${input.orderId}`);
    error.name = 'TimeoutError';
    throw error;
  },
});

export const timeoutFailureDemo = workflow({ name: 'timeout-failure-demo' })
  .activities({ triggerTimeoutStyleFailure })
  .execute(async function* (ctx, input: FailureDemoInput) {
    yield* ctx.run('triggerTimeoutStyleFailure', { orderId: input.orderId });
  });

const triggerCancellationStyleFailure = activity({
  name: 'triggerCancellationStyleFailure',
  execute: async (input: { orderId: string }) => {
    const error = new Error(`checkout for order ${input.orderId} was aborted by the caller`);
    error.name = 'CancelledError';
    throw error;
  },
});

export const cancellationFailureDemo = workflow({ name: 'cancellation-failure-demo' })
  .activities({ triggerCancellationStyleFailure })
  .execute(async function* (ctx, input: FailureDemoInput) {
    yield* ctx.run('triggerCancellationStyleFailure', { orderId: input.orderId });
  });

const triggerResourceStyleFailure = activity({
  name: 'triggerResourceStyleFailure',
  execute: async (input: { orderId: string }) => {
    const error = new Error(`rate limit exceeded while processing order ${input.orderId}`);
    error.name = 'ResourceExhaustedError';
    throw error;
  },
});

export const resourceFailureDemo = workflow({ name: 'resource-failure-demo' })
  .activities({ triggerResourceStyleFailure })
  .execute(async function* (ctx, input: FailureDemoInput) {
    yield* ctx.run('triggerResourceStyleFailure', { orderId: input.orderId });
  });

/**
 * A non-`Error` fault. `classifyErrorAsFailureCategory` returns `'system'`
 * immediately for any thrown value that is not an `instanceof Error` — the
 * only way to reach the `system` category, since every classification call
 * site in weft's workflow/activity failure path passes
 * `defaultErrorCategory: 'application'` for actual `Error` instances.
 */
class InfrastructureFault {
  constructor(readonly message: string) {}
}

const triggerSystemStyleFailure = activity({
  name: 'triggerSystemStyleFailure',
  execute: async (input: { orderId: string }) => {
    // A deliberate non-Error throw — see the class comment above.
    throw new InfrastructureFault(
      `connection pool exhausted while processing order ${input.orderId}`,
    );
  },
});

export const systemFailureDemo = workflow({ name: 'system-failure-demo' })
  .activities({ triggerSystemStyleFailure })
  .execute(async function* (ctx, input: FailureDemoInput) {
    yield* ctx.run('triggerSystemStyleFailure', { orderId: input.orderId });
  });

/** Registerable workflow map — merged into `fixtures/workflows.ts`'s registry. */
export const failureWorkflows = {
  'timeout-failure-demo': timeoutFailureDemo,
  'cancellation-failure-demo': cancellationFailureDemo,
  'resource-failure-demo': resourceFailureDemo,
  'system-failure-demo': systemFailureDemo,
};

/** Narrow structural interface — see `fixtures/workflows.ts` for the pattern. */
export interface FailuresEngine {
  start(name: 'timeout-failure-demo', input: FailureDemoInput): Promise<WorkflowHandle>;
  start(name: 'cancellation-failure-demo', input: FailureDemoInput): Promise<WorkflowHandle>;
  start(name: 'resource-failure-demo', input: FailureDemoInput): Promise<WorkflowHandle>;
  start(name: 'system-failure-demo', input: FailureDemoInput): Promise<WorkflowHandle>;
}

/**
 * Starts and settles one terminal run per remaining failure category.
 * Awaited-with-catch so each run reaches its `failed` terminal (and commits
 * `failureCategory`) before the dev server starts serving — every one of
 * these is expected to fail.
 */
export async function seedFailures(engine: FailuresEngine): Promise<void> {
  const timeoutHandle = await engine.start('timeout-failure-demo', { orderId: 'ord_5001' });
  const cancellationHandle = await engine.start('cancellation-failure-demo', {
    orderId: 'ord_5002',
  });
  const resourceHandle = await engine.start('resource-failure-demo', { orderId: 'ord_5003' });
  const systemHandle = await engine.start('system-failure-demo', { orderId: 'ord_5004' });

  await Promise.all(
    [timeoutHandle, cancellationHandle, resourceHandle, systemHandle].map((handle) =>
      handle.result().catch(() => {
        // Expected — every failure-category demo always fails.
      }),
    ),
  );
}
