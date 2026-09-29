/**
 * `PollingSource` — the interval-refetch fallback (plan §5.3, T1.4):
 * wraps an async fetch on an interval, suspending while `document.hidden`,
 * closing after 5 consecutive failures. Used when the principal lacks
 * `events:read`, when SSE fails repeatedly, and as the default for
 * low-churn surfaces (metrics ~15s, workers ~30s).
 *
 * Unlike `FleetEventSource`, a `PollingSource` does not stop itself when its
 * subscriber count drops to zero — it is typically already scoped 1:1 to
 * one query/surface by its owner (a metrics panel, a worker list), and that
 * owner is expected to call `close()` when it unmounts. There is no shared,
 * app-wide `PollingSource` instance the way there is for `FleetEventSource`.
 *
 * **HMR safety** (plan §2): every live instance is tracked in a
 * module-scope set; `import.meta.hot?.dispose` closes them all before Vite
 * swaps this module out.
 */
import { type LiveSource, type LiveSourceStatus } from './types.ts';

export interface PollingSourceOptions {
  readonly intervalMs: number;
}

const MAX_CONSECUTIVE_FAILURES = 5;

export class PollingSource<Frame> implements LiveSource<Frame> {
  status: LiveSourceStatus = $state('polling');

  readonly #fetchFrame: () => Promise<Frame>;
  readonly #intervalMs: number;

  readonly #subscribers = new Set<(frame: Frame) => void>();
  #timer: ReturnType<typeof setTimeout> | null = null;
  #consecutiveFailures = 0;
  #closed = false;
  #started = false;
  #pausedForVisibility = false;
  #visibilityListener: (() => void) | null = null;
  #connected: ReturnType<typeof Promise.withResolvers<void>> = Promise.withResolvers();

  constructor(fetchFrame: () => Promise<Frame>, options: PollingSourceOptions) {
    this.#fetchFrame = fetchFrame;
    this.#intervalMs = options.intervalMs;
    openPollingSources.add(this);
  }

  subscribe(onFrame: (frame: Frame) => void): () => void {
    this.#subscribers.add(onFrame);
    this.#ensureRunning();
    return () => {
      this.#subscribers.delete(onFrame);
    };
  }

  whenConnected(): Promise<void> {
    return this.#connected.promise;
  }

  close(): void {
    if (this.#closed) return;
    this.#closed = true;
    if (this.#timer !== null) {
      clearTimeout(this.#timer);
      this.#timer = null;
    }
    if (this.#visibilityListener !== null) {
      document.removeEventListener('visibilitychange', this.#visibilityListener);
      this.#visibilityListener = null;
    }
    this.status = 'closed';
    this.#connected.resolve();
    openPollingSources.delete(this);
  }

  #ensureRunning(): void {
    if (this.#closed || this.#started) return;
    this.#started = true;
    this.#installVisibilityListener();
    this.#scheduleTick(0);
  }

  #installVisibilityListener(): void {
    this.#visibilityListener = () => {
      if (document.hidden || !this.#pausedForVisibility || this.#closed) return;
      this.#pausedForVisibility = false;
      this.#scheduleTick(0);
    };
    document.addEventListener('visibilitychange', this.#visibilityListener);
  }

  #scheduleTick(delayMs: number): void {
    if (this.#closed) return;
    if (document.hidden) {
      this.#pausedForVisibility = true;
      return;
    }
    this.#timer = setTimeout(() => {
      this.#timer = null;
      void this.#tick();
    }, delayMs);
  }

  async #tick(): Promise<void> {
    if (this.#closed) return;
    const outcome = await this.#fetchOnce();
    if (this.#closed) return;
    if (!outcome.ok && this.#consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      this.close();
      return;
    }
    this.#scheduleTick(this.#intervalMs);
  }

  async #fetchOnce(): Promise<{ ok: boolean }> {
    try {
      const frame = await this.#fetchFrame();
      this.#consecutiveFailures = 0;
      this.status = 'polling';
      this.#connected.resolve();
      for (const subscriber of this.#subscribers) subscriber(frame);
      return { ok: true };
    } catch {
      this.#consecutiveFailures += 1;
      return { ok: false };
    }
  }
}

// ---------------------------------------------------------------------------
// HMR safety (plan §2): close every open instance before a hot module swap.
// ---------------------------------------------------------------------------

const openPollingSources = new Set<{ close(): void }>();

import.meta.hot?.dispose(() => {
  for (const source of openPollingSources) source.close();
  openPollingSources.clear();
});
