import type {
  BarChartDatum,
  BarChartSeries,
  ChartNumericValue,
} from '../../components/chart.types.ts';
import type { NormalizedXValue, PlacedPoint } from './chart-model-utilities.ts';

export const MAXIMUM_RENDERED_SERIES_POINTS = 2_000;

function boundSelectedIndices(selected: Set<number>, limit: number): number[] {
  const ordered = [...selected].sort((a, b) => a - b);
  if (ordered.length <= limit) return ordered;
  const interiorLimit = limit - 2;
  const step = (ordered.length - 3) / Math.max(1, interiorLimit - 1);
  const bounded = [ordered[0]!];
  for (let index = 0; index < interiorLimit; index++) {
    bounded.push(ordered[1 + Math.round(index * step)]!);
  }
  bounded.push(ordered.at(-1)!);
  return [...new Set(bounded)].sort((a, b) => a - b);
}

export function decimationIndices(
  points: PlacedPoint[],
  maximumPoints = MAXIMUM_RENDERED_SERIES_POINTS,
): number[] {
  if (points.length <= maximumPoints || maximumPoints < 2) {
    return points.map((_, index) => index);
  }
  const limit = Math.max(2, Math.floor(maximumPoints));
  const bucketCount = Math.max(1, Math.floor((limit - 2) / 2));
  const interiorLength = points.length - 2;
  const selected = new Set<number>([0, points.length - 1]);

  for (let bucketIndex = 0; bucketIndex < bucketCount; bucketIndex++) {
    const start = 1 + Math.floor((bucketIndex * interiorLength) / bucketCount);
    const end = 1 + Math.floor(((bucketIndex + 1) * interiorLength) / bucketCount);
    if (end <= start) continue;
    let minimumIndex: number | undefined;
    let maximumIndex: number | undefined;
    let minimumValue = Number.POSITIVE_INFINITY;
    let maximumValue = Number.NEGATIVE_INFINITY;
    let nullIndex: number | undefined;
    for (let index = start; index < end; index++) {
      const point = points[index];
      if (!point) continue;
      if (point.y === null) {
        nullIndex ??= index;
        continue;
      }
      if (point.y < minimumValue) {
        minimumValue = point.y;
        minimumIndex = index;
      }
      if (point.y > maximumValue) {
        maximumValue = point.y;
        maximumIndex = index;
      }
    }
    // Nulls are structural: retain one gap marker per bucket where present,
    // then retain both extrema when there is room. This keeps discontinuities
    // visible while ensuring spikes and dips survive downsampling.
    if (nullIndex !== undefined) selected.add(nullIndex);
    if (minimumIndex !== undefined) selected.add(minimumIndex);
    if (maximumIndex !== undefined) selected.add(maximumIndex);
  }

  // A pathological input with a null in every bucket can exceed the bound.
  // Preserve endpoints and choose evenly-spaced candidates from the remainder.
  return boundSelectedIndices(selected, limit);
}

export function decimationIndicesForLayers(
  layers: ReadonlyArray<ReadonlyArray<number | null>>,
  maximumPoints = MAXIMUM_RENDERED_SERIES_POINTS,
): number[] {
  const pointCount = layers[0]?.length ?? 0;
  if (pointCount <= maximumPoints || maximumPoints < 2) {
    return Array.from({ length: pointCount }, (_, index) => index);
  }
  const limit = Math.max(2, Math.floor(maximumPoints));
  // Each layer can contribute a minimum, maximum, and structural null per
  // bucket. Size the buckets against that worst case so every cumulative
  // boundary participates without exceeding the shared render budget.
  const candidatesPerBucket = Math.max(1, layers.length * 3);
  const bucketCount = Math.max(1, Math.floor((limit - 2) / candidatesPerBucket));
  const interiorLength = pointCount - 2;
  const selected = new Set<number>([0, pointCount - 1]);

  for (let bucketIndex = 0; bucketIndex < bucketCount; bucketIndex++) {
    const start = 1 + Math.floor((bucketIndex * interiorLength) / bucketCount);
    const end = 1 + Math.floor(((bucketIndex + 1) * interiorLength) / bucketCount);
    if (end <= start) continue;
    for (const layer of layers) {
      let minimumIndex: number | undefined;
      let maximumIndex: number | undefined;
      let nullIndex: number | undefined;
      let minimumValue = Number.POSITIVE_INFINITY;
      let maximumValue = Number.NEGATIVE_INFINITY;
      for (let index = start; index < end; index++) {
        const value = layer[index];
        if (value === null || value === undefined) {
          nullIndex ??= index;
          continue;
        }
        if (value < minimumValue) {
          minimumValue = value;
          minimumIndex = index;
        }
        if (value > maximumValue) {
          maximumValue = value;
          maximumIndex = index;
        }
      }
      if (nullIndex !== undefined) selected.add(nullIndex);
      if (minimumIndex !== undefined) selected.add(minimumIndex);
      if (maximumIndex !== undefined) selected.add(maximumIndex);
    }
  }

  return boundSelectedIndices(selected, limit);
}

export function decimatePlacedPoints(
  points: PlacedPoint[],
  maximumPoints = MAXIMUM_RENDERED_SERIES_POINTS,
): PlacedPoint[] {
  return decimationIndices(points, maximumPoints).map((index) => points[index]!);
}
export function normalizeNumericValue(
  componentId: string,
  seriesId: string,
  xLabel: string,
  value: ChartNumericValue,
): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value)) {
    throw new Error(
      `[cinder/${componentId}] rule=non-finite-y series="${seriesId}" x="${xLabel}": y values must be finite numbers.`,
    );
  }
  return value;
}

export function sortXValues(values: NormalizedXValue[]): NormalizedXValue[] {
  if (values[0]?.kind === 'string') return values;
  return values.slice().sort((a, b) => Number(a.comparable) - Number(b.comparable));
}

export function createPaddedDomain(values: number[]): [number, number] {
  if (values.length === 0) return [-1, 1];
  // Avoid spread-call argument-limit cliffs on large arrays.
  let minimum = values[0]!;
  let maximum = values[0]!;
  for (let index = 1; index < values.length; index++) {
    const value = values[index]!;
    if (value < minimum) minimum = value;
    if (value > maximum) maximum = value;
  }
  if (minimum === maximum) return [minimum - 1, maximum + 1];
  return [Math.min(0, minimum), Math.max(0, maximum)];
}

export type LinearScale = ((value: number) => number) & {
  ticks: (count: number) => number[];
};

export type BandlikeScale = ((value: string) => number | undefined) & {
  bandwidth?: () => number;
};

export type BandScale = ((value: string) => number | undefined) & {
  bandwidth: () => number;
};

export function createLinearScale(domain: [number, number], range: [number, number]): LinearScale {
  const [domainMinimum, domainMaximum] =
    domain[0] === domain[1] ? [domain[0] - 1, domain[1] + 1] : domain;
  const [rangeMinimum, rangeMaximum] = range;
  const domainSpan = domainMaximum - domainMinimum;
  const rangeSpan = rangeMaximum - rangeMinimum;
  // Build the scale by composing the call signature with the `ticks` method
  // up front, so the intersection type holds without an `as` cast.
  const scale = Object.assign(
    (value: number): number => rangeMinimum + ((value - domainMinimum) / domainSpan) * rangeSpan,
    {
      ticks: (count: number): number[] => createTicks([domainMinimum, domainMaximum], count),
    },
  ) satisfies LinearScale;
  return scale;
}

export function createPointScale(
  domain: string[],
  range: [number, number],
  padding: number,
): BandlikeScale {
  const positions = new Map<string, number>();

  const [rangeMinimum, rangeMaximum] = range;
  if (domain.length === 1) {
    positions.set(domain[0] ?? '', rangeMinimum + (rangeMaximum - rangeMinimum) / 2);
  } else {
    const step = (rangeMaximum - rangeMinimum) / Math.max(1, domain.length - 1 + padding * 2);
    const start = rangeMinimum + step * padding;
    domain.forEach((value, index) => positions.set(value, start + step * index));
  }

  return (value: string) => positions.get(value);
}

export function createBandScale(
  domain: string[],
  range: [number, number],
  padding: number,
): BandScale {
  const positions = new Map<string, number>();
  const [rangeMinimum, rangeMaximum] = range;
  const availableSize = Math.max(0, rangeMaximum - rangeMinimum);
  const step =
    domain.length === 0
      ? 0
      : availableSize / Math.max(1, domain.length + padding * (domain.length - 1));
  const bandWidth = Math.max(0, step * (1 - padding));
  domain.forEach((value, index) => positions.set(value, rangeMinimum + step * index));

  // Same Object.assign + satisfies pattern as createLinearScale — the
  // intersection type is satisfied at construction, not asserted after.
  const scale = Object.assign((value: string) => positions.get(value), {
    bandwidth: (): number => bandWidth,
  }) satisfies BandScale;
  return scale;
}

export function createNumericDomain(values: NormalizedXValue[]): [number, number] {
  if (values.length === 0) return [0, 1];
  let minimum = Number(values[0]!.comparable);
  let maximum = minimum;
  for (let index = 1; index < values.length; index++) {
    const numeric = Number(values[index]!.comparable);
    if (numeric < minimum) minimum = numeric;
    if (numeric > maximum) maximum = numeric;
  }
  return minimum === maximum ? [minimum - 1, maximum + 1] : [minimum, maximum];
}

export function createTicks(domain: [number, number], count: number): number[] {
  const safeCount = Math.max(1, Math.floor(count));
  if (safeCount === 1) return [domain[0]];
  const step = (domain[1] - domain[0]) / (safeCount - 1);
  return Array.from({ length: safeCount }, (_, index) => domain[0] + step * index);
}

export function createLinePath(points: Array<{ x: number; y: number | null }>): string {
  if (points.length === 0) return '';
  const commands: string[] = [];
  for (const [index, point] of points.entries()) {
    if (point.y === null) continue;
    const previous = points[index - 1];
    commands.push(
      previous?.y === null || commands.length === 0
        ? `M${formatPathNumber(point.x)},${formatPathNumber(point.y)}`
        : `L${formatPathNumber(point.x)},${formatPathNumber(point.y)}`,
    );
  }
  return commands.join('');
}

export function createAreaPath(
  points: Array<{ x: number; y: number | null; y0?: number }>,
  baseline: number | undefined,
): string {
  const segments: Array<Array<{ x: number; y: number; y0?: number }>> = [];
  let segment: Array<{ x: number; y: number; y0?: number }> = [];
  for (const point of points) {
    if (point.y === null) {
      if (segment.length > 0) segments.push(segment);
      segment = [];
      continue;
    }
    segment.push({ ...point, y: point.y });
  }
  if (segment.length > 0) segments.push(segment);

  return segments
    .map((visiblePoints) => {
      const firstPoint = visiblePoints[0]!;
      const lowerPoints: string[] = [];
      for (let index = visiblePoints.length - 1; index >= 0; index--) {
        const point = visiblePoints[index]!;
        lowerPoints.push(
          `L${formatPathNumber(point.x)},${formatPathNumber(point.y0 ?? baseline ?? 0)}`,
        );
      }
      return [
        `M${formatPathNumber(firstPoint.x)},${formatPathNumber(firstPoint.y0 ?? baseline ?? 0)}`,
        `L${formatPathNumber(firstPoint.x)},${formatPathNumber(firstPoint.y)}`,
        ...visiblePoints
          .slice(1)
          .map((point) => `L${formatPathNumber(point.x)},${formatPathNumber(point.y)}`),
        ...lowerPoints,
        'Z',
      ].join('');
    })
    .join('');
}

export function createStackedBarDomainValues(
  datumByKey: Map<string, BarChartDatum>,
  categories: NormalizedXValue[],
  series: BarChartSeries[],
): number[] {
  const values = [0];
  for (const category of categories) {
    const datum = datumByKey.get(category.key);
    if (!datum) continue;
    let positiveTotal = 0;
    let negativeTotal = 0;
    for (const item of series) {
      const value = datum[item.valueKey];
      if (typeof value !== 'number') continue;
      if (value >= 0) positiveTotal += value;
      else negativeTotal += value;
    }
    values.push(positiveTotal, negativeTotal);
  }
  return values;
}

function formatPathNumber(value: number): string {
  return Number(value.toFixed(3)).toString();
}
