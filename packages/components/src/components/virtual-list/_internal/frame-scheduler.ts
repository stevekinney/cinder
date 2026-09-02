/**
 * A frame-scheduling port pair: `request` queues a callback for "the next
 * frame" and returns an id `cancel` can later use to drop it before it
 * fires. Shaped as data (not a class) so a test can hand `FrameBatcher` a
 * fully deterministic fake instead of depending on real
 * `requestAnimationFrame` timing.
 */
export type FrameScheduler = {
  readonly request: (callback: (time: number) => void) => number;
  readonly cancel: (id: number) => void;
};

/**
 * Sentinel id returned by {@link rafFrameScheduler}'s `request` when no
 * `requestAnimationFrame` exists in this environment (server rendering).
 * `cancel` treats it as any other id — real `cancelAnimationFrame`
 * implementations silently ignore an id they never issued, so no special
 * case is needed there.
 */
const NO_ANIMATION_FRAME_ID = -1;

/**
 * The real {@link FrameScheduler}, backed by `requestAnimationFrame` /
 * `cancelAnimationFrame`.
 *
 * Both globals are looked up lazily, INSIDE `request`/`cancel`, never at
 * module scope — referencing the bare identifier `requestAnimationFrame` at
 * module scope throws a `ReferenceError` the instant this module is
 * imported in a server-rendering environment, where no such global exists.
 * CIN-205 requires the whole `virtual-list` module tree to import cleanly
 * under SSR, so this module must not throw merely by being loaded, and
 * `request`/`cancel` must not throw merely by being called there either —
 * when `requestAnimationFrame` is absent, `request` reports
 * {@link NO_ANIMATION_FRAME_ID} and never invokes the callback. Nothing on
 * the server needs it to: Svelte does not run `$effect`s during SSR, so the
 * one caller of this scheduler (the `windowScroll` adapter's
 * `FrameBatcher`) never runs there either.
 *
 * A `FrameBatcher` built on this fallback path stays permanently inert
 * after its first `recordRead` — `request` returning without ever calling
 * back means nothing clears the batcher's "a frame is already scheduled"
 * flag, so later reads coalesce into a commit that never fires. This is the
 * intended shape of "fall back safely": no throw, no leaked timer, at the
 * cost of the batch simply never landing in an environment with no frames
 * to schedule onto in the first place.
 */
export const rafFrameScheduler: FrameScheduler = {
  request(callback) {
    // Invoked through globalThis rather than copied into a local first: browsers
    // that enforce the Web API receiver for Window methods throw "Illegal
    // invocation" when one is called bare.
    if (typeof globalThis.requestAnimationFrame === 'function') {
      return globalThis.requestAnimationFrame(callback);
    }
    return NO_ANIMATION_FRAME_ID;
  },
  cancel(id) {
    if (typeof globalThis.cancelAnimationFrame === 'function') {
      globalThis.cancelAnimationFrame(id);
    }
  },
};

/** A `recordRead` call captured for the frame currently awaiting commit. */
type PendingRead<T> = {
  readonly value: T;
};

/**
 * Coalesces N calls to recordRead within one frame into a single onCommit call on the
 * NEXT scheduled frame. This is CIN-202's mechanism for reads that Svelte's own
 * $effect.pre/$effect ordering does NOT already cover — specifically, genuinely
 * layout-forcing reads like getBoundingClientRect (used by the windowScroll adapter).
 * Plain $state-driven scroll-offset correction uses the $effect.pre/$effect split
 * instead (see "The engine" — CIN-202 interpretation).
 */
export class FrameBatcher<T> {
  readonly #onCommit: (value: T) => void;
  readonly #scheduler: FrameScheduler;
  #pending: PendingRead<T> | null = null;
  #frameId: number | null = null;
  #disposed = false;

  /**
   * @param onCommit Called with the LAST value passed to `recordRead` since
   *   the previous commit, once per scheduled frame.
   * @param scheduler Defaults to {@link rafFrameScheduler}. Tests inject a
   *   fake to make coalescing deterministic instead of depending on real
   *   frame timing.
   */
  constructor(onCommit: (value: T) => void, scheduler: FrameScheduler = rafFrameScheduler) {
    this.#onCommit = onCommit;
    this.#scheduler = scheduler;
  }

  /**
   * Records `value` as the pending read for the frame currently in flight,
   * overwriting any value already recorded for that frame. Schedules a
   * commit frame on the first call after a batch has committed (or after
   * construction); every subsequent call before that frame fires just
   * updates the pending value without scheduling a second frame. A no-op
   * after {@link dispose}.
   */
  recordRead(value: T): void {
    if (this.#disposed) return;
    this.#pending = { value };
    if (this.#frameId !== null) return;
    this.#frameId = this.#scheduler.request(() => {
      this.#frameId = null;
      const pending = this.#pending;
      this.#pending = null;
      if (this.#disposed || pending === null) return;
      this.#onCommit(pending.value);
    });
  }

  /**
   * Cancels any frame currently scheduled — dropping its pending value
   * without committing it — and makes every later `recordRead` inert.
   * Idempotent.
   */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    if (this.#frameId !== null) {
      this.#scheduler.cancel(this.#frameId);
      this.#frameId = null;
    }
    this.#pending = null;
  }
}
