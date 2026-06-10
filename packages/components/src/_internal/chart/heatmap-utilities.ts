/**
 * Shared heatmap math for grid-style charts (MatrixChart, Spectrogram).
 *
 * Both render a grid of cells coloured by magnitude. The normalization,
 * degenerate-domain handling, diverging zero-centering, and NaN/Infinity
 * filtering are identical, so they live here rather than drifting between the
 * two component implementations.
 */

export type HeatmapColorScale = 'sequential' | 'diverging';

/**
 * Keep only finite numbers. `NaN`, `Infinity`, `-Infinity`, `null`, and
 * `undefined` are dropped — invalid values must render as "missing" cells, not
 * poison `Math.min`/`Math.max`, normalization, or `color-mix(... NaN%)`.
 */
export function finiteNumbers(values: ReadonlyArray<number | null | undefined>): number[] {
  const result: number[] = [];
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) result.push(value);
  }
  return result;
}

/** A finite number, or `null` for anything non-finite (the "missing cell" sentinel). */
export function toFiniteOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export type HeatmapDomain = {
  readonly min: number;
  readonly max: number;
  /** Empty when there are no finite values to scale. */
  readonly isEmpty: boolean;
};

/**
 * Compute the [min, max] domain over the finite values only.
 *
 * A single pass — NOT `Math.min(...finite)` — so a dense heatmap or a
 * multi-thousand-bin spectrogram can't overflow the call stack / argument limit
 * by spreading a huge array into the `Math` functions.
 */
export function heatmapDomain(values: ReadonlyArray<number | null | undefined>): HeatmapDomain {
  let min = Infinity;
  let max = -Infinity;
  let count = 0;
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      if (value < min) min = value;
      if (value > max) max = value;
      count += 1;
    }
  }
  if (count === 0) return { min: 0, max: 1, isEmpty: true };
  return { min, max, isEmpty: false };
}

/**
 * Compute the [min, max] domain over a sequence of rows (e.g. spectrogram
 * frames) WITHOUT first flattening them into one big array. A single nested pass
 * over the original arrays, so a large frames × bins grid never materializes a
 * full flattened copy just to find its colour domain.
 */
export function heatmapDomainOfRows(
  rows: ReadonlyArray<ReadonlyArray<number | null | undefined>>,
): HeatmapDomain {
  let min = Infinity;
  let max = -Infinity;
  let count = 0;
  for (const row of rows) {
    for (const value of row) {
      if (typeof value === 'number' && Number.isFinite(value)) {
        if (value < min) min = value;
        if (value > max) max = value;
        count += 1;
      }
    }
  }
  if (count === 0) return { min: 0, max: 1, isEmpty: true };
  return { min, max, isEmpty: false };
}

/**
 * Normalize `value` into `[0, 1]` against the domain.
 *
 * - Sequential: linear from `min`→0 to `max`→1. A degenerate domain
 *   (`min === max`) maps everything to the midpoint `0.5` (a single colour).
 * - Diverging: zero-centred. The scale is symmetric around 0 using the larger
 *   absolute bound, so `0` always maps to `0.5` (neutral) regardless of how
 *   lopsided the data is. E.g. domain `[-10, 30]` → 0 maps to 0.5, not blue.
 */
export function normalizeHeatmapValue(
  value: number,
  domain: HeatmapDomain,
  scale: HeatmapColorScale = 'sequential',
): number {
  if (!Number.isFinite(value)) return 0.5;

  if (scale === 'diverging') {
    const bound = Math.max(Math.abs(domain.min), Math.abs(domain.max));
    if (bound === 0) return 0.5;
    // Map [-bound, +bound] → [0, 1] with 0 at 0.5.
    return clamp01(0.5 + value / (2 * bound));
  }

  const range = domain.max - domain.min;
  if (range === 0) return 0.5;
  return clamp01((value - domain.min) / range);
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/**
 * CSS `color-mix` fill for a heatmap cell. `null` (missing) returns the inset
 * surface. Sequential mixes the primary series colour; diverging mixes a cool
 * colour below the midpoint and a warm colour above it, both fading to the inset
 * surface at the neutral midpoint.
 */
export function heatmapCellFill(
  value: number | null,
  domain: HeatmapDomain,
  scale: HeatmapColorScale = 'sequential',
): string {
  if (value === null) return 'var(--cinder-surface-inset)';
  const normalized = normalizeHeatmapValue(value, domain, scale);

  if (scale === 'diverging') {
    if (normalized < 0.5) {
      const ratio = (0.5 - normalized) * 2;
      return `color-mix(in oklch, var(--cinder-chart-series-5) ${Math.round(ratio * 100)}%, var(--cinder-surface-inset))`;
    }
    const ratio = (normalized - 0.5) * 2;
    return `color-mix(in oklch, var(--cinder-chart-series-3) ${Math.round(ratio * 100)}%, var(--cinder-surface-inset))`;
  }

  return `color-mix(in oklch, var(--cinder-chart-series-1) ${Math.round(normalized * 100)}%, var(--cinder-surface-inset))`;
}

/**
 * Choose a readable label colour for a cell: a light colour over high-intensity
 * (dark) fills, a dark colour over low-intensity (light) fills.
 */
export function heatmapLabelFill(
  value: number | null,
  domain: HeatmapDomain,
  scale: HeatmapColorScale = 'sequential',
): string {
  if (value === null) return 'var(--cinder-text-muted)';
  const intensity =
    scale === 'diverging'
      ? Math.abs(normalizeHeatmapValue(value, domain, scale) - 0.5) * 2
      : normalizeHeatmapValue(value, domain, scale);
  return intensity > 0.5 ? 'var(--cinder-surface)' : 'var(--cinder-text)';
}
