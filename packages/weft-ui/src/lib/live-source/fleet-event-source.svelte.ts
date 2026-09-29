/**
 * `FleetEventSource` — the fleet-wide event feed (plan §5.2, T1.4): wraps
 * `GET /api/v1/events/sse` with `kind`/`workflowId` filters, `Last-Event-ID`
 * cursor resume, ONE shared connection fanned out to many subscribers.
 *
 * **Fan-out model.** Plan §5.2 is explicit that the app keeps exactly one
 * fleet SSE connection (the ≤3-connection budget in plan §5), while feeding
 * genuinely different consumers (dashboard activity feed, list-row
 * liveness, the notification center, worker fleet views). Those consumers
 * want *different* subsets of the 32-kind feed, so the shared connection
 * itself opens **unfiltered** (unless a caller passes a constructor-level
 * `filter` for a narrower, standalone connection) and each `subscribe()`
 * call layers its own client-side `FleetEventFilter` on top — the server
 * only ever sees one query, but many independently-filtered listeners
 * multiplex over its output. The connection opens lazily on the first
 * `subscribe()` call and closes when the last subscriber unsubscribes.
 *
 * **Transport.** See `sse-reader.ts`'s module doc for why this reads the
 * stream itself over `fetch()` instead of the platform `EventSource`.
 *
 * **HMR safety** (plan §2): every live instance is tracked in a
 * module-scope set; `import.meta.hot?.dispose` closes them all before Vite
 * swaps this module out, so a hot edit never leaves an orphaned connection.
 */
import { computeReconnectDelayMs } from './backoff.ts';
import { readServerSentEventStream, type ServerSentEventFrame } from './sse-reader.ts';
import type { LiveSource, LiveSourceStatus } from './types.ts';

/** One envelope from the fleet feed — the wire shape documented in plan Appendix A. */
export interface FleetEventFrame {
  readonly kind: string;
  readonly workflowId?: string;
  readonly sequence: number;
  readonly cursor: string;
  readonly emittedAtMs: number;
  readonly payload: unknown;
}

/** Client-side filter applied per `subscribe()` call, or server-side via the constructor. */
export interface FleetEventFilter {
  readonly kind?: string;
  readonly workflowId?: string;
}

export interface FleetEventSourceConfig {
  /** Same-origin-relative (`''`, `'/api'`) or absolute; never includes `/v1/events/sse` itself. */
  readonly baseUrl: string;
  readonly headers?: Record<string, string>;
  /**
   * Optional SERVER-side filter for this connection. Most callers omit
   * this — the shared app-wide instance stays unfiltered so independently
   * filtered subscribers can multiplex over it (see module doc). Set this
   * only when constructing a deliberately narrow, standalone connection.
   */
  readonly filter?: FleetEventFilter;
  /** Overrides the reconnect backoff curve. Defaults to `computeReconnectDelayMs` (plan §5.1's capped-exponential curve) — tests inject a near-zero function to avoid waiting on the real 1s+ backoff. */
  readonly computeReconnectDelayMs?: (attempt: number) => number;
}

interface FleetEventSubscriber {
  readonly onFrame: (frame: FleetEventFrame) => void;
  readonly filter: FleetEventFilter | undefined;
}

function matchesFilter(frame: FleetEventFrame, filter: FleetEventFilter | undefined): boolean {
  if (filter === undefined) return true;
  if (filter.kind !== undefined && frame.kind !== filter.kind) return false;
  if (filter.workflowId !== undefined && frame.workflowId !== filter.workflowId) return false;
  return true;
}

function buildFleetEventsUrl(baseUrl: string, filter: FleetEventFilter | undefined): string {
  const trimmed = baseUrl.replace(/\/+$/, '');
  const params = new URLSearchParams();
  if (filter?.workflowId !== undefined) params.set('workflowId', filter.workflowId);
  if (filter?.kind !== undefined) params.set('kind', filter.kind);
  const query = params.size > 0 ? `?${params.toString()}` : '';
  return `${trimmed}/v1/events/sse${query}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseJson(data: string): unknown {
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

function isReplayCompletePing(data: string): boolean {
  const parsed = parseJson(data);
  return isRecord(parsed) && parsed['replayComplete'] === true;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Parses one envelope frame's `data:` payload against the wire shape in plan Appendix A. */
function parseFleetEventFrame(data: string): FleetEventFrame | null {
  const parsed = parseJson(data);
  if (!isRecord(parsed)) return null;
  if (typeof parsed['kind'] !== 'string') return null;
  const sequence = finiteNumber(parsed['sequence']);
  if (sequence === null) return null;
  if (typeof parsed['cursor'] !== 'string') return null;
  const emittedAtMs = finiteNumber(parsed['emittedAtMs']);
  if (emittedAtMs === null) return null;
  if (!Object.hasOwn(parsed, 'payload')) return null;
  const workflowId = parsed['workflowId'];
  return {
    kind: parsed['kind'],
    ...(typeof workflowId === 'string' ? { workflowId } : {}),
    sequence,
    cursor: parsed['cursor'],
    emittedAtMs,
    payload: parsed['payload'],
  };
}

export class FleetEventSource implements LiveSource<FleetEventFrame> {
  status: LiveSourceStatus = $state('closed');

  /**
   * Number of reconnect attempts made since the last successful connect (0
   * while `live`/`connecting`/`closed`). `LiveSource<Frame>` itself has no
   * attempt-count member — this is an additive, non-breaking extra on the
   * concrete class, not a change to the frozen interface — so a caller that
   * wants to enforce a hard "give up on the push channel" cap (plan §5.3:
   * "SSE fails repeatedly (cap 5 attempts, then surface status)") can do so
   * without `FleetEventSource` itself needing to know about that policy
   * (`backoff.ts` deliberately leaves attempt-capping to callers).
   */
  get reconnectAttempt(): number {
    return this.#reconnectAttempt;
  }

  /**
   * True once the CURRENT connection's replay/catch-up phase has finished
   * (the server's `replayComplete: true` ping — plan Appendix A: "`ping`
   * keepalives carry no cursor; `replayComplete: true` marks catch-up
   * done"). Resets to `false` at the start of every (re)connect attempt.
   *
   * Exists because `status`/`whenConnected()` can't make this distinction:
   * both flip to `'live'`/resolved on the FIRST frame seen at all —
   * `#markLive()` runs for both a `replayComplete` ping AND an ordinary
   * envelope frame, and on a fresh connect (default cursor `-1`, weft
   * `INITIAL_CURSOR`) the server replays up to 1,000 historical events
   * before that ping. A caller that must tell "this frame just happened"
   * from "this frame is reconnect/catch-up backlog" (e.g. deciding whether
   * to spawn a toast for it) needs this, not `status`. Additive on the
   * concrete class — same non-breaking-extra precedent as `reconnectAttempt`.
   */
  get caughtUp(): boolean {
    return this.#caughtUp;
  }

  readonly #baseUrl: string;
  readonly #headers: Record<string, string>;
  readonly #connectionFilter: FleetEventFilter | undefined;
  readonly #computeReconnectDelayMs: (attempt: number) => number;

  readonly #subscribers = new Set<FleetEventSubscriber>();

  #abortController: AbortController | null = null;
  #reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  #reconnectAttempt = 0;
  #caughtUp = $state(false);
  #lastEventId: string | undefined;
  #closed = false;
  #connected: ReturnType<typeof Promise.withResolvers<void>> = Promise.withResolvers();

  constructor(config: FleetEventSourceConfig) {
    this.#baseUrl = config.baseUrl;
    this.#headers = config.headers ?? {};
    this.#connectionFilter = config.filter;
    this.#computeReconnectDelayMs = config.computeReconnectDelayMs ?? computeReconnectDelayMs;
    openFleetEventSources.add(this);
  }

  subscribe(onFrame: (frame: FleetEventFrame) => void, filter?: FleetEventFilter): () => void {
    const subscriber: FleetEventSubscriber = { onFrame, filter };
    this.#subscribers.add(subscriber);
    this.#ensureConnected();

    let unsubscribed = false;
    return () => {
      if (unsubscribed) return;
      unsubscribed = true;
      this.#subscribers.delete(subscriber);
      this.#disconnectIfNoSubscribers();
    };
  }

  whenConnected(): Promise<void> {
    return this.#connected.promise;
  }

  close(): void {
    if (this.#closed) return;
    this.#closed = true;
    this.#subscribers.clear();
    this.#teardownConnection();
    this.status = 'closed';
    this.#connected.resolve();
    openFleetEventSources.delete(this);
  }

  #ensureConnected(): void {
    if (this.#closed || this.#abortController !== null || this.#reconnectTimer !== null) return;
    this.#connected = Promise.withResolvers();
    this.#reconnectAttempt = 0;
    void this.#connect();
  }

  #disconnectIfNoSubscribers(): void {
    if (this.#subscribers.size > 0 || this.#closed) return;
    this.#teardownConnection();
    this.status = 'closed';
  }

  #teardownConnection(): void {
    this.#abortController?.abort();
    this.#abortController = null;
    if (this.#reconnectTimer !== null) {
      clearTimeout(this.#reconnectTimer);
      this.#reconnectTimer = null;
    }
  }

  async #connect(): Promise<void> {
    if (this.#closed) return;
    this.status = this.#reconnectAttempt === 0 ? 'connecting' : 'reconnecting';
    this.#caughtUp = false;

    const controller = new AbortController();
    this.#abortController = controller;
    try {
      const shouldReconnect = await this.#fetchAndDrain(controller);
      if (shouldReconnect) this.#scheduleReconnect();
    } finally {
      if (this.#abortController === controller) this.#abortController = null;
    }
  }

  /** Fetches the SSE endpoint and drains it. Returns whether the caller should schedule a reconnect (false for an explicit close/abort). */
  async #fetchAndDrain(controller: AbortController): Promise<boolean> {
    try {
      const response = await fetch(buildFleetEventsUrl(this.#baseUrl, this.#connectionFilter), {
        headers: this.#requestHeaders(),
        signal: controller.signal,
      });
      if (!response.ok || !isEventStreamResponse(response)) return true;

      for await (const frame of readServerSentEventStream(response, controller.signal)) {
        this.#handleFrame(frame);
        if (this.#closed) return false;
      }
      return !controller.signal.aborted;
    } catch {
      return !controller.signal.aborted;
    }
  }

  #requestHeaders(): Record<string, string> {
    const headers: Record<string, string> = { ...this.#headers, Accept: 'text/event-stream' };
    if (this.#lastEventId !== undefined) headers['Last-Event-ID'] = this.#lastEventId;
    return headers;
  }

  #handleFrame(frame: ServerSentEventFrame): void {
    if (frame.event === 'ping') {
      this.#reconnectAttempt = 0;
      if (isReplayCompletePing(frame.data)) {
        this.#markLive();
        this.#caughtUp = true;
      }
      return;
    }
    // `event: error` precedes the server closing the stream (see
    // `sse-stream.ts` `sanitizedErrorFrame`); the natural stream end just
    // after it drives the same reconnect path as any other drop.
    if (frame.event === 'error') return;

    const envelope = parseFleetEventFrame(frame.data);
    if (envelope === null) return;
    this.#lastEventId = frame.id ?? envelope.cursor;
    this.#reconnectAttempt = 0;
    this.#markLive();
    this.#dispatch(envelope);
  }

  #markLive(): void {
    this.status = 'live';
    // `Promise.withResolvers` resolvers are idempotent past the first
    // settle — safe to call on every heartbeat/frame with no extra guard.
    this.#connected.resolve();
  }

  #dispatch(envelope: FleetEventFrame): void {
    for (const subscriber of this.#subscribers) {
      if (matchesFilter(envelope, subscriber.filter)) subscriber.onFrame(envelope);
    }
  }

  #scheduleReconnect(): void {
    if (this.#closed || this.#subscribers.size === 0) return;
    this.status = 'reconnecting';
    this.#reconnectAttempt += 1;
    const delay = this.#computeReconnectDelayMs(this.#reconnectAttempt);
    this.#reconnectTimer = setTimeout(() => {
      this.#reconnectTimer = null;
      void this.#connect();
    }, delay);
  }
}

function isEventStreamResponse(response: Response): boolean {
  const contentType = response.headers.get('Content-Type');
  if (contentType === null) return false;
  return contentType.split(';', 1)[0]?.trim().toLowerCase() === 'text/event-stream';
}

// ---------------------------------------------------------------------------
// HMR safety (plan §2): close every open instance before a hot module swap.
// ---------------------------------------------------------------------------

const openFleetEventSources = new Set<FleetEventSource>();

import.meta.hot?.dispose(() => {
  for (const source of openFleetEventSources) source.close();
  openFleetEventSources.clear();
});
