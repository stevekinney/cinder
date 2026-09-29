/**
 * `WorkflowTailSource` — the per-workflow live event tail (plan §5.1, T1.4):
 * wraps `client.tail(id)` from `@lostgradient/weft`.
 *
 * **Why an outer reconnect layer on top of `client.tail()`.** The
 * underlying `WorkflowEventTail` already reconnects internally (both its
 * WebSocket and SSE transports), but its built-in policy is a FAST, SHORT
 * retry (linear backoff from a 50ms base, capped at 5 attempts by default —
 * see `weft/src/client/event-stream.ts`), and once exhausted the tail
 * closes for good with no way to resume it. Plan §5.1 calls for "exponential
 * backoff capped at 30s" with no attempt ceiling — an operator watching a
 * live incident should not have the tail silently give up after under a
 * second of retries. So this source treats the whole `client.tail(id)` call
 * as one attempt: when it ends for any reason other than an explicit
 * `close()` or an observed terminal workflow event, it opens a BRAND NEW
 * `client.tail(id)` after its own capped-exponential delay.
 *
 * **Cross-reconnect dedup.** A fresh `client.tail(id)` call always replays
 * the workflow's FULL persisted history from the start (`getEvents()` under
 * the hood) — it has no memory of a previous, now-closed subscription. To
 * avoid re-delivering everything the subscriber already saw, this source
 * counts how many frames it has delivered so far (`#deliveredCount`) and,
 * on each new tail, skips exactly that many positions before delivering
 * again. `WorkflowEvent` carries no stable sequence id (documented on
 * `client.tail()`'s own JSDoc), so this positional comparison is the same
 * strategy `client.tail()`'s own internal reconnect uses
 * (`#historyWatermark`) — sound in the common case, with the same
 * documented compaction-edge-case caveat that strategy inherits.
 *
 * **Terminal detection.** The public `WorkflowEventTail` interface exposes
 * no `closeReason`, so this source cannot ask the tail *why* its iteration
 * ended. Instead it watches each delivered frame's `.type` itself
 * (`isTerminalWorkflowEventType`, shared with `cache-integration.ts`) — once
 * a terminal lifecycle event has been observed, the workflow is genuinely
 * done and the source settles to `'closed'` instead of reconnecting.
 *
 * **Buffer.** Single-consumer (`subscribe()` throws on a second concurrent
 * caller). The bounded ~500-frame buffer exists ONLY for the pre-attach
 * window — `#connect()` starts in the constructor, before any `subscribe()`
 * call, so frames can arrive before there is anyone to deliver them to. Once
 * a subscriber IS attached, frames go straight to it; there is no
 * steady-state mirror of history sitting behind the buffer (that durability
 * job belongs to the TanStack cache — see plan §5.1 and
 * `cache-integration.ts`). Overflowing the pre-attach buffer means frames
 * were dropped before anyone ever saw them; that's surfaced as `'stale'`.
 *
 * **HMR safety** (plan §2): every live instance is tracked in a
 * module-scope set; `import.meta.hot?.dispose` closes them all before Vite
 * swaps this module out.
 */
import type { WorkflowEvent, WorkflowEventTail } from '@lostgradient/weft';

import { computeReconnectDelayMs } from './backoff.ts';
import type { LiveSource, LiveSourceStatus } from './types.ts';
import { isTerminalWorkflowEventType } from './workflow-lifecycle-events.ts';

/** The subset of `HttpClient` (and `LocalClient`) `WorkflowTailSource` needs — narrow on purpose so tests can inject a fake without a real client. */
export interface WorkflowEventTailOpener {
  tail(id: string): WorkflowEventTail;
}

export interface WorkflowTailSourceOptions {
  /** Pre-attach buffer cap. Default 500 (plan §5.1: "bounded ~500 frames"). */
  readonly bufferLimit?: number;
  /** Overrides the reconnect backoff curve. Defaults to `computeReconnectDelayMs` (plan §5.1's capped-exponential curve) — tests inject a near-zero function to avoid waiting on the real 1s+ backoff. */
  readonly computeReconnectDelayMs?: (attempt: number) => number;
}

const DEFAULT_BUFFER_LIMIT = 500;

export class WorkflowTailSource implements LiveSource<WorkflowEvent> {
  status: LiveSourceStatus = $state('connecting');

  readonly #client: WorkflowEventTailOpener;
  readonly #workflowId: string;
  readonly #bufferLimit: number;
  readonly #computeReconnectDelayMs: (attempt: number) => number;

  #subscriber: ((frame: WorkflowEvent) => void) | null = null;
  #preAttachBuffer: WorkflowEvent[] = [];
  #deliveredCount = 0;

  #tail: WorkflowEventTail | null = null;
  #closed = false;
  #reconnectAttempt = 0;
  #reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  #connected: ReturnType<typeof Promise.withResolvers<void>> = Promise.withResolvers();

  constructor(
    client: WorkflowEventTailOpener,
    workflowId: string,
    options?: WorkflowTailSourceOptions,
  ) {
    this.#client = client;
    this.#workflowId = workflowId;
    this.#bufferLimit = options?.bufferLimit ?? DEFAULT_BUFFER_LIMIT;
    this.#computeReconnectDelayMs = options?.computeReconnectDelayMs ?? computeReconnectDelayMs;
    openWorkflowTailSources.add(this);
    void this.#connect();
  }

  subscribe(onFrame: (frame: WorkflowEvent) => void): () => void {
    if (this.#subscriber !== null) {
      throw new Error(
        `WorkflowTailSource(${this.#workflowId}): only one subscriber is supported at a time — unsubscribe the current one before attaching another.`,
      );
    }
    this.#subscriber = onFrame;
    const buffered = this.#preAttachBuffer;
    this.#preAttachBuffer = [];
    for (const frame of buffered) onFrame(frame);
    if (this.status === 'stale' && this.#tail !== null) this.status = 'live';

    return () => {
      if (this.#subscriber === onFrame) this.#subscriber = null;
    };
  }

  whenConnected(): Promise<void> {
    return this.#connected.promise;
  }

  close(): void {
    if (this.#closed) return;
    this.#closed = true;
    this.#tail?.close();
    this.#tail = null;
    if (this.#reconnectTimer !== null) {
      clearTimeout(this.#reconnectTimer);
      this.#reconnectTimer = null;
    }
    this.status = 'closed';
    this.#connected.resolve();
    openWorkflowTailSources.delete(this);
  }

  async #connect(): Promise<void> {
    if (this.#closed) return;
    this.status = this.#reconnectAttempt === 0 ? 'connecting' : 'reconnecting';

    let tail: WorkflowEventTail;
    try {
      tail = this.#client.tail(this.#workflowId);
    } catch {
      this.#scheduleReconnect();
      return;
    }
    this.#tail = tail;

    const sawTerminalEvent = await this.#drain(tail);
    if (this.#tail === tail) this.#tail = null;
    if (this.#closed) return;

    if (sawTerminalEvent) {
      this.status = 'closed';
      this.#connected.resolve();
      return;
    }
    this.#scheduleReconnect();
  }

  /** Drains one `client.tail()` call. Returns whether a terminal workflow event was observed. */
  async #drain(tail: WorkflowEventTail): Promise<boolean> {
    await tail.whenConnected();
    if (this.#closed) return false;
    this.status = 'live';
    this.#reconnectAttempt = 0;
    this.#connected.resolve();

    let index = 0;
    for await (const event of tail) {
      index += 1;
      if (index <= this.#deliveredCount) continue; // already delivered by a previous connect cycle
      this.#deliveredCount += 1;
      this.#emit(event);
      if (this.#closed) return false;
      if (isTerminalWorkflowEventType(event.type)) return true;
    }
    return false;
  }

  #emit(frame: WorkflowEvent): void {
    if (this.#subscriber !== null) {
      this.#subscriber(frame);
      return;
    }
    this.#preAttachBuffer.push(frame);
    if (this.#preAttachBuffer.length > this.#bufferLimit) {
      this.#preAttachBuffer.shift();
      this.status = 'stale';
    }
  }

  #scheduleReconnect(): void {
    if (this.#closed) return;
    this.status = 'reconnecting';
    this.#reconnectAttempt += 1;
    const delay = this.#computeReconnectDelayMs(this.#reconnectAttempt);
    this.#reconnectTimer = setTimeout(() => {
      this.#reconnectTimer = null;
      void this.#connect();
    }, delay);
  }
}

// ---------------------------------------------------------------------------
// HMR safety (plan §2): close every open instance before a hot module swap.
// ---------------------------------------------------------------------------

const openWorkflowTailSources = new Set<WorkflowTailSource>();

import.meta.hot?.dispose(() => {
  for (const source of openWorkflowTailSources) source.close();
  openWorkflowTailSources.clear();
});
