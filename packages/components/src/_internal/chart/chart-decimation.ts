import {
  addGapBoundaryIndices,
  boundedGapHeavyIndices,
  boundedGapHeavyLayerSelections,
  extremaIndices,
  layerExtremaIndices,
  type LayerDecimationSelection,
} from './chart-decimation-gaps.ts';
import type { PlacedPoint } from './chart-model-utilities.ts';

export const MAXIMUM_RENDERED_SERIES_POINTS = 2_000;

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
    for (const index of extremaIndices(start, end, (sourceIndex) => points[sourceIndex]?.y)) {
      selected.add(index);
    }
  }

  const sorted = [...selected];
  sorted.sort((a, b) => a - b);
  return sorted;
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
    for (const index of layerExtremaIndices(layers, start, end)) {
      selected.add(index);
    }
  }

  const sorted = [...selected];
  sorted.sort((a, b) => a - b);
  return sorted.map((sourceIndex) => ({ sourceIndex, forceGapLayerIndices: [] }));
}

export function decimatePlacedPoints(
  points: PlacedPoint[],
  maximumPoints = MAXIMUM_RENDERED_SERIES_POINTS,
): PlacedPoint[] {
  return decimationIndices(points, maximumPoints).map((index) => points[index]!);
}
