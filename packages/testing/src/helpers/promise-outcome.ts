/**
 * Awaited replacements for `expect(promise).rejects`.
 *
 * Bun runs `.resolves` and `.rejects` synchronously: the matcher spins a
 * nested event loop until the promise settles, and a promise settled by a
 * Worker message can starve inside it. `scripts/check-promise-assertion-modifiers.ts`
 * bans both modifiers. Assert on `expect(await promise)` for a resolution, and
 * on these helpers for a rejection.
 *
 * The mirror publishes packages to separate targets, so this module is copied
 * byte-for-byte into each package that cannot import `@lostgradient/testing`.
 * The canonical copy is `packages/testing/src/helpers/promise-outcome.ts`, and
 * the checker fails if a copy drifts from it.
 */

/**
 * Await `promise` and return its rejection reason. Throws when the promise
 * resolves instead, so an unexpected success still fails the assertion.
 *
 * Like `expect`, it accepts any value: a call site may hold `Promise<T> |
 * undefined` or `T | Promise<T>`. A value that is not a promise counts as
 * resolved, so it fails the same way `.rejects` did.
 */
export async function rejectionOf(promise: unknown): Promise<unknown> {
  let value: unknown;
  try {
    value = await promise;
  } catch (reason) {
    return reason;
  }
  throw new Error(`Expected the promise to reject, but it resolved with ${Bun.inspect(value)}`);
}

/**
 * Await `promise` and return a function that rethrows its rejection reason.
 * Bun's `toThrow` accepts only a function, so this keeps `toThrow`'s own
 * matching for a message, a pattern, an error class, or any throw.
 */
export async function throwingRejectionOf(promise: unknown): Promise<() => never> {
  const reason = await rejectionOf(promise);
  return () => {
    throw reason;
  };
}
