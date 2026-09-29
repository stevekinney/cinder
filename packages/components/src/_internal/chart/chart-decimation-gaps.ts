import type { PlacedPoint } from './chart-model-utilities.ts';
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

function finiteRun(points: PlacedPoint[], startIndex: number) {
  let index = startIndex;
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
  return { end: index, representative };
}

export function boundedGapHeavyIndices(points: PlacedPoint[], limit: number): number[] {
  const finiteRuns: Array<{ end: number; representative: number }> = [];
  let index = 0;
  while (index < points.length) {
    while (index < points.length && points[index]?.y === null) index += 1;
    if (index >= points.length) break;

    const run = finiteRun(points, index);
    finiteRuns.push(run);
    index = run.end;
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
  selected.sort((a, b) => a - b);
  return selected;
}

export function extremaIndices(
  startIndex: number,
  endIndex: number,
  valueAt: (index: number) => number | null | undefined,
): number[] {
  let minimumIndex: number | undefined;
  let maximumIndex: number | undefined;
  let minimumValue = Number.POSITIVE_INFINITY;
  let maximumValue = Number.NEGATIVE_INFINITY;
  for (let index = startIndex; index < endIndex; index++) {
    const value = valueAt(index);
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
  const indices: number[] = [];
  if (minimumIndex !== undefined) indices.push(minimumIndex);
  if (maximumIndex !== undefined) indices.push(maximumIndex);
  return indices;
}

function finiteLayerIndices(
  layers: ReadonlyArray<ReadonlyArray<number | null>>,
  pointCount: number,
): number[] {
  const indices: number[] = [];
  for (let index = 0; index < pointCount; index++) {
    if (layers.some((layer) => layer[index] != null)) indices.push(index);
  }
  return indices;
}

export function layerExtremaIndices(
  layers: ReadonlyArray<ReadonlyArray<number | null>>,
  startIndex: number,
  endIndex: number,
): number[] {
  const extrema = new Set<number>();
  for (const layer of layers) {
    for (const index of extremaIndices(startIndex, endIndex, (sourceIndex) => layer[sourceIndex])) {
      extrema.add(index);
    }
  }
  return [...extrema];
}

export function boundedGapHeavyLayerSelections(
  layers: ReadonlyArray<ReadonlyArray<number | null>>,
  pointCount: number,
  limit: number,
): LayerDecimationSelection[] {
  const finiteIndices = finiteLayerIndices(layers, pointCount);

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
  const sampledIndices = [...retainedIndices];
  sampledIndices.sort((a, b) => a - b);
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

export function addGapBoundaryIndices(
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
