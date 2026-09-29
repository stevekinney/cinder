import type { ChartAxisConfiguration, ChartCartesianSeries } from '../../components/chart.types.ts';
import {
  createStackedRenderSelection,
  type NormalizedCartesianSeries,
  type StackedRenderSelection,
} from './chart-cartesian-data.ts';
import { decimatePlacedPoints } from './chart-decimation.ts';
import {
  formatNumericValue,
  formatXValue,
  type CartesianChartModel,
  type ChartGeometry,
  type ChartTarget,
  type NormalizedPoint,
  type NormalizedXValue,
  type PlacedPoint,
} from './chart-model-utilities.ts';
import { createAreaPath, createLinePath } from './chart-paths.ts';
import type { LinearScale } from './chart-scale.ts';

type CartesianRenderingOptions = {
  normalizedSeries: NormalizedCartesianSeries[];
  sortedXValues: NormalizedXValue[];
  hiddenSeriesIds: string[];
  stackedArea: boolean;
  series: ChartCartesianSeries[];
  xAxis: ChartAxisConfiguration | undefined;
  yAxis: ChartAxisConfiguration | undefined;
  scaleX: (value: NormalizedXValue) => number;
  yScale: LinearScale;
  geometry: ChartGeometry;
};

export function renderCartesianSeries(options: CartesianRenderingOptions) {
  const {
    normalizedSeries,
    sortedXValues,
    hiddenSeriesIds,
    stackedArea,
    scaleX,
    yScale,
    geometry,
  } = options;
  // String domains retain insertion order; numeric and date domains are sorted.
  const orderByKey = new Map(sortedXValues.map((value, index) => [value.key, index]));
  const stackedOffsetsByKey = new Map(sortedXValues.map((value) => [value.key, 0]));
  const stackedSelection = createStackedRenderSelection(
    normalizedSeries,
    sortedXValues,
    hiddenSeriesIds,
    stackedArea,
  );
  const targets: ChartTarget[] = [];
  const tableRows: CartesianChartModel['tableRows'] = [];
  const renderedSeries = normalizedSeries.map((item) => {
    const hidden = hiddenSeriesIds.includes(item.id);
    const points = [...item.points];
    points.sort((a, b) => (orderByKey.get(a.x.key) ?? 0) - (orderByKey.get(b.x.key) ?? 0));
    const placedPoints = placeCartesianPoints(points, stackedOffsetsByKey, options);
    const renderPoints = selectRenderPoints(
      item,
      placedPoints,
      stackedSelection,
      stackedOffsetsByKey,
      scaleX,
      yScale,
    );
    const coordinates = renderPoints.map((placed) => ({
      x: placed.pixelX,
      y: placed.y === null ? null : placed.pixelY,
      y0: placed.pixelY0,
    }));
    if (!hidden) {
      appendVisibleData(item, placedPoints, targets, tableRows, options);
      if (stackedArea) {
        for (const placed of placedPoints) {
          stackedOffsetsByKey.set(
            placed.x.key,
            (stackedOffsetsByKey.get(placed.x.key) ?? 0) + (placed.y ?? 0),
          );
        }
      }
    }
    return {
      ...item,
      hidden,
      points: hidden ? [] : renderPoints,
      path: hidden ? '' : createLinePath(coordinates),
      areaPath: hidden
        ? ''
        : createAreaPath(coordinates, stackedArea ? undefined : geometry.plotHeight),
    };
  });
  return { renderedSeries, targets, tableRows };
}

function placeCartesianPoints(
  points: NormalizedPoint[],
  stackedOffsetsByKey: Map<string, number>,
  options: CartesianRenderingOptions,
): PlacedPoint[] {
  const { stackedArea, scaleX, yScale } = options;
  return points.map((point) => {
    const lowerValue = stackedArea ? (stackedOffsetsByKey.get(point.x.key) ?? 0) : 0;
    const upperValue = lowerValue + (point.y ?? 0);
    return {
      ...point,
      pixelX: scaleX(point.x),
      pixelY: yScale(stackedArea ? upperValue : (point.y ?? 0)),
      pixelY0: yScale(stackedArea ? lowerValue : 0),
    };
  });
}

function selectRenderPoints(
  item: NormalizedCartesianSeries,
  placedPoints: PlacedPoint[],
  stackedSelection: StackedRenderSelection | undefined,
  stackedOffsetsByKey: Map<string, number>,
  scaleX: (value: NormalizedXValue) => number,
  yScale: LinearScale,
): PlacedPoint[] {
  if (!stackedSelection) return decimatePlacedPoints(placedPoints);
  const placedPointsByKey = new Map(placedPoints.map((point) => [point.x.key, point]));
  return stackedSelection.selections.map(({ sourceIndex, forceGapLayerIndices }) => {
    const x = stackedSelection.domain[sourceIndex]!;
    const layerIndex = stackedSelection.layerIndexBySeriesId.get(item.id);
    const forceGap = layerIndex !== undefined && forceGapLayerIndices.includes(layerIndex);
    if (!forceGap) {
      const placedPoint = placedPointsByKey.get(x.key);
      if (placedPoint) return placedPoint;
    }
    return {
      seriesId: item.id,
      seriesLabel: item.label,
      color: item.color,
      x,
      y: null,
      originalY: null,
      index: -1,
      pixelX: scaleX(x),
      pixelY: 0,
      pixelY0: yScale(stackedOffsetsByKey.get(x.key) ?? 0),
    };
  });
}

function appendVisibleData(
  item: NormalizedCartesianSeries,
  placedPoints: PlacedPoint[],
  targets: ChartTarget[],
  tableRows: CartesianChartModel['tableRows'],
  options: CartesianRenderingOptions,
) {
  const { xAxis, yAxis, series } = options;
  for (const placed of placedPoints) {
    if (placed.y === null) continue;
    const xLabel = formatXValue(placed.x, xAxis, {
      seriesId: item.id,
      seriesLabel: item.label,
      index: placed.index,
    });
    const valueLabel = formatNumericValue(
      placed.y,
      yAxis,
      series.find((entry) => entry.id === item.id)?.valueFormatter,
      { seriesId: item.id, seriesLabel: item.label, index: placed.index },
    );
    const row = {
      id: `${item.id}-${placed.x.key}`,
      seriesId: item.id,
      seriesLabel: item.label,
      xLabel,
      valueLabel,
    };
    targets.push({ ...row, x: placed.pixelX, y: placed.pixelY, color: item.color });
    tableRows.push(row);
  }
}
