/**
 * Session-scoped rolling history for the Metrics dashboard's sparklines
 * (plan §9.7 T7.2: "StatGroup + LineChart sparklines from
 * GET /api/v1/metrics/json … ~15s PollingSource").
 *
 * `weft.system.metrics` (`@lostgradient/weft`'s
 * `MetricsSnapshot`) is a POINT-IN-TIME snapshot — counters/gauges/histogram
 * summaries, no history of their own. The sparklines are built by keeping a
 * bounded client-side buffer of successive polls, exactly like a `top`-style
 * dashboard would; this module is that buffer, kept framework-free so its
 * trimming/series-building logic is unit-testable without a live poll loop.
 * The history starts empty on every page load — it is explicitly NOT a
 * durability claim (matches the plan's "session-scoped" framing elsewhere,
 * e.g. the Alerts view).
 */
import type { CounterMetric, GaugeMetric, HistogramMetric } from '@lostgradient/weft';

export type MetricEntryLike = CounterMetric | GaugeMetric | HistogramMetric;
export type MetricsSnapshotLike = Readonly<Record<string, MetricEntryLike>>;

export interface MetricsHistoryPoint {
  readonly atMs: number;
  readonly snapshot: MetricsSnapshotLike;
}

/** Numeric value a snapshot entry contributes to a sparkline — `value` for counter/gauge, `p99` for histogram (the tail-latency figure operators care about on a duration histogram). */
export function metricPointValue(entry: MetricEntryLike | undefined): number {
  if (entry === undefined) return 0;
  if (entry.type === 'histogram') return entry.p99;
  return entry.value;
}

const DEFAULT_HISTORY_LIMIT = 20;

/** Bounded FIFO buffer of `MetricsSnapshot` polls, newest last. */
export class MetricsHistory {
  #points: MetricsHistoryPoint[] = [];
  readonly #limit: number;

  constructor(limit: number = DEFAULT_HISTORY_LIMIT) {
    this.#limit = limit;
  }

  get points(): readonly MetricsHistoryPoint[] {
    return this.#points;
  }

  get latest(): MetricsSnapshotLike | undefined {
    return this.#points.at(-1)?.snapshot;
  }

  push(snapshot: MetricsSnapshotLike, atMs: number = Date.now()): void {
    this.#points = [...this.#points, { atMs, snapshot }].slice(-this.#limit);
  }

  /** A `LineChart`-ready single-series data array for one metric name across the buffered history. */
  series(metricName: string): readonly { readonly x: number; readonly y: number }[] {
    return this.#points.map((point) => ({
      x: point.atMs,
      y: metricPointValue(point.snapshot[metricName]),
    }));
  }
}
