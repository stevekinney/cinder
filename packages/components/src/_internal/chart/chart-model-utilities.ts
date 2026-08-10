import type {
  ChartAxisConfiguration,
  ChartDataTableVisibility,
  ChartFormatterContext,
  ChartLegendPosition,
  ChartNumericValue,
  ChartPoint,
  ChartTheme,
  ChartXValue,
  ResolvedChartTheme,
} from '../../components/chart.types.ts';

export const chartPalette = [
  'var(--cinder-chart-series-1)',
  'var(--cinder-chart-series-2)',
  'var(--cinder-chart-series-3)',
  'var(--cinder-chart-series-4)',
  'var(--cinder-chart-series-5)',
  'var(--cinder-chart-series-6)',
  'var(--cinder-chart-series-7)',
  'var(--cinder-chart-series-8)',
] as const;

/**
 * Resolves a palette color for a series by index, wrapping around the palette.
 * Exported so chart components can render legend swatches using the same
 * resolved color the chart uses for the series itself.
 */
export function chartPaletteColor(
  index: number,
  palette: readonly string[] = chartPalette,
): string {
  const resolvedPalette = palette.length > 0 ? palette : chartPalette;
  if (index < 0) return resolvedPalette[0] ?? chartPalette[0];
  return resolvedPalette[index % resolvedPalette.length] ?? chartPalette[0];
}

export function resolveChartTheme(theme: ChartTheme | undefined = undefined): ResolvedChartTheme {
  return {
    foreground: theme?.foreground ?? 'currentColor',
    muted: theme?.muted ?? 'currentColor',
    grid: theme?.grid ?? 'currentColor',
    background: theme?.background ?? 'transparent',
    palette: theme?.palette?.length ? [...theme.palette] : [...chartPalette],
  };
}

export function chartResourceId(idPrefix: string, resource: string, seriesId: string): string {
  const safeSeriesId = encodeURIComponent(seriesId).replaceAll('%', '_');
  return `${idPrefix}-${resource}-${safeSeriesId}`;
}

export type ChartMark =
  | { type: 'line'; data: ChartPoint[]; stroke?: string; strokeWidth?: number }
  | { type: 'area'; data: ChartPoint[]; fill?: string; fillOpacity?: number }
  | { type: 'bar'; data: ChartPoint[]; fill?: string }
  | { type: 'point'; data: ChartPoint[]; fill?: string; radius?: number };

export type NormalizedXValue = {
  raw: ChartXValue;
  key: string;
  label: string;
  comparable: string | number;
  kind: 'string' | 'number' | 'date';
};

export type NormalizedPoint = {
  seriesId: string;
  seriesLabel: string;
  color: string;
  x: NormalizedXValue;
  y: number | null;
  originalY: ChartNumericValue;
  index: number;
};

/**
 * A point that has been placed in pixel space by the chart model. Components
 * read `pixelX`/`pixelY` directly without a secondary lookup against targets.
 */
export type PlacedPoint = NormalizedPoint & {
  pixelX: number;
  pixelY: number;
};

export type ChartTarget = {
  id: string;
  seriesId: string;
  seriesLabel: string;
  xLabel: string;
  valueLabel: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  color: string;
};

export type ChartGeometry = {
  plotWidth: number;
  plotHeight: number;
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
};

export type CartesianChartTableRow = {
  id: string;
  seriesLabel: string;
  xLabel: string;
  valueLabel: string;
};

export type BarChartTableRow = {
  categoryKey: string;
  categoryLabel: string;
  values: Array<{ seriesId: string; seriesLabel: string; valueLabel: string }>;
};

export type ChartTableRow = CartesianChartTableRow | BarChartTableRow;

export type ChartSceneModel<TTableRow extends ChartTableRow = ChartTableRow> = {
  geometry: ChartGeometry;
  targets: ChartTarget[];
  tableRows: TTableRow[];
  empty: boolean;
};

/**
 * An x-axis tick paired with its already-scaled pixel position. Charts render
 * labels at the model-provided `x` so labels and points stay aligned for
 * numeric and date domains.
 */
export type ChartXTick = {
  label: string;
  x: number;
};

export type CartesianChartModel = ChartSceneModel<CartesianChartTableRow> & {
  /** Pre-scaled x-axis ticks. Render labels at `tick.x`, not by ordinal index. */
  xTicks: ChartXTick[];
  yTicks: number[];
  normalizedSeries: Array<{
    id: string;
    label: string;
    color: string;
    points: PlacedPoint[];
    path: string;
    areaPath: string;
    hidden: boolean;
  }>;
  /** Targets sorted by `x` (binary-search precondition for nearestTarget). */
  yDomain: [number, number];
  theme: ResolvedChartTheme;
  marks: Array<{ seriesId: string; descriptors: ChartMark[] }>;
};

export type BarChartModel = ChartSceneModel<BarChartTableRow> & {
  categories: NormalizedXValue[];
  yTicks: number[];
  categoryTicks: Array<{
    categoryKey: string;
    label: string;
    fullLabel: string;
    x: number;
    y: number;
  }>;
  bars: import('../../components/chart.types.ts').BarChartPlacedBar[];
  valueDomain: [number, number];
  theme: ResolvedChartTheme;
};

export function assertValidChartNumber(
  componentId: string,
  rule: string,
  value: number,
  label: string,
): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(
      `[cinder/${componentId}] rule=${rule} ${label}="${value}": expected a positive finite number.`,
    );
  }
}

export function assertValidNonNegativeInteger(
  componentId: string,
  rule: string,
  value: number,
  label: string,
): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(
      `[cinder/${componentId}] rule=${rule} ${label}="${value}": expected a non-negative integer.`,
    );
  }
}

export function assertValidTickCount(componentId: string, axis?: ChartAxisConfiguration): void {
  if (axis?.tickCount === undefined) return;
  if (!Number.isInteger(axis.tickCount) || axis.tickCount <= 0) {
    throw new Error(
      `[cinder/${componentId}] rule=invalid-tick-count tickCount="${axis.tickCount}": expected a positive integer.`,
    );
  }
}

export function dataTableClass(visibility: ChartDataTableVisibility): string | undefined {
  return visibility === 'screen-reader-only' ? 'cinder-sr-only' : undefined;
}

export function formatXValue(
  value: NormalizedXValue,
  axis: ChartAxisConfiguration | undefined,
  context: ChartFormatterContext,
): string {
  return axis?.format ? axis.format(value.raw, context) : value.label;
}

export function formatNumericValue(
  value: number,
  axis: ChartAxisConfiguration | undefined,
  formatter: ((value: number, context: ChartFormatterContext) => string) | undefined,
  context: ChartFormatterContext,
): string {
  if (formatter) return formatter(value, context);
  if (axis?.format) return axis.format(value, context);
  // Locale `undefined` inherits the browser's current locale rather than
  // baking en-US formatting into every consumer.
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
}

export function normalizeXValue(value: ChartXValue): NormalizedXValue {
  if (value instanceof Date) {
    const comparable = value.getTime();
    return {
      raw: value,
      key: `date:${comparable}`,
      label: value.toISOString(),
      comparable,
      kind: 'date',
    };
  }
  if (typeof value === 'number') {
    return {
      raw: value,
      key: `number:${value}`,
      label: String(value),
      comparable: value,
      kind: 'number',
    };
  }
  return { raw: value, key: `string:${value}`, label: value, comparable: value, kind: 'string' };
}

export function assertUniqueSeriesIds(componentId: string, series: Array<{ id: string }>): void {
  const seen = new Set<string>();
  for (const item of series) {
    if (seen.has(item.id)) {
      throw new Error(
        `[cinder/${componentId}] rule=duplicate-series-id series="${item.id}": duplicate series ids are not supported.`,
      );
    }
    seen.add(item.id);
  }
}

export function toggleSeriesId(hiddenSeriesIds: string[], seriesId: string): string[] {
  return hiddenSeriesIds.includes(seriesId)
    ? hiddenSeriesIds.filter((id) => id !== seriesId)
    : [...hiddenSeriesIds, seriesId];
}

export function nearestTarget(
  targets: readonly ChartTarget[],
  x: number,
  y: number,
  axis: 'x' | 'y' = 'x',
): ChartTarget | undefined {
  if (targets.length === 0) return undefined;
  if (targets.length === 1) return targets[0];
  const pointerKey = axis === 'x' ? x : y;
  // Binary search for the leftmost target whose key is >= pointer, then
  // compare the adjacent dominant-axis buckets. The nearest target can live in
  // either bucket when the pointer is between two x/y positions.
  let low = 0;
  let high = targets.length - 1;
  while (low < high) {
    const mid = (low + high) >> 1;
    const midKey = axis === 'x' ? (targets[mid]?.x ?? 0) : (targets[mid]?.y ?? 0);
    if (midKey < pointerKey) low = mid + 1;
    else high = mid;
  }
  const candidates: ChartTarget[] = [];

  function addBucket(start: number): void {
    const target = targets[start];
    if (!target) return;
    const bucketKey = axis === 'x' ? target.x : target.y;
    for (let index = start; index >= 0; index--) {
      const candidate = targets[index];
      if (!candidate) continue;
      const candidateKey = axis === 'x' ? candidate.x : candidate.y;
      if (candidateKey !== bucketKey) break;
      candidates.push(candidate);
    }
    for (let index = start + 1; index < targets.length; index++) {
      const candidate = targets[index];
      if (!candidate) continue;
      const candidateKey = axis === 'x' ? candidate.x : candidate.y;
      if (candidateKey !== bucketKey) break;
      candidates.push(candidate);
    }
  }

  addBucket(low);
  if (low > 0) {
    addBucket(low - 1);
  }

  let nearest: ChartTarget | undefined;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const target of candidates) {
    const targetDistance = Math.hypot(target.x - x, target.y - y);
    if (targetDistance >= nearestDistance) continue;
    nearest = target;
    nearestDistance = targetDistance;
  }
  return nearest;
}

export function legendVisible(legendPosition: ChartLegendPosition, seriesCount: number): boolean {
  return legendPosition !== 'none' && seriesCount > 0;
}
