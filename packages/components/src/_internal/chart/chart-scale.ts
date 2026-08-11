import type {
  BarChartDatum,
  BarChartSeries,
  ChartNumericValue,
} from '../../components/chart.types.ts';
import type { NormalizedXValue, PlacedPoint } from './chart-model-utilities.ts';

export const MAXIMUM_RENDERED_SERIES_POINTS = 2_000;

export type LayerDecimationSelection = {
  sourceIndex: number;
  forceGapLayerIndices: readonly number[];
};

function evenlySample<T>(values: readonly T[], count: number): T[] {
  if (values.length <= count) return [...values];
  if (count <= 1) return values[0] === undefined ? [] : [values[0]];
  return Array.from({ length: count }, (_, index) => {
    const sourceIndex = Math.round((index * (values.length - 1)) / (count - 1));
    return values[sourceIndex]!;
  });
}

function boundedGapHeavyIndices(points: PlacedPoint[], limit: number): number[] {
  const finiteRuns: Array<{ end: number; representative: number }> = [];
  let index = 0;
  while (index < points.length) {
    while (index < points.length && points[index]?.y === null) index += 1;
    if (index >= points.length) break;

    let representative = index;
    let maximumMagnitude = Math.abs(points[index]?.y ?? 0);
    while (index + 1 < points.length && points[index + 1]?.y !== null) {
      index += 1;
      const magnitude = Math.abs(points[index]?.y ?? 0);
      if (magnitude > maximumMagnitude) {
        maximumMagnitude = magnitude;
        representative = index;
      }
    }
    finiteRuns.push({ end: index, representative });
    index += 1;
  }

  const maximumFiniteRuns = Math.max(1, Math.floor((limit + 1) / 2));
  const sampledRuns = evenlySample(finiteRuns, maximumFiniteRuns);
  const selected: number[] = [];
  sampledRuns.forEach((run, runIndex) => {
    const previousRun = sampledRuns[runIndex - 1];
    if (previousRun) selected.push(previousRun.end + 1);
    selected.push(run.representative);
  });
  return selected.sort((a, b) => a - b);
}

function layerExtremaIndices(
  layers: ReadonlyArray<ReadonlyArray<number | null>>,
  startIndex: number,
  endIndex: number,
): number[] {
  const extrema = new Set<number>();
  for (const layer of layers) {
    let minimumIndex: number | undefined;
    let maximumIndex: number | undefined;
    let minimumValue = Number.POSITIVE_INFINITY;
    let maximumValue = Number.NEGATIVE_INFINITY;
    for (let index = startIndex; index < endIndex; index++) {
      const value = layer[index];
      if (value == null) continue;
      if (value < minimumValue) {
        minimumValue = value;
        minimumIndex = index;
      }
      if (value > maximumValue) {
        maximumValue = value;
        maximumIndex = index;
      }
    }
    if (minimumIndex !== undefined) extrema.add(minimumIndex);
    if (maximumIndex !== undefined) extrema.add(maximumIndex);
  }
  return [...extrema];
}

function boundedGapHeavyLayerSelections(
  layers: ReadonlyArray<ReadonlyArray<number | null>>,
  pointCount: number,
  limit: number,
): LayerDecimationSelection[] {
  const finiteIndices: number[] = [];
  for (let index = 0; index < pointCount; index++) {
    if (layers.some((layer) => layer[index] != null)) finiteIndices.push(index);
  }

  const maximumFiniteSamples = Math.max(1, Math.floor((limit + 1) / 2));
  const retainedIndices = new Set<number>();
  const priorityIndices = [
    finiteIndices[0],
    finiteIndices.at(-1),
    ...layerExtremaIndices(layers, 0, pointCount),
  ];
  for (const index of priorityIndices) {
    if (index !== undefined && retainedIndices.size < maximumFiniteSamples) {
      retainedIndices.add(index);
    }
  }
  const extremaPerBucket = Math.max(1, layers.length * 2);
  const bucketCount = Math.floor((maximumFiniteSamples - retainedIndices.size) / extremaPerBucket);
  for (let bucketIndex = 0; bucketIndex < bucketCount; bucketIndex++) {
    const startIndex = Math.floor((bucketIndex * pointCount) / bucketCount);
    const endIndex = Math.floor(((bucketIndex + 1) * pointCount) / bucketCount);
    for (const index of layerExtremaIndices(layers, startIndex, endIndex)) {
      if (retainedIndices.size < maximumFiniteSamples) retainedIndices.add(index);
    }
  }
  const remainingCapacity = maximumFiniteSamples - retainedIndices.size;
  if (remainingCapacity > 0) {
    const coverageCandidates = finiteIndices.filter((index) => !retainedIndices.has(index));
    for (const index of evenlySample(coverageCandidates, remainingCapacity)) {
      retainedIndices.add(index);
    }
  }
  const sampledIndices = [...retainedIndices].sort((a, b) => a - b);
  const selectedSourceIndices: number[] = [];
  sampledIndices.forEach((sourceIndex, selectionIndex) => {
    const previousSourceIndex = sampledIndices[selectionIndex - 1];
    if (previousSourceIndex !== undefined && sourceIndex > previousSourceIndex + 1) {
      if (layers.some((layer) => layerHasOmittedGap(layer, previousSourceIndex, sourceIndex))) {
        selectedSourceIndices.push(
          previousSourceIndex + Math.floor((sourceIndex - previousSourceIndex) / 2),
        );
      }
    }
    selectedSourceIndices.push(sourceIndex);
  });
  return selectedSourceIndices.map((sourceIndex, selectionIndex) => {
    const previousSourceIndex = selectedSourceIndices[selectionIndex - 1];
    const forceGapLayerIndices: number[] = [];
    if (previousSourceIndex !== undefined && sourceIndex > previousSourceIndex + 1) {
      layers.forEach((layer, layerIndex) => {
        if (layerHasOmittedGap(layer, previousSourceIndex, sourceIndex)) {
          forceGapLayerIndices.push(layerIndex);
        }
      });
    }
    return { sourceIndex, forceGapLayerIndices };
  });
}

function layerHasOmittedGap(
  layer: ReadonlyArray<number | null>,
  startIndex: number,
  endIndex: number,
): boolean {
  if (layer[startIndex] == null || layer[endIndex] == null) return false;
  for (let gapIndex = startIndex + 1; gapIndex < endIndex; gapIndex++) {
    if (layer[gapIndex] == null) return true;
  }
  return false;
}

function addGapBoundaryIndices(
  selected: Set<number>,
  pointCount: number,
  valueAt: (index: number) => number | null | undefined,
): void {
  for (let index = 1; index < pointCount; index++) {
    const previousIsNull = valueAt(index - 1) == null;
    const currentIsNull = valueAt(index) == null;
    if (previousIsNull === currentIsNull) continue;
    selected.add(index - 1);
    selected.add(index);
  }
}

export function decimationIndices(
  points: PlacedPoint[],
  maximumPoints = MAXIMUM_RENDERED_SERIES_POINTS,
): number[] {
  if (points.length <= maximumPoints || maximumPoints < 2) {
    return points.map((_, index) => index);
  }
  const limit = Math.max(2, Math.floor(maximumPoints));
  const interiorLength = points.length - 2;
  const selected = new Set<number>([0, points.length - 1]);
  addGapBoundaryIndices(selected, points.length, (index) => points[index]?.y);

  // Every finite/null transition is structural. When the transitions alone
  // exceed the budget, sample complete finite runs and retain a real null
  // between them. This remains bounded without drawing across an omitted gap.
  const remainingExtremaBudget = limit - selected.size;
  const bucketCount = Math.floor(remainingExtremaBudget / 2);
  if (bucketCount < 1) return boundedGapHeavyIndices(points, limit);

  for (let bucketIndex = 0; bucketIndex < bucketCount; bucketIndex++) {
    const start = 1 + Math.floor((bucketIndex * interiorLength) / bucketCount);
    const end = 1 + Math.floor(((bucketIndex + 1) * interiorLength) / bucketCount);
    if (end <= start) continue;
    let minimumIndex: number | undefined;
    let maximumIndex: number | undefined;
    let minimumValue = Number.POSITIVE_INFINITY;
    let maximumValue = Number.NEGATIVE_INFINITY;
    for (let index = start; index < end; index++) {
      const point = points[index];
      if (!point) continue;
      if (point.y === null) continue;
      if (point.y < minimumValue) {
        minimumValue = point.y;
        minimumIndex = index;
      }
      if (point.y > maximumValue) {
        maximumValue = point.y;
        maximumIndex = index;
      }
    }
    if (minimumIndex !== undefined) selected.add(minimumIndex);
    if (maximumIndex !== undefined) selected.add(maximumIndex);
  }

  return [...selected].sort((a, b) => a - b);
}

export function decimationIndicesForLayers(
  layers: ReadonlyArray<ReadonlyArray<number | null>>,
  maximumPoints = MAXIMUM_RENDERED_SERIES_POINTS,
): LayerDecimationSelection[] {
  const pointCount = layers[0]?.length ?? 0;
  if (pointCount <= maximumPoints || maximumPoints < 2) {
    return Array.from({ length: pointCount }, (_, sourceIndex) => ({
      sourceIndex,
      forceGapLayerIndices: [],
    }));
  }
  const limit = Math.max(2, Math.floor(maximumPoints));
  const interiorLength = pointCount - 2;
  const selected = new Set<number>([0, pointCount - 1]);
  for (const layer of layers) {
    addGapBoundaryIndices(selected, pointCount, (index) => layer[index]);
  }

  // Gap boundaries are shared across layers before extrema are bucketed, so
  // every retained layer uses the same x keys without collapsing separate
  // discontinuities into one marker.
  const candidatesPerBucket = Math.max(1, layers.length * 2);
  const bucketCount = Math.floor((limit - selected.size) / candidatesPerBucket);
  if (bucketCount < 1) return boundedGapHeavyLayerSelections(layers, pointCount, limit);

  for (let bucketIndex = 0; bucketIndex < bucketCount; bucketIndex++) {
    const start = 1 + Math.floor((bucketIndex * interiorLength) / bucketCount);
    const end = 1 + Math.floor(((bucketIndex + 1) * interiorLength) / bucketCount);
    if (end <= start) continue;
    for (const layer of layers) {
      let minimumIndex: number | undefined;
      let maximumIndex: number | undefined;
      let minimumValue = Number.POSITIVE_INFINITY;
      let maximumValue = Number.NEGATIVE_INFINITY;
      for (let index = start; index < end; index++) {
        const value = layer[index];
        if (value === null || value === undefined) continue;
        if (value < minimumValue) {
          minimumValue = value;
          minimumIndex = index;
        }
        if (value > maximumValue) {
          maximumValue = value;
          maximumIndex = index;
        }
      }
      if (minimumIndex !== undefined) selected.add(minimumIndex);
      if (maximumIndex !== undefined) selected.add(maximumIndex);
    }
  }

  return [...selected]
    .sort((a, b) => a - b)
    .map((sourceIndex) => ({ sourceIndex, forceGapLayerIndices: [] }));
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
