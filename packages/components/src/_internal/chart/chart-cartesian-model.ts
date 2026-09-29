import type {
  ChartAxisConfiguration,
  ChartCartesianSeries,
  ChartTheme,
  ChartXAxisConfiguration,
} from '../../components/chart.types.ts';
import { cartesianDomainValues, normalizeCartesianData } from './chart-cartesian-data.ts';
import { renderCartesianSeries } from './chart-cartesian-series.ts';
import { MAXIMUM_RENDERED_SERIES_POINTS } from './chart-decimation.ts';
import { createChartGeometry } from './chart-layout.ts';
import {
  assertUniqueSeriesIds,
  assertValidChartNumber,
  assertValidTickCount,
  formatNumericValue,
  formatXValue,
  resolveChartTheme,
  type CartesianChartModel,
  type ChartGeometry,
  type ChartXTick,
  type NormalizedXValue,
} from './chart-model-utilities.ts';
import {
  createLinearScale,
  createNumericDomain,
  createPaddedDomain,
  createPointScale,
  createTicks,
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
  const { normalizedSeries, sortedXValues } = normalizeCartesianData(
    componentId,
    series,
    resolvedTheme.palette,
    stackedArea,
  );
  const domainValues = cartesianDomainValues(
    componentId,
    normalizedSeries,
    sortedXValues,
    hiddenSeriesIds,
    stackedArea,
  );
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

  const { scaleX, yScale } = createCartesianScales(sortedXValues, geometry, [yMinimum, yMaximum]);

  // Build x-axis ticks placed at their true scaled positions so labels and
  // points line up for numeric and date domains.
  const xTicks: ChartXTick[] = buildXAxisTicks(sortedXValues, tickCount, xAxis, scaleX);

  const { renderedSeries, targets, tableRows } = renderCartesianSeries({
    normalizedSeries,
    sortedXValues,
    hiddenSeriesIds,
    stackedArea,
    series,
    xAxis,
    yAxis,
    scaleX,
    yScale,
    geometry,
  });

  return {
    geometry,
    xTicks,
    yTicks,
    normalizedSeries: renderedSeries,
    tableRows: evenlySampleTableRows(tableRows, MAXIMUM_RENDERED_SERIES_POINTS),
    targets: targets.sort((a, b) => a.x - b.x),
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
  const allocationOrder = exactShares.map((share, index) => ({
    index,
    remainder: share - Math.floor(share),
  }));
  allocationOrder.sort((a, b) => b.remainder - a.remainder || a.index - b.index);
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

function createCartesianScales(
  sortedXValues: NormalizedXValue[],
  geometry: ChartGeometry,
  yDomain: [number, number],
) {
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
  const yScale = createLinearScale(yDomain, [geometry.plotHeight, 0]);

  function scaleX(value: NormalizedXValue): number {
    if (value.kind === 'string') return xStringScale?.(value.key) ?? 0;
    return xNumericScale?.(Number(value.comparable)) ?? 0;
  }

  return { scaleX, yScale };
}
