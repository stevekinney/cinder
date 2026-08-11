import type {
  ChartAxisConfiguration,
  ChartCartesianSeries,
  ChartTheme,
  ChartXAxisConfiguration,
} from '../../components/chart.types.ts';
import { createChartGeometry } from './chart-layout.ts';
import {
  assertUniqueSeriesIds,
  assertValidChartNumber,
  assertValidTickCount,
  chartPaletteColor,
  formatNumericValue,
  formatXValue,
  normalizeXValue,
  resolveChartTheme,
  type CartesianChartModel,
  type ChartTarget,
  type ChartXTick,
  type NormalizedPoint,
  type NormalizedXValue,
  type PlacedPoint,
} from './chart-model-utilities.ts';
import {
  createAreaPath,
  createLinearScale,
  createLinePath,
  createNumericDomain,
  createPaddedDomain,
  createPointScale,
  createTicks,
  decimatePlacedPoints,
  decimationIndicesForLayers,
  MAXIMUM_RENDERED_SERIES_POINTS,
  normalizeNumericValue,
  sortXValues,
  type BandlikeScale,
  type LinearScale,
} from './chart-scale.ts';

const DEFAULT_MAXIMUM_X_TICK_COUNT = 8;

export function createCartesianModel(options: {
  componentId: 'line-chart' | 'area-chart';
  series: ChartCartesianSeries[];
  hiddenSeriesIds: string[];
  width: number;
  height: number;
  xAxis?: ChartXAxisConfiguration | undefined;
  yAxis?: ChartAxisConfiguration | undefined;
  stackedArea?: boolean;
  theme?: ChartTheme | undefined;
  measureText?: boolean | undefined;
  measurementElement?: Element | undefined;
  measurementVersion?: number | undefined;
}): CartesianChartModel {
  const {
    componentId,
    series,
    hiddenSeriesIds,
    width,
    height,
    xAxis,
    yAxis,
    stackedArea = false,
    theme,
    measureText = false,
    measurementElement,
    measurementVersion = 0,
  } = options;
  assertUniqueSeriesIds(componentId, series);
  assertValidChartNumber(componentId, 'invalid-height', height, 'height');
  assertValidTickCount(componentId, xAxis);
  assertValidTickCount(componentId, yAxis);

  const resolvedTheme = resolveChartTheme(theme);
  let geometry = createChartGeometry(width, height, {
    measureText,
    measurementElement,
    measurementVersion,
  });
  const allKinds = new Set<string>();
  const xValuesByKey = new Map<string, NormalizedXValue>();

  const normalizedSeries = series.map((item, seriesIndex) => {
    const seenX = new Set<string>();
    const color = item.color ?? chartPaletteColor(seriesIndex, resolvedTheme.palette);
    const points: NormalizedPoint[] = item.data.map((point, pointIndex) => {
      const x = normalizeXValue(point.x);
      allKinds.add(x.kind);
      if (seenX.has(x.key)) {
        throw new Error(
          `[cinder/${componentId}] rule=duplicate-x series="${item.id}" x="${x.label}": duplicate x values are not supported.`,
        );
      }
      seenX.add(x.key);
      xValuesByKey.set(x.key, x);
      const y = normalizeNumericValue(componentId, item.id, x.label, point.y);
      return {
        seriesId: item.id,
        seriesLabel: item.label,
        color,
        x,
        y,
        originalY: point.y,
        index: pointIndex,
      };
    });
    return { id: item.id, label: item.label, color, points };
  });

  if (allKinds.size > 1) {
    throw new Error(
      `[cinder/${componentId}] rule=mixed-x-domain-kind: all x values must share one domain kind.`,
    );
  }

  if (stackedArea) {
    for (const item of normalizedSeries) {
      for (const point of item.points) {
        if ((point.y ?? 0) < 0) {
          throw new Error(
            `[cinder/${componentId}] rule=negative-stacked-area series="${item.id}" x="${point.x.label}": stacked areas do not support negative values.`,
          );
        }
      }
    }
  }

  const sortedXValues = sortXValues([...xValuesByKey.values()]);
  // Index by key so we can preserve canonical x-domain order when sorting a
  // series' own points (string domains use insertion order, numeric/date sort
  // by `comparable`). Avoids `Number(stringKey)` returning NaN.
  const orderByKey = new Map(sortedXValues.map((value, index) => [value.key, index]));

  // Visible-only domain values. Hidden series no longer compress the visible
  // chart against invisible data, and the legend toggle's effect on scale is
  // consistent with the table and targets.
  const visibleNumericValues: number[] = [];
  for (const item of normalizedSeries) {
    if (hiddenSeriesIds.includes(item.id)) continue;
    for (const point of item.points) {
      if (point.y !== null) visibleNumericValues.push(point.y);
    }
  }

  const stackedTotalsByKey = new Map(sortedXValues.map((value) => [value.key, 0]));
  if (stackedArea) {
    for (const item of normalizedSeries) {
      if (hiddenSeriesIds.includes(item.id)) continue;
      for (const point of item.points) {
        if (point.y === null) continue;
        stackedTotalsByKey.set(point.x.key, (stackedTotalsByKey.get(point.x.key) ?? 0) + point.y);
      }
    }
  }
  const domainValues =
    stackedArea || componentId === 'area-chart'
      ? [0, ...(stackedArea ? stackedTotalsByKey.values() : visibleNumericValues)]
      : visibleNumericValues;
  const [yMinimum, yMaximum] = createPaddedDomain(domainValues);
  const tickCount =
    xAxis?.tickCount ?? Math.min(sortedXValues.length, DEFAULT_MAXIMUM_X_TICK_COUNT);
  const preliminaryXTicks = buildXAxisTicks(sortedXValues, tickCount, xAxis, () => 0);
  const yTicks = createTicks([yMinimum, yMaximum], yAxis?.tickCount ?? 5);
  geometry = createChartGeometry(width, height, {
    xTickLabels: preliminaryXTicks.map((tick) => tick.label),
    yTickLabels: yTicks.map((tick, index) => formatNumericValue(tick, yAxis, undefined, { index })),
    xAxis,
    yAxis,
    measureText,
    measurementElement,
    measurementVersion,
  });

  // Split scales into two correctly-typed variables so the use site can
  // discriminate on `kind` without `as` casts.
  const xStringScale: BandlikeScale | undefined =
    sortedXValues[0]?.kind === 'string'
      ? createPointScale(
          sortedXValues.map((value) => value.key),
          [0, geometry.plotWidth],
          0.5,
        )
      : undefined;
  const xNumericScale: LinearScale | undefined =
    sortedXValues[0] && sortedXValues[0].kind !== 'string'
      ? createLinearScale(createNumericDomain(sortedXValues), [0, geometry.plotWidth])
      : undefined;
  const yScale = createLinearScale([yMinimum, yMaximum], [geometry.plotHeight, 0]);

  function scaleX(value: NormalizedXValue): number {
    if (value.kind === 'string') return xStringScale?.(value.key) ?? 0;
    return xNumericScale?.(Number(value.comparable)) ?? 0;
  }

  // Build x-axis ticks placed at their true scaled positions so labels and
  // points line up for numeric and date domains.
  const xTicks: ChartXTick[] = buildXAxisTicks(sortedXValues, tickCount, xAxis, scaleX);

  const targets: ChartTarget[] = [];
  const tableRows: CartesianChartModel['tableRows'] = [];
  const stackedOffsetsByKey = new Map(sortedXValues.map((value) => [value.key, 0]));
  const normalizedPointsBySeriesId = stackedArea
    ? new Map(
        normalizedSeries.map((item) => [
          item.id,
          new Map(item.points.map((point) => [point.x.key, point])),
        ]),
      )
    : undefined;
  const stackedRenderXValues = stackedArea
    ? sortedXValues.filter((value) =>
        normalizedSeries.some(
          (item) =>
            !hiddenSeriesIds.includes(item.id) &&
            normalizedPointsBySeriesId?.get(item.id)?.has(value.key),
        ),
      )
    : undefined;
  const stackedRenderDomain = stackedRenderXValues ?? [];
  const stackedVisibleSeries = stackedArea
    ? normalizedSeries.filter((item) => !hiddenSeriesIds.includes(item.id))
    : [];
  const stackedLayerIndexBySeriesId = new Map(
    stackedVisibleSeries.map((item, layerIndex) => [item.id, layerIndex]),
  );
  const stackedBoundaryLayers = stackedArea
    ? (() => {
        const cumulativeValuesByKey = new Map(stackedRenderDomain.map((value) => [value.key, 0]));
        return stackedVisibleSeries.map((item) =>
          stackedRenderDomain.map((value) => {
            const point = normalizedPointsBySeriesId?.get(item.id)?.get(value.key);
            if (point?.y === null || point?.y === undefined) return null;
            const cumulativeValue = (cumulativeValuesByKey.get(value.key) ?? 0) + point.y;
            cumulativeValuesByKey.set(value.key, cumulativeValue);
            return cumulativeValue;
          }),
        );
      })()
    : undefined;
  const stackedRenderSelections = stackedBoundaryLayers
    ? decimationIndicesForLayers(stackedBoundaryLayers)
    : undefined;
  const renderedSeries = normalizedSeries.map((item) => {
    const hidden = hiddenSeriesIds.includes(item.id);
    const points = item.points
      .slice()
      .sort((a, b) => (orderByKey.get(a.x.key) ?? 0) - (orderByKey.get(b.x.key) ?? 0));

    const placedPoints: PlacedPoint[] = points.map((point) => {
      const lowerValue = stackedArea ? (stackedOffsetsByKey.get(point.x.key) ?? 0) : 0;
      const upperValue = lowerValue + (point.y ?? 0);
      return {
        ...point,
        pixelX: scaleX(point.x),
        pixelY: yScale(stackedArea ? upperValue : (point.y ?? 0)),
        pixelY0: yScale(stackedArea ? lowerValue : 0),
      };
    });
    const placedPointsByKey = stackedRenderSelections
      ? new Map(placedPoints.map((point) => [point.x.key, point]))
      : undefined;
    const renderPoints = stackedRenderSelections
      ? stackedRenderSelections.map(({ sourceIndex, forceGapLayerIndices }) => {
          const x = stackedRenderDomain[sourceIndex]!;
          const layerIndex = stackedLayerIndexBySeriesId.get(item.id);
          const forceGap = layerIndex !== undefined && forceGapLayerIndices.includes(layerIndex);
          if (!forceGap) {
            const placedPoint = placedPointsByKey?.get(x.key);
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
            pixelY0: stackedArea ? yScale(stackedOffsetsByKey.get(x.key) ?? 0) : yScale(0),
          } satisfies PlacedPoint;
        })
      : decimatePlacedPoints(placedPoints);
    const coordinates = renderPoints.map((placed) => ({
      x: placed.pixelX,
      y: placed.y === null ? null : placed.pixelY,
      y0: placed.pixelY0,
    }));

    if (!hidden) {
      for (const placed of placedPoints) {
        if (placed.y === null) continue;
        const xLabel = formatXValue(placed.x, xAxis, {
          seriesId: item.id,
          seriesLabel: item.label,
          index: placed.index,
        });
        const valueLabel = formatNumericValue(
          placed.y ?? 0,
          yAxis,
          series.find((entry) => entry.id === item.id)?.valueFormatter,
          { seriesId: item.id, seriesLabel: item.label, index: placed.index },
        );
        targets.push({
          id: `${item.id}-${placed.x.key}`,
          seriesId: item.id,
          seriesLabel: item.label,
          xLabel,
          valueLabel,
          x: placed.pixelX,
          y: placed.pixelY,
          color: item.color,
        });
        tableRows.push({
          id: `${item.id}-${placed.x.key}`,
          seriesId: item.id,
          seriesLabel: item.label,
          xLabel,
          valueLabel,
        });
      }
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

  targets.sort((a, b) => a.x - b.x);

  return {
    geometry,
    xTicks,
    yTicks,
    normalizedSeries: renderedSeries,
    tableRows: evenlySampleTableRows(tableRows, MAXIMUM_RENDERED_SERIES_POINTS),
    targets,
    empty: targets.length === 0,
    yDomain: [yMinimum, yMaximum],
    theme: resolvedTheme,
    marks: series.map((item) => ({
      seriesId: item.id,
      descriptors:
        componentId === 'line-chart'
          ? [
              { type: 'line' as const, data: item.data },
              { type: 'point' as const, data: item.data },
            ]
          : [
              { type: 'area' as const, data: item.data },
              { type: 'line' as const, data: item.data },
            ],
    })),
  };
}

function evenlySampleTableRows(
  rows: CartesianChartModel['tableRows'],
  maximumRows: number,
): CartesianChartModel['tableRows'] {
  if (rows.length <= maximumRows) return rows;
  if (maximumRows <= 0) return [];

  const rowsBySeriesId = new Map<string, CartesianChartModel['tableRows']>();
  for (const row of rows) {
    const seriesRows = rowsBySeriesId.get(row.seriesId);
    if (seriesRows) seriesRows.push(row);
    else rowsBySeriesId.set(row.seriesId, [row]);
  }
  const seriesGroups = [...rowsBySeriesId.values()];
  if (seriesGroups.length >= maximumRows) {
    return seriesGroups.slice(0, maximumRows).map((group) => group[0]!);
  }

  const remainingRows = maximumRows - seriesGroups.length;
  const capacities = seriesGroups.map((group) => group.length - 1);
  const totalCapacity = capacities.reduce((total, capacity) => total + capacity, 0);
  const exactShares = capacities.map((capacity) => (remainingRows * capacity) / totalCapacity);
  const allocations = exactShares.map((share) => 1 + Math.floor(share));
  let undistributedRows = maximumRows - allocations.reduce((total, count) => total + count, 0);
  const allocationOrder = exactShares
    .map((share, index) => ({ index, remainder: share - Math.floor(share) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (const { index } of allocationOrder) {
    if (undistributedRows === 0) break;
    if (allocations[index]! >= seriesGroups[index]!.length) continue;
    allocations[index]! += 1;
    undistributedRows -= 1;
  }

  return seriesGroups.flatMap((group, index) => evenlySampleRows(group, allocations[index]!));
}

function evenlySampleRows<T>(rows: T[], requestedRows: number): T[] {
  if (rows.length <= requestedRows) return rows;
  if (requestedRows <= 1) return rows[0] === undefined ? [] : [rows[0]];
  return Array.from({ length: requestedRows }, (_, index) => {
    const sourceIndex = Math.round((index * (rows.length - 1)) / (requestedRows - 1));
    return rows[sourceIndex]!;
  });
}

function buildXAxisTicks(
  sortedXValues: NormalizedXValue[],
  tickCount: number,
  xAxis: ChartAxisConfiguration | undefined,
  scaleX: (value: NormalizedXValue) => number,
): ChartXTick[] {
  if (sortedXValues.length === 0) return [];
  const safeTickCount = Math.max(1, Math.min(tickCount, sortedXValues.length));
  if (safeTickCount >= sortedXValues.length) {
    return sortedXValues.map((value, index) => ({
      label: formatXValue(value, xAxis, { index }),
      x: scaleX(value),
    }));
  }
  if (safeTickCount === 1) {
    const value = sortedXValues[0];
    return value ? [{ label: formatXValue(value, xAxis, { index: 0 }), x: scaleX(value) }] : [];
  }
  // Sample evenly across the sorted x values.
  const step = (sortedXValues.length - 1) / (safeTickCount - 1);
  const ticks: ChartXTick[] = [];
  for (let i = 0; i < safeTickCount; i++) {
    const sourceIndex = Math.round(i * step);
    const value = sortedXValues[sourceIndex];
    if (!value) continue;
    ticks.push({
      label: formatXValue(value, xAxis, { index: sourceIndex }),
      x: scaleX(value),
    });
  }
  return ticks;
}
