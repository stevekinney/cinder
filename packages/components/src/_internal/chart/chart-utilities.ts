import type {
  BarChartDatum,
  BarChartMode,
  BarChartOrientation,
  BarChartSeries,
  ChartAxisConfiguration,
  ChartCartesianSeries,
  ChartDataTableVisibility,
  ChartFormatterContext,
  ChartLegendPosition,
  ChartNumericValue,
  ChartXValue,
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

function chartPaletteColor(index: number): string {
  return chartPalette[index % chartPalette.length] ?? 'var(--cinder-chart-series-1)';
}

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

export type CartesianChartModel = {
  geometry: ChartGeometry;
  xLabels: string[];
  yTicks: number[];
  normalizedSeries: Array<{
    id: string;
    label: string;
    color: string;
    points: NormalizedPoint[];
    path: string;
    areaPath: string;
    hidden: boolean;
  }>;
  tableRows: Array<{
    id: string;
    seriesLabel: string;
    xLabel: string;
    valueLabel: string;
  }>;
  targets: ChartTarget[];
  empty: boolean;
  yDomain: [number, number];
};

export type BarChartModel = {
  geometry: ChartGeometry;
  categories: NormalizedXValue[];
  yTicks: number[];
  bars: Array<{
    id: string;
    seriesId: string;
    seriesLabel: string;
    categoryLabel: string;
    valueLabel: string;
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
    hidden: boolean;
  }>;
  tableRows: Array<{
    categoryLabel: string;
    values: Array<{ seriesId: string; seriesLabel: string; valueLabel: string }>;
  }>;
  targets: ChartTarget[];
  empty: boolean;
  valueDomain: [number, number];
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
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
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

export function createCartesianModel(options: {
  componentId: 'line-chart' | 'area-chart';
  series: ChartCartesianSeries[];
  hiddenSeriesIds: string[];
  width: number;
  height: number;
  xAxis?: ChartAxisConfiguration | undefined;
  yAxis?: ChartAxisConfiguration | undefined;
  stackedArea?: boolean;
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
  } = options;
  assertUniqueSeriesIds(componentId, series);
  assertValidChartNumber(componentId, 'invalid-height', height, 'height');
  assertValidTickCount(componentId, xAxis);
  assertValidTickCount(componentId, yAxis);

  const geometry = createGeometry(width, height);
  const allKinds = new Set<string>();
  const xValuesByKey = new Map<string, NormalizedXValue>();
  const allNumericValues: number[] = [];

  const normalizedSeries = series.map((item, seriesIndex) => {
    const seenX = new Set<string>();
    const color = item.color ?? chartPaletteColor(seriesIndex);
    const points = item.data.map((point, pointIndex) => {
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
      if (y !== null) allNumericValues.push(y);
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
  const xLabels = sortedXValues.map((value, index) => formatXValue(value, xAxis, { index }));
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
  const domainValues = stackedArea ? [0, ...stackedTotalsByKey.values()] : allNumericValues;
  const [yMinimum, yMaximum] = createPaddedDomain(domainValues);
  const xScale =
    sortedXValues[0]?.kind === 'string'
      ? createPointScale(
          sortedXValues.map((value) => value.key),
          [0, geometry.plotWidth],
          0.5,
        )
      : createLinearScale(createNumericDomain(sortedXValues), [0, geometry.plotWidth]);
  const yScale = createLinearScale([yMinimum, yMaximum], [geometry.plotHeight, 0]);

  const targets: ChartTarget[] = [];
  const tableRows: CartesianChartModel['tableRows'] = [];
  const stackedOffsetsByKey = new Map(sortedXValues.map((value) => [value.key, 0]));
  const renderedSeries = normalizedSeries.map((item) => {
    const hidden = hiddenSeriesIds.includes(item.id);
    const points = item.points
      .filter((point) => point.y !== null)
      .toSorted((a, b) => Number(a.x.comparable) - Number(b.x.comparable));
    const coordinates: Array<{ point: NormalizedPoint; x: number; y: number; y0: number }> =
      points.map((point) => {
        const scaledX =
          point.x.kind === 'string'
            ? (xScale as (value: string) => number | undefined)(point.x.key)
            : (xScale as (value: number) => number)(Number(point.x.comparable));
        const lowerValue = stackedArea ? (stackedOffsetsByKey.get(point.x.key) ?? 0) : 0;
        const upperValue = lowerValue + (point.y ?? 0);
        return {
          point,
          x: scaledX ?? 0,
          y: yScale(stackedArea ? upperValue : (point.y ?? 0)),
          y0: yScale(lowerValue),
        };
      });
    if (!hidden) {
      for (const coordinate of coordinates) {
        const xLabel = formatXValue(coordinate.point.x, xAxis, {
          seriesId: item.id,
          seriesLabel: item.label,
          index: coordinate.point.index,
        });
        const valueLabel = formatNumericValue(
          coordinate.point.y ?? 0,
          yAxis,
          series.find((entry) => entry.id === item.id)?.valueFormatter,
          { seriesId: item.id, seriesLabel: item.label, index: coordinate.point.index },
        );
        targets.push({
          id: `${item.id}-${coordinate.point.x.key}`,
          seriesId: item.id,
          seriesLabel: item.label,
          xLabel,
          valueLabel,
          x: coordinate.x,
          y: coordinate.y,
          color: item.color,
        });
        tableRows.push({
          id: `${item.id}-${coordinate.point.x.key}`,
          seriesLabel: item.label,
          xLabel,
          valueLabel,
        });
      }
      if (stackedArea) {
        for (const point of points) {
          stackedOffsetsByKey.set(
            point.x.key,
            (stackedOffsetsByKey.get(point.x.key) ?? 0) + (point.y ?? 0),
          );
        }
      }
    }
    return {
      ...item,
      hidden,
      path: hidden ? '' : createLinePath(coordinates),
      areaPath: hidden
        ? ''
        : createAreaPath(coordinates, stackedArea ? undefined : geometry.plotHeight),
    };
  });

  return {
    geometry,
    xLabels,
    yTicks: yScale.ticks(yAxis?.tickCount ?? 5),
    normalizedSeries: renderedSeries,
    tableRows,
    targets,
    empty: targets.length === 0,
    yDomain: [yMinimum, yMaximum],
  };
}

export function createBarModel(options: {
  data: BarChartDatum[];
  categoryKey: string;
  series: BarChartSeries[];
  hiddenSeriesIds: string[];
  width: number;
  height: number;
  orientation: BarChartOrientation;
  mode: BarChartMode;
  xAxis?: ChartAxisConfiguration | undefined;
  yAxis?: ChartAxisConfiguration | undefined;
}): BarChartModel {
  const {
    data,
    categoryKey,
    series,
    hiddenSeriesIds,
    width,
    height,
    orientation,
    mode,
    xAxis,
    yAxis,
  } = options;
  assertUniqueSeriesIds('bar-chart', series);
  assertValidChartNumber('bar-chart', 'invalid-height', height, 'height');
  assertValidTickCount('bar-chart', xAxis);
  assertValidTickCount('bar-chart', yAxis);

  const geometry = createGeometry(width, height);
  const categories: NormalizedXValue[] = [];
  const seenCategories = new Set<string>();
  const categoryKinds = new Set<string>();
  const allValues: number[] = [0];

  for (const datum of data) {
    if (!(categoryKey in datum)) {
      throw new Error(
        `[cinder/bar-chart] rule=invalid-bar-category key="${categoryKey}": category key is missing.`,
      );
    }
    const rawCategory = datum[categoryKey];
    if (
      !(
        typeof rawCategory === 'string' ||
        typeof rawCategory === 'number' ||
        rawCategory instanceof Date
      )
    ) {
      throw new Error(
        `[cinder/bar-chart] rule=invalid-bar-category key="${categoryKey}": category must be string, number, or Date.`,
      );
    }
    const category = normalizeXValue(rawCategory);
    categoryKinds.add(category.kind);
    if (seenCategories.has(category.key)) {
      throw new Error(
        `[cinder/bar-chart] rule=duplicate-category key="${categoryKey}" category="${category.label}": duplicate categories are not supported.`,
      );
    }
    seenCategories.add(category.key);
    categories.push(category);
    for (const item of series) {
      if (!(item.valueKey in datum)) {
        throw new Error(
          `[cinder/bar-chart] rule=missing-bar-value-key key="${item.valueKey}": value key is missing.`,
        );
      }
      const value = datum[item.valueKey];
      if (!(typeof value === 'number' || value === null || value === undefined)) {
        throw new Error(
          `[cinder/bar-chart] rule=invalid-bar-value key="${item.valueKey}" category="${category.label}": value must be number, null, or undefined.`,
        );
      }
      const numericValue = normalizeNumericValue('bar-chart', item.id, category.label, value);
      if (numericValue !== null) allValues.push(numericValue);
    }
  }

  if (categoryKinds.size > 1) {
    throw new Error(
      `[cinder/bar-chart] rule=mixed-bar-category-kind key="${categoryKey}": category values must share one domain kind.`,
    );
  }

  const sortedCategories = sortXValues(categories);
  const visibleSeries = series.filter((item) => !hiddenSeriesIds.includes(item.id));
  const valueDomain = createPaddedDomain(
    mode === 'stacked'
      ? createStackedBarDomainValues(data, sortedCategories, categoryKey, series)
      : allValues,
  );
  const valueScale = createLinearScale(
    valueDomain,
    orientation === 'vertical' ? [geometry.plotHeight, 0] : [0, geometry.plotWidth],
  );
  const categoryScale = createBandScale(
    sortedCategories.map((category) => category.key),
    orientation === 'vertical' ? [0, geometry.plotWidth] : [0, geometry.plotHeight],
    0.18,
  );
  const groupScale = createBandScale(
    visibleSeries.map((item) => item.id),
    [0, categoryScale.bandwidth()],
    0.12,
  );

  const bars: BarChartModel['bars'] = [];
  const targets: ChartTarget[] = [];
  const tableRows: BarChartModel['tableRows'] = [];
  for (const category of sortedCategories) {
    const datum = data.find(
      (candidate) => normalizeXValue(candidate[categoryKey] as ChartXValue).key === category.key,
    );
    if (!datum) continue;
    let positiveOffset = 0;
    let negativeOffset = 0;
    const rowValues: BarChartModel['tableRows'][number]['values'] = [];
    visibleSeries.forEach((item, seriesIndex) => {
      const rawValue = datum[item.valueKey] as number | null | undefined;
      if (rawValue === null || rawValue === undefined) return;
      const value = rawValue;
      const seriesColorIndex = Math.max(
        0,
        series.findIndex((entry) => entry.id === item.id),
      );
      const color = item.color ?? chartPaletteColor(seriesColorIndex);
      const categoryPosition = categoryScale(category.key) ?? 0;
      let x = 0;
      let y = 0;
      let barWidth = 0;
      let barHeight = 0;
      if (orientation === 'vertical') {
        const groupX = mode === 'grouped' ? (groupScale(item.id) ?? 0) : 0;
        const start = mode === 'stacked' ? (value >= 0 ? positiveOffset : negativeOffset) : 0;
        const end = start + value;
        if (mode === 'stacked') {
          if (value >= 0) positiveOffset = end;
          else negativeOffset = end;
        }
        const y0 = valueScale(start);
        const y1 = valueScale(end);
        x = categoryPosition + groupX;
        y = Math.min(y0, y1);
        barWidth = mode === 'grouped' ? groupScale.bandwidth() : categoryScale.bandwidth();
        barHeight = Math.abs(y1 - y0);
      } else {
        const groupY = mode === 'grouped' ? (groupScale(item.id) ?? 0) : 0;
        const start = mode === 'stacked' ? (value >= 0 ? positiveOffset : negativeOffset) : 0;
        const end = start + value;
        if (mode === 'stacked') {
          if (value >= 0) positiveOffset = end;
          else negativeOffset = end;
        }
        const x0 = valueScale(start);
        const x1 = valueScale(end);
        x = Math.min(x0, x1);
        y = categoryPosition + groupY;
        barWidth = Math.abs(x1 - x0);
        barHeight = mode === 'grouped' ? groupScale.bandwidth() : categoryScale.bandwidth();
      }
      const valueLabel = formatNumericValue(
        value,
        orientation === 'vertical' ? yAxis : xAxis,
        item.valueFormatter,
        { seriesId: item.id, seriesLabel: item.label, index: seriesIndex },
      );
      const categoryLabel = formatXValue(category, orientation === 'vertical' ? xAxis : yAxis, {
        seriesId: item.id,
        seriesLabel: item.label,
        index: seriesIndex,
      });
      rowValues.push({ seriesId: item.id, seriesLabel: item.label, valueLabel });
      const bar = {
        id: `${item.id}-${category.key}`,
        seriesId: item.id,
        seriesLabel: item.label,
        categoryLabel,
        valueLabel,
        x,
        y,
        width: barWidth,
        height: barHeight,
        color,
        hidden: false,
      };
      bars.push(bar);
      targets.push({ ...bar, x: x + barWidth / 2, y: y + barHeight / 2, xLabel: categoryLabel });
    });
    if (rowValues.length > 0) {
      tableRows.push({
        categoryLabel: formatXValue(category, orientation === 'vertical' ? xAxis : yAxis, {
          index: tableRows.length,
        }),
        values: rowValues,
      });
    }
  }

  return {
    geometry,
    categories: sortedCategories,
    yTicks: valueScale.ticks((orientation === 'vertical' ? yAxis : xAxis)?.tickCount ?? 5),
    bars,
    tableRows,
    targets,
    empty: targets.length === 0,
    valueDomain,
  };
}

export function nearestTarget(
  targets: ChartTarget[],
  x: number,
  y: number,
): ChartTarget | undefined {
  return targets.reduce<ChartTarget | undefined>((nearest, target) => {
    if (!nearest) return target;
    const targetDistance = Math.hypot(target.x - x, target.y - y);
    const nearestDistance = Math.hypot(nearest.x - x, nearest.y - y);
    return targetDistance < nearestDistance ? target : nearest;
  }, undefined);
}

export function legendVisible(legendPosition: ChartLegendPosition, seriesCount: number): boolean {
  return legendPosition !== 'none' && seriesCount > 0;
}

function createGeometry(width: number, height: number): ChartGeometry {
  const marginTop = 16;
  const marginRight = 16;
  const marginBottom = 36;
  const marginLeft = 48;
  return {
    plotWidth: Math.max(1, width - marginLeft - marginRight),
    plotHeight: Math.max(1, height - marginTop - marginBottom),
    marginTop,
    marginRight,
    marginBottom,
    marginLeft,
  };
}

function normalizeNumericValue(
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

function sortXValues(values: NormalizedXValue[]): NormalizedXValue[] {
  if (values[0]?.kind === 'string') return values;
  return [...values].toSorted((a, b) => Number(a.comparable) - Number(b.comparable));
}

function createPaddedDomain(values: number[]): [number, number] {
  const minimum = values.length > 0 ? Math.min(...values) : 0;
  const maximum = values.length > 0 ? Math.max(...values) : 0;
  if (minimum === maximum) return [minimum - 1, maximum + 1];
  return [Math.min(0, minimum), Math.max(0, maximum)];
}

type LinearScale = ((value: number) => number) & {
  ticks: (count: number) => number[];
};

type BandScale = ((value: string) => number | undefined) & {
  bandwidth: () => number;
};

function createLinearScale(domain: [number, number], range: [number, number]): LinearScale {
  const [domainMinimum, domainMaximum] =
    domain[0] === domain[1] ? [domain[0] - 1, domain[1] + 1] : domain;
  const [rangeMinimum, rangeMaximum] = range;
  const domainSpan = domainMaximum - domainMinimum;
  const rangeSpan = rangeMaximum - rangeMinimum;
  const scale = ((value: number) =>
    rangeMinimum + ((value - domainMinimum) / domainSpan) * rangeSpan) as LinearScale;
  scale.ticks = (count: number) => createTicks([domainMinimum, domainMaximum], count);
  return scale;
}

function createPointScale(
  domain: string[],
  range: [number, number],
  padding: number,
): (value: string) => number | undefined {
  const positions = new Map<string, number>();
  if (domain.length === 0) return () => undefined;

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

function createBandScale(domain: string[], range: [number, number], padding: number): BandScale {
  const positions = new Map<string, number>();
  const [rangeMinimum, rangeMaximum] = range;
  const availableSize = Math.max(0, rangeMaximum - rangeMinimum);
  const step =
    domain.length === 0
      ? 0
      : availableSize / Math.max(1, domain.length + padding * (domain.length - 1));
  const bandWidth = Math.max(0, step * (1 - padding));
  domain.forEach((value, index) => positions.set(value, rangeMinimum + step * index));

  const scale = ((value: string) => positions.get(value)) as BandScale;
  scale.bandwidth = () => bandWidth;
  return scale;
}

function createNumericDomain(values: NormalizedXValue[]): [number, number] {
  const numericValues = values.map((value) => Number(value.comparable));
  if (numericValues.length === 0) return [0, 1];
  const minimum = Math.min(...numericValues);
  const maximum = Math.max(...numericValues);
  return minimum === maximum ? [minimum - 1, maximum + 1] : [minimum, maximum];
}

function createTicks(domain: [number, number], count: number): number[] {
  const safeCount = Math.max(1, Math.floor(count));
  if (safeCount === 1) return [domain[0]];
  const step = (domain[1] - domain[0]) / (safeCount - 1);
  return Array.from({ length: safeCount }, (_, index) => domain[0] + step * index);
}

function createLinePath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return '';
  const [firstPoint, ...remainingPoints] = points;
  return [
    `M${formatPathNumber(firstPoint?.x ?? 0)},${formatPathNumber(firstPoint?.y ?? 0)}`,
    ...remainingPoints.map((point) => `L${formatPathNumber(point.x)},${formatPathNumber(point.y)}`),
  ].join('');
}

function createAreaPath(
  points: Array<{ x: number; y: number; y0?: number }>,
  baseline: number | undefined,
): string {
  if (points.length === 0) return '';
  const firstPoint = points[0];
  const lastPoint = points.at(-1);
  if (!firstPoint || !lastPoint) return '';
  const lowerPoints = points
    .toReversed()
    .map((point) => `L${formatPathNumber(point.x)},${formatPathNumber(point.y0 ?? baseline ?? 0)}`);
  return [
    `M${formatPathNumber(firstPoint.x)},${formatPathNumber(firstPoint.y0 ?? baseline ?? 0)}`,
    `L${formatPathNumber(firstPoint.x)},${formatPathNumber(firstPoint.y)}`,
    ...points.slice(1).map((point) => `L${formatPathNumber(point.x)},${formatPathNumber(point.y)}`),
    ...lowerPoints,
    'Z',
  ].join('');
}

function createStackedBarDomainValues(
  data: BarChartDatum[],
  categories: NormalizedXValue[],
  categoryKey: string,
  series: BarChartSeries[],
): number[] {
  const values = [0];
  for (const category of categories) {
    const datum = data.find(
      (candidate) => normalizeXValue(candidate[categoryKey] as ChartXValue).key === category.key,
    );
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
