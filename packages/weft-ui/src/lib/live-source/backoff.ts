/**
 * Shared exponential reconnect backoff (plan §5.1, T1.4): "exponential
 * backoff capped at 30s". Used by both `WorkflowTailSource` (reconnecting a
 * dropped `client.tail()`) and `FleetEventSource` (reconnecting a dropped
 * fleet SSE fetch) so the two sources agree on one retry curve instead of
 * each inventing its own.
 */

/** Base delay before the first reconnect attempt. */
export const RECONNECT_BASE_DELAY_MS = 1_000;

/** Hard cap plan §5.1 names explicitly: "capped at 30s". */
export const RECONNECT_MAX_DELAY_MS = 30_000;

/**
 * Delay before reconnect attempt number `attempt` (1-indexed: the delay
 * before the FIRST retry is `computeReconnectDelayMs(1)`). Doubles each
 * attempt from `RECONNECT_BASE_DELAY_MS`, capped at `RECONNECT_MAX_DELAY_MS`.
 * Retries are not attempt-capped here — only the delay is capped — callers
 * that want a hard stop (e.g. `PollingSource`'s "5 consecutive failures")
 * enforce that themselves.
 */
export function computeReconnectDelayMs(attempt: number): number {
  if (attempt < 1) {
    throw new Error(`computeReconnectDelayMs: attempt must be >= 1, got ${attempt}`);
  }
  const exponential = RECONNECT_BASE_DELAY_MS * 2 ** (attempt - 1);
  return Math.min(exponential, RECONNECT_MAX_DELAY_MS);
}
