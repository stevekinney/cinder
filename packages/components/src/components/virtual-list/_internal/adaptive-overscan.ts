/**
 * Velocity-adaptive overscan for the virtual list (CIN-203).
 *
 * Everything in this module is dependency-free arithmetic: no DOM, no runes,
 * no `performance.now()`, no timers. It tracks scroll velocity from a stream
 * of `(scrollOffset, timestamp)` samples the caller hands it — Svelte's
 * `scroll` handler is the natural source, but nothing here reads it — and
 * turns that velocity into extra rows of overscan so a fast fling has rows
 * already mounted before they scroll into view. The configured `overscan`
 * the consumer asked for is always the FLOOR: adaptation only ever adds rows
 * on top of it, never renders fewer than the consumer's own request.
 */

/**
 * Smoothing factor for the exponential moving average `trackScrollVelocity`
 * applies to each newly observed instantaneous velocity. Chosen low (0.3) so
 * one anomalous frame — a layout hiccup that reports two samples 40ms apart
 * instead of the usual ~16ms, briefly reading as a much larger delta over
 * time — only pulls the smoothed velocity 30% of the way toward that spike
 * rather than jumping there outright. High enough that a genuine, sustained
 * velocity change still converges within a handful of frames (about 5
 * samples closes 80% of the gap) instead of visibly lagging the reader's
 * actual scroll speed.
 */
const VELOCITY_SMOOTHING_FACTOR = 0.3;

/**
 * Elapsed time, in milliseconds, beyond which two samples are treated as
 * belonging to separate scroll gestures rather than one continuous scroll,
 * resetting the tracked velocity to 0 instead of measuring a delta across
 * the gap. Momentum/wheel scroll callbacks fire roughly every 16ms (one
 * frame at 60Hz) while actively scrolling, so a gap this much larger than a
 * frame can only mean the reader stopped. 250ms sits comfortably above the
 * largest gap a live scroll should ever produce — even a dropped frame or
 * two — while still being short enough that a reader who pauses mid-scroll
 * and resumes quickly reads as having genuinely stopped, rather than
 * smoothing a fast-then-idle-then-fast sequence into one continuous "fast"
 * reading.
 */
const IDLE_RESET_THRESHOLD_IN_MILLISECONDS = 250;

/**
 * Immutable scroll-velocity state. Threaded through calls exactly like the
 * offsets/measurement state elsewhere in `_internal`: `createVelocityTracker`
 * produces the initial value, `trackScrollVelocity` takes one and returns a
 * new one — the input is never mutated, so callers (an `$effect`, a test) can
 * hold onto an old tracker and compare it against a new one safely.
 */
export type VelocityTracker = {
  /**
   * The scroll offset and timestamp of the last sample folded in, or `null`
   * before the first sample — `null` is what lets `trackScrollVelocity` tell
   * "no previous sample to diff against" apart from "a previous sample that
   * happened to sit at offset 0", which a sentinel number couldn't.
   */
  readonly lastScrollOffset: number;
  readonly lastTimestamp: number | null;
  /** Smoothed scroll speed, in pixels per millisecond. Always a magnitude — never negative. */
  readonly velocityInPixelsPerMillisecond: number;
};

/** The tracker's initial state: no prior sample, so no velocity yet. */
export function createVelocityTracker(): VelocityTracker {
  return { lastScrollOffset: 0, lastTimestamp: null, velocityInPixelsPerMillisecond: 0 };
}

/**
 * Folds one `(scrollOffset, timestamp)` sample into `tracker`, returning a
 * new tracker with an updated, EMA-smoothed velocity in pixels per
 * millisecond. `tracker` itself is never mutated.
 *
 * Velocity is always a magnitude: scrolling up and scrolling down at the
 * same speed produce the same value, because pop-in risk depends on how far
 * the viewport is about to sweep, not which direction it sweeps in.
 */
export function trackScrollVelocity(
  tracker: VelocityTracker,
  sample: { scrollOffset: number; timestamp: number },
): VelocityTracker {
  // No previous sample to diff against — reporting a delta over zero known
  // elapsed time would be Infinity/NaN, not 0, if this fell through to the
  // general branch below. Anchor here instead and let the NEXT sample
  // produce the first real velocity reading.
  if (tracker.lastTimestamp === null) {
    return {
      lastScrollOffset: sample.scrollOffset,
      lastTimestamp: sample.timestamp,
      velocityInPixelsPerMillisecond: 0,
    };
  }

  const elapsedInMilliseconds = sample.timestamp - tracker.lastTimestamp;

  // Two events stamped in the same millisecond, or a clock that went
  // backwards, would divide by zero (or a negative number). Rather than
  // advance the anchor on a degenerate sample — which would leave a later,
  // valid sample computing its delta over a shorter elapsed time than
  // actually passed, under-reporting velocity — leave the tracker exactly as
  // it was. The next sample with a genuinely later timestamp measures the
  // full delta over the full elapsed time since the last valid anchor, as if
  // the degenerate sample had never arrived.
  if (elapsedInMilliseconds <= 0) {
    return tracker;
  }

  // A gap this large means the reader stopped and later resumed, not that
  // they scrolled continuously very slowly. Without this reset, an EMA blend
  // would still weight in whatever velocity was current before the gap —
  // stale by definition, since it describes motion that ended long ago — and
  // report it alongside a fresh sample as if the scroll had been continuous.
  // Resetting treats the fresh sample as a new anchor, exactly like the
  // first-sample case, so the gap costs one reading of 0 rather than a
  // spurious blended spike.
  if (elapsedInMilliseconds >= IDLE_RESET_THRESHOLD_IN_MILLISECONDS) {
    return {
      lastScrollOffset: sample.scrollOffset,
      lastTimestamp: sample.timestamp,
      velocityInPixelsPerMillisecond: 0,
    };
  }

  const instantaneousVelocity =
    Math.abs(sample.scrollOffset - tracker.lastScrollOffset) / elapsedInMilliseconds;
  const smoothedVelocity =
    VELOCITY_SMOOTHING_FACTOR * instantaneousVelocity +
    (1 - VELOCITY_SMOOTHING_FACTOR) * tracker.velocityInPixelsPerMillisecond;

  return {
    lastScrollOffset: sample.scrollOffset,
    lastTimestamp: sample.timestamp,
    velocityInPixelsPerMillisecond: smoothedVelocity,
  };
}

/**
 * Assumed duration of one animation frame, in milliseconds, used to convert
 * a velocity into "how far the list will travel before the next frame gets a
 * chance to mount new rows." 60Hz (1000/60 ≈ 16.67ms) is the common
 * denominator refresh rate. A higher-refresh display mounts more often than
 * this assumes, which only makes overscan slightly more generous than
 * strictly necessary there — harmless, since the floor/ceiling guarantees
 * still hold either way. A lower-refresh or frame-dropping device is the
 * case this constant actually protects: it travels FARTHER than one real
 * frame implies, so erring toward this (rather than a shorter) frame
 * duration keeps overscan from under-provisioning exactly when the risk of
 * visible pop-in is highest.
 */
const ASSUMED_FRAME_DURATION_IN_MILLISECONDS = 1000 / 60;

/**
 * Default ceiling on adaptive overscan when the consumer does not supply
 * `maximumOverscan`. Overscan that scaled with velocity unbounded would mount
 * thousands of rows during a fast fling, defeating the point of virtualizing
 * at all — this clamp is the whole safety property. 50 extra rows on each
 * side comfortably covers a genuinely fast fling without bounding DOM size at
 * a number a real consumer would consider unreasonable.
 */
const DEFAULT_MAXIMUM_OVERSCAN = 50;

/**
 * Resolves how many rows of overscan to render given the current scroll
 * velocity. `baseOverscan` — the consumer's own configured `overscan`,
 * default 5 — is always the floor: the result never drops below it,
 * regardless of velocity. Extra rows are derived from velocity rather than a
 * magic lookup table: roughly, however many whole item-heights the list will
 * travel during one frame's worth of time at the current speed is how many
 * additional rows need to already be mounted so they don't pop in.
 */
export function resolveAdaptiveOverscan(options: {
  baseOverscan: number;
  velocityInPixelsPerMillisecond: number;
  itemSize: number;
  maximumOverscan?: number;
}): number {
  // Matches resolveVirtualOverscan's own floor/clamp convention elsewhere in
  // this component: an overscan the consumer configured is expected to
  // already be a non-negative integer, and a non-finite or negative one is a
  // caller bug this guards against rather than propagates.
  const baseOverscan = Number.isFinite(options.baseOverscan)
    ? Math.max(0, Math.floor(options.baseOverscan))
    : 0;

  // A zero (or negative) item size would divide by zero below, and a
  // collapsed/unmeasured row gives no meaningful "rows per frame of travel"
  // to derive — fall back to the floor rather than propagate NaN/Infinity.
  if (!(options.itemSize > 0)) return baseOverscan;

  const velocityInPixelsPerMillisecond = Number.isFinite(options.velocityInPixelsPerMillisecond)
    ? Math.max(0, options.velocityInPixelsPerMillisecond)
    : 0;

  const maximumOverscanOption = options.maximumOverscan;
  const resolvedMaximumOverscan =
    maximumOverscanOption !== undefined &&
    Number.isFinite(maximumOverscanOption) &&
    maximumOverscanOption > 0
      ? Math.floor(maximumOverscanOption)
      : DEFAULT_MAXIMUM_OVERSCAN;

  // Distance the list would travel in one frame at the current speed, in
  // item-heights. Rounded up (not down) because even partial coverage into
  // the next row means that row needs to be mounted for the frame it first
  // becomes partially visible.
  const extraRowsFromVelocity = Math.ceil(
    (velocityInPixelsPerMillisecond * ASSUMED_FRAME_DURATION_IN_MILLISECONDS) / options.itemSize,
  );

  const overscan = baseOverscan + extraRowsFromVelocity;

  // baseOverscan is the floor and resolvedMaximumOverscan the ceiling; the
  // floor wins if the two ever conflict (e.g. a misconfigured maximumOverscan
  // below baseOverscan), matching the acceptance criteria that adaptation
  // never renders fewer rows than the consumer asked for. Every input to
  // this expression is already an integer, so the result is too.
  return Math.max(baseOverscan, Math.min(overscan, resolvedMaximumOverscan));
}

/**
 * The row size adaptive overscan should convert a pixel velocity with.
 *
 * `estimateSize` is what the consumer guessed. In fixed mode that IS the row size and
 * there is nothing to improve on. Under `dynamicSize` it is only a starting point, and
 * the conversion from "pixels travelled this frame" to "rows to keep mounted" is
 * exactly where being wrong hurts: with a 100px estimate over rows measuring 10px, a
 * frame covering 100px reads as one row rather than the ten the viewport really
 * crossed, so the window widens by a tenth of what the reader is outrunning.
 *
 * `totalSize` comes from the offsets table, which already blends measured rows with
 * estimates for the ones not yet seen — the best answer available at any moment, and
 * one that improves as more rows are measured.
 *
 * Falls back to the estimate whenever the average is not a usable positive number: an
 * empty list, a table that has not been built, or a collection whose rows have all
 * measured zero.
 */
export function resolveAdaptiveItemSize(options: {
  dynamicSize: boolean;
  totalSize: number | undefined;
  itemCount: number;
  estimateSize: number;
}): number {
  if (!options.dynamicSize) return options.estimateSize;
  if (options.totalSize === undefined || options.itemCount <= 0) return options.estimateSize;
  const average = options.totalSize / options.itemCount;
  return Number.isFinite(average) && average > 0 ? average : options.estimateSize;
}
