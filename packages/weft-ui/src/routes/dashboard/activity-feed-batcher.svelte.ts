/**
 * Recent-activity feed batcher (plan §5's UI treatment: "incoming events
 * batched into ≤100ms frames"; this track's brief: "'+N events' pause-to-
 * read affordance"). `Feed`/`FeedEvent` (Cinder) is a live-region list
 * container — it has no batching or pause-to-read concept of its own, so
 * this small rune-based class owns both, decoupled from any DOM/component
 * so it can be unit-tested without one (PROJECT-BRIEF).
 *
 * Rows reuse `classifyFleetEvent`'s output shape (`../../app/
 * notifications.svelte.ts`) rather than re-deriving the 31-kind → icon/
 * text/href mapping, so the dashboard feed and the notification center
 * agree on copy for the same event.
 */
import type { NotificationTier } from '../../app/notifications.svelte.ts';

export interface ActivityFeedRow {
  readonly id: string;
  readonly tier: NotificationTier;
  readonly icon: string;
  readonly title: string;
  readonly body: string;
  readonly href: string;
  readonly emittedAtMs: number;
}

export interface ActivityFeedBatcherOptions {
  /** Batch flush window in ms. Defaults to 100 (plan §5). Overridable for deterministic tests. */
  readonly batchWindowMs?: number;
  /** Visible row cap. Defaults to 30 (mirrors `NotificationStore`'s 50-item history cap at a slightly smaller size, since this is a compact dashboard card, not the full notification center). */
  readonly visibleCap?: number;
  /** Held-while-paused row cap, to bound memory during a long read pause. Defaults to 200. */
  readonly heldCap?: number;
}

const DEFAULT_BATCH_WINDOW_MS = 100;
const DEFAULT_VISIBLE_CAP = 30;
const DEFAULT_HELD_CAP = 200;

/**
 * Batches ingested rows into ≤`batchWindowMs` flushes. While `paused`, newly
 * ingested rows accumulate in a held buffer (surfaced as `pendingCount`)
 * instead of appending to `items` — `resume()` flushes the held buffer into
 * view. Callers wire `pause()`/`resume()` to a hover (or similar
 * read-in-progress) interaction on the feed's DOM container.
 */
export class ActivityFeedBatcher {
  items: ActivityFeedRow[] = $state([]);
  pendingCount: number = $state(0);

  #paused = $state(false);

  get paused(): boolean {
    return this.#paused;
  }

  readonly #batchWindowMs: number;
  readonly #visibleCap: number;
  readonly #heldCap: number;

  #pending: ActivityFeedRow[] = [];
  #held: ActivityFeedRow[] = [];
  #flushTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: ActivityFeedBatcherOptions = {}) {
    this.#batchWindowMs = options.batchWindowMs ?? DEFAULT_BATCH_WINDOW_MS;
    this.#visibleCap = options.visibleCap ?? DEFAULT_VISIBLE_CAP;
    this.#heldCap = options.heldCap ?? DEFAULT_HELD_CAP;
  }

  /** Queues a row for the next batch flush. */
  ingest(row: ActivityFeedRow): void {
    this.#pending.push(row);
    this.#scheduleFlush();
  }

  /** Stops new rows from appending to `items`; they accumulate as `pendingCount` instead. */
  pause(): void {
    this.#paused = true;
  }

  /** Resumes live appending and flushes anything held while paused. */
  resume(): void {
    this.#paused = false;
    if (this.#held.length === 0) return;
    this.items = [...this.#held, ...this.items].slice(0, this.#visibleCap);
    this.#held = [];
    this.pendingCount = 0;
  }

  /** Clears the pending flush timer. Call on unmount so no flush fires after teardown. */
  dispose(): void {
    if (this.#flushTimer !== null) {
      clearTimeout(this.#flushTimer);
      this.#flushTimer = null;
    }
  }

  #scheduleFlush(): void {
    if (this.#flushTimer !== null) return;
    this.#flushTimer = setTimeout(() => {
      this.#flushTimer = null;
      this.#flushNow();
    }, this.#batchWindowMs);
  }

  #flushNow(): void {
    if (this.#pending.length === 0) return;
    // Newest-first: a batch is ingested oldest-to-newest, so reverse it
    // before prepending onto the (already newest-first) existing list.
    const batch = this.#pending.toReversed();
    this.#pending = [];

    if (this.#paused) {
      this.#held = [...batch, ...this.#held].slice(0, this.#heldCap);
      this.pendingCount = this.#held.length;
      return;
    }

    this.items = [...batch, ...this.items].slice(0, this.#visibleCap);
  }
}
