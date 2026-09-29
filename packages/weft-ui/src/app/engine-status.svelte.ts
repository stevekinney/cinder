/**
 * The shell's one shared `FleetEventSource` connection (plan §5's ≤3-socket
 * connection budget: "one fleet SSE … never per-row/per-surface
 * connections") plus the `/v1/health` polling fallback that backs the
 * sidebar's engine-status pill (plan §13 T1.6).
 *
 * `FleetEventSource`'s `baseUrl`/`headers` reuse the already-constructed
 * `HttpClient`'s own public `baseUrl`/`headers` fields verbatim (both
 * `readonly` on `HttpClient`, `weft/src/client/http-client.ts`) rather than
 * re-deriving them from runtime config — `HttpClient` and `FleetEventSource`
 * are proven, by `live-source-test-server.test-support.ts` (T1.4's own
 * integration-test harness), to expect the SAME unprefixed origin (no
 * `/api`; the server's HTTP front door matches `/v1/...` directly, `/api`
 * being an optional external namespace it strips before routing) — so no
 * new base-URL-resolution logic is needed here at all.
 *
 * Every notification-worthy frame is forwarded into the shell's
 * `NotificationStore` (`./notifications.svelte.ts`) — this module is the
 * ONE place a fleet frame is received and fanned out, so a future
 * dashboard/list-liveness consumer subscribing to the same shared source
 * never doubles the connection.
 *
 * Critical/warning notifications additionally spawn a real toast (design
 * `Weft New Surfaces.dc.html` §C: "critical → strip + toast, warning →
 * toast, info → bell only"), gated on `FleetEventSource.caughtUp` — a fresh
 * connection replays up to 1,000 historical fleet events before it, and
 * every one of those would otherwise toast on page load. `ingest()` still
 * runs unconditionally, so the bell dropdown/critical strip reflect the full
 * replayed backlog; only the ephemeral toast is suppressed for it.
 */
import { getContext, setContext } from 'svelte';

import type { HttpClient } from '@lostgradient/weft';

import {
  FleetEventSource,
  type FleetEventFrame,
} from '../lib/live-source/fleet-event-source.svelte.ts';
import { PollingSource } from '../lib/live-source/polling-source.svelte.ts';
import type { LiveSourceStatus } from '../lib/live-source/types.ts';
import { router } from '../lib/router.svelte.ts';
import type { NotificationItem, NotificationStore } from './notifications.svelte.ts';
import { showToast } from './toast-host.svelte';

const DEFAULT_HEALTH_POLL_INTERVAL_MS = 20_000;

/**
 * Cinder's `<ToastRegion>` has two urgency channels, keyed off `variant`:
 * `info`/`success`/`warning` are polite (`role="status"`), `danger` is
 * assertive (`role="alert"`, `toast-region.svelte`'s `isPolite()`) — matching
 * the design caption ("critical → toast role=alert, warning → toast
 * role=status"). Previously (Cinder ≤0.16.1) `warning` was routed to the
 * assertive channel alongside `danger` — filed upstream as
 * https://github.com/stevekinney/cinder/issues/800 and fixed in Cinder
 * 0.19.0's `isPolite()`, so no app-local workaround is needed here anymore.
 */
function toastForNotification(item: NotificationItem): void {
  if (item.tier === 'info') return;
  showToast(`${item.title} — ${item.body}`, {
    variant: item.tier === 'critical' ? 'danger' : 'warning',
    duration: item.tier === 'critical' ? 0 : 6_000,
    showIcon: true,
    action: { label: 'View', onAction: () => router.navigate(item.href) },
  });
}

/**
 * Plan §5.3: "SSE fails repeatedly (cap 5 attempts, then surface status)".
 * Matches `PollingSource`'s own `MAX_CONSECUTIVE_FAILURES` cap so the two
 * fallback triggers (principal lacks `events:read` vs. SSE flapping) read as
 * one consistent policy.
 */
const FLEET_STATUS_FALLBACK_AFTER_ATTEMPTS = 5;

async function checkHealth(client: Pick<HttpClient, 'baseUrl' | 'headers'>): Promise<true> {
  const response = await fetch(`${client.baseUrl}/v1/health`, { headers: client.headers });
  if (!response.ok) throw new Error(`weft-ui: /v1/health responded ${response.status}`);
  return true;
}

export interface EngineStatusControllerOptions {
  /** Overrides the `/v1/health` poll interval — tests inject a small value rather than waiting out the real 20s default. */
  readonly healthPollIntervalMs?: number;
  /** Overrides the fleet source's reconnect backoff curve — tests inject a near-zero function rather than waiting out the real 1s+/attempt curve to reach the fallback cap. */
  readonly fleetReconnectDelayMs?: (attempt: number) => number;
}

export class EngineStatusController {
  readonly fleetSource: FleetEventSource;
  readonly #healthPoll: PollingSource<true>;
  readonly #unsubscribeFleet: () => void;
  readonly #unsubscribeHealth: () => void;

  constructor(
    client: Pick<HttpClient, 'baseUrl' | 'headers'>,
    notifications: NotificationStore,
    options?: EngineStatusControllerOptions,
  ) {
    this.fleetSource = new FleetEventSource({
      baseUrl: client.baseUrl,
      headers: client.headers,
      ...(options?.fleetReconnectDelayMs === undefined
        ? {}
        : { computeReconnectDelayMs: options.fleetReconnectDelayMs }),
    });
    this.#healthPoll = new PollingSource(() => checkHealth(client), {
      intervalMs: options?.healthPollIntervalMs ?? DEFAULT_HEALTH_POLL_INTERVAL_MS,
    });

    this.#unsubscribeFleet = this.fleetSource.subscribe((frame: FleetEventFrame) => {
      const item = notifications.ingest(frame);
      if (item && this.fleetSource.caughtUp) toastForNotification(item);
    });
    this.#unsubscribeHealth = this.#healthPoll.subscribe(() => {});
  }

  /**
   * The pill's displayed status: the fleet feed's real connection state
   * whenever it is connecting/live/closed, falling back to the `/v1/health`
   * poll's status once the fleet feed has failed to reconnect
   * `FLEET_STATUS_FALLBACK_AFTER_ATTEMPTS` times in a row (plan §5.3: "SSE
   * fails repeatedly (cap 5 attempts, then surface status)").
   *
   * The fleet source keeps retrying in the background at its own capped
   * curve even after the fallback engages (`backoff.ts` never stops on its
   * own — see that module's doc) — so if the push channel comes back the
   * pill recovers to `'live'` on its own the next successful frame, with no
   * action needed here. Falling back on `fleetSource.status === 'closed'`
   * alone (the original design) was dead code in steady-state failure: the
   * constructor's synchronous `subscribe()` call flips `FleetEventSource`
   * straight to `'connecting'`, and it then cycles
   * `'connecting'`/`'reconnecting'` forever on a down server — it never
   * settles back to `'closed'` short of an explicit `dispose()` — so the
   * pill would read "reconnecting" indefinitely with no health-poll fallback
   * ever visible. The `reconnectAttempt` check below is what actually makes
   * the fallback reachable.
   */
  get status(): LiveSourceStatus {
    const fleetFailedRepeatedly =
      this.fleetSource.reconnectAttempt >= FLEET_STATUS_FALLBACK_AFTER_ATTEMPTS;
    return this.fleetSource.status === 'closed' || fleetFailedRepeatedly
      ? this.#healthPoll.status
      : this.fleetSource.status;
  }

  dispose(): void {
    this.#unsubscribeFleet();
    this.#unsubscribeHealth();
    this.fleetSource.close();
    this.#healthPoll.close();
  }
}

// ---------------------------------------------------------------------------
// Shared FleetEventSource context (Track B / T4.1 addition — see PROJECT-BRIEF
// "if something genuinely blocks you … make the smallest local workaround")
// ---------------------------------------------------------------------------

/**
 * Provides `shell.svelte`'s ALREADY-CONSTRUCTED `EngineStatusController.fleetSource`
 * to descendant route components, mirroring `../lib/client.ts`'s
 * `provideClient()`/`getClient()` pattern.
 *
 * Domain surfaces that need a live fleet-event subscription (e.g. the
 * Schedule Detail page's `schedule:fired`/`schedule:missed-fire` live update —
 * plan §9.3) must reuse this ONE shared connection, never construct their own
 * `FleetEventSource` — plan §5's "≤3 concurrent sockets … one fleet SSE …
 * never per-row/per-surface connections" budget is a hard constraint, and
 * `FleetEventSource.subscribe()` is explicitly designed for exactly this
 * fan-out (see that class's module doc). Before this addition there was no
 * way for a route component to reach the shell's instance at all — `Shell`
 * only forwarded `engineStatus.status`/`engineStatus.fleetSource.status` as
 * plain props to `<Sidebar>`/`<Topbar>`, not the source itself, and
 * `RouteOutlet` passes no props to route components. This is the smallest
 * fix: two calls (provide here in `shell.svelte`, get in the consuming
 * route), no change to `EngineStatusController`'s own behavior or tests.
 */
const FLEET_EVENT_SOURCE_CONTEXT_KEY = Symbol('weft-ui-fleet-event-source');

export function provideFleetEventSource(source: FleetEventSource): void {
  setContext(FLEET_EVENT_SOURCE_CONTEXT_KEY, source);
}

/**
 * Reads the shell's shared `FleetEventSource` from context. Throws when
 * called outside a component tree rendered below `<Shell>` — every route
 * component qualifies, since `<RouteOutlet>` always renders inside `<Shell>`.
 */
export function getFleetEventSource(): FleetEventSource {
  const source = getContext<FleetEventSource | undefined>(FLEET_EVENT_SOURCE_CONTEXT_KEY);
  if (!source) {
    throw new Error(
      'weft-ui: getFleetEventSource() called with no source in context — provideFleetEventSource() must run in an ancestor component.',
    );
  }
  return source;
}
