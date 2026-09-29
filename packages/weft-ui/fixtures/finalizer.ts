/**
 * Finalizer demo fixture (plan §11, Appendix B "status badge set (incl.
 * finalizing + finalizer-failed)", Timeline "+ finalizer"). Records finalizer
 * state, then the seed cancels the run so the engine drives the
 * definition-level `finalizer` to durable completion in the background —
 * giving the console a live specimen that starts in `finalizing` and settles
 * to `cancelled` shortly after boot. See `fixtures/workflows.ts` for the
 * append-only contract this file participates in.
 */
import { activity, workflow, type WorkflowHandle } from '@lostgradient/weft';

interface SandboxSessionInput {
  sessionLabel: string;
}

const provisionSandbox = activity({
  name: 'provisionSandbox',
  execute: async (input: { sessionLabel: string }) => {
    return { sandboxId: `sbx_${input.sessionLabel}` };
  },
});

const destroySandbox = activity({
  name: 'destroySandbox',
  execute: async (input: { sandboxId: string }) => {
    // Idempotent by design (issue #446's finalizer contract): destroying an
    // already-destroyed sandbox must no-op, not throw, because the engine
    // may re-drive this after a stale-claim reclaim or a crash.
    return { sandboxId: input.sandboxId, destroyed: true };
  },
});

export const sandboxSession = workflow({ name: 'sandbox-session', finalizer: destroySandbox })
  .activities({ provisionSandbox })
  .execute(async function* (ctx, input: SandboxSessionInput) {
    // Recorded before the first `yield*` (rather than immediately after
    // `provisionSandbox` resolves, the usual guidance) so the seed's
    // `defer: false` start — which only guarantees the generator has been
    // driven to its FIRST yield point — is guaranteed to observe it already
    // staged. `destroySandbox` is idempotent regardless of whether
    // provisioning fully lands, so this ordering is safe here.
    const sandboxId = `sbx_${input.sessionLabel}`;
    ctx.setFinalizerState({ sandboxId });
    const sandbox = yield* ctx.run(provisionSandbox, { sessionLabel: input.sessionLabel });
    yield* ctx.sleep('24h');
    return { sandboxId: sandbox.sandboxId, awoke: true };
  });

/** Registerable workflow map — merged into `fixtures/workflows.ts`'s registry. */
export const finalizerWorkflows = {
  'sandbox-session': sandboxSession,
};

/** Narrow structural interface — see `fixtures/workflows.ts` for the pattern. */
export interface FinalizerEngine {
  start(
    name: 'sandbox-session',
    input: SandboxSessionInput,
    options?: { defer?: boolean },
  ): Promise<WorkflowHandle>;
}

/**
 * Starts the sandbox session (it parks on a 24h sleep), then cancels it.
 * `defer: false` waits for the generator to be driven to its first yield
 * point before `start()` resolves — since `ctx.setFinalizerState` now runs
 * before that first yield, this guarantees the finalizer is armed before
 * `cancel()` runs, instead of racing weft's default macrotask-deferred
 * execution. `handle.cancel()` resolves once the `cancelled` status is
 * durably committed; the finalizer's own teardown timer fires and drains
 * asynchronously afterward, so a developer opening the console shortly
 * after boot may catch it mid-`finalizing` — exactly the state this fixture
 * exists to exercise.
 */
export async function seedFinalizer(engine: FinalizerEngine): Promise<void> {
  const handle = await engine.start(
    'sandbox-session',
    { sessionLabel: 'demo-finalizer' },
    { defer: false },
  );
  await handle.cancel();
}
