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

/**
 * Resolves a palette color for a series by index, wrapping around the palette.
 * Exported so chart components can render legend swatches using the same
 * resolved color the chart uses for the series itself.
 */
export function chartPaletteColor(index: number): string {
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

/**
 * An x-axis tick paired with its already-scaled pixel position. Charts render
 * labels at the model-provided `x` so labels and points stay aligned for
 * numeric and date domains.
 */
export type ChartXTick = {
  label: string;
  x: number;
};

export type CartesianChartModel = {
  geometry: ChartGeometry;
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
  tableRows: Array<{
    id: string;
    seriesLabel: string;
    xLabel: string;
    valueLabel: string;
  }>;
  /** Targets sorted by `x` (binary-search precondition for nearestTarget). */
  targets: ChartTarget[];
  empty: boolean;
  yDomain: [number, number];
};

export type BarChartModel = {
  geometry: ChartGeometry;
  categories: NormalizedXValue[];
  yTicks: number[];
  categoryTicks: Array<{
    categoryKey: string;
    label: string;
    fullLabel: string;
    x: number;
    y: number;
  }>;
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
    categoryKey: string;
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

  const normalizedSeries = series.map((item, seriesIndex) => {
    const seenX = new Set<string>();
    const color = item.color ?? chartPaletteColor(seriesIndex);
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
  const domainValues = stackedArea ? [0, ...stackedTotalsByKey.values()] : visibleNumericValues;
  const [yMinimum, yMaximum] = createPaddedDomain(domainValues);

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
  const tickCount = xAxis?.tickCount ?? sortedXValues.length;
  const xTicks: ChartXTick[] = buildXAxisTicks(sortedXValues, tickCount, xAxis, scaleX);

  const targets: ChartTarget[] = [];
  const tableRows: CartesianChartModel['tableRows'] = [];
  const stackedOffsetsByKey = new Map(sortedXValues.map((value) => [value.key, 0]));
  const renderedSeries = normalizedSeries.map((item) => {
    const hidden = hiddenSeriesIds.includes(item.id);
    const points = item.points
      .filter((point) => point.y !== null)
      .toSorted((a, b) => (orderByKey.get(a.x.key) ?? 0) - (orderByKey.get(b.x.key) ?? 0));

    const placedPoints: PlacedPoint[] = points.map((point) => {
      const lowerValue = stackedArea ? (stackedOffsetsByKey.get(point.x.key) ?? 0) : 0;
      const upperValue = lowerValue + (point.y ?? 0);
      return {
        ...point,
        pixelX: scaleX(point.x),
        pixelY: yScale(stackedArea ? upperValue : (point.y ?? 0)),
      };
    });
    const coordinates = placedPoints.map((placed) => ({
      x: placed.pixelX,
      y: placed.pixelY,
      y0: yScale(stackedArea ? (stackedOffsetsByKey.get(placed.x.key) ?? 0) : 0),
    }));

    if (!hidden) {
      for (const placed of placedPoints) {
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
      points: hidden ? [] : placedPoints,
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
    yTicks: yScale.ticks(yAxis?.tickCount ?? 5),
    normalizedSeries: renderedSeries,
    tableRows,
    targets,
    empty: targets.length === 0,
    yDomain: [yMinimum, yMaximum],
  };
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
      label: formatXValue(value, xAxis, { index: i }),
      x: scaleX(value),
    });
  }
  return ticks;
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

  const categories: NormalizedXValue[] = [];
  const seenCategories = new Set<string>();
  const categoryKinds = new Set<string>();
  const visibleSeries = series.filter((item) => !hiddenSeriesIds.includes(item.id));
  const visibleValues: number[] = [0];
  // Build a key-keyed lookup once so the render loop is O(categories), not
  // O(categories * rows) with allocations per probe.
  const datumByKey = new Map<string, BarChartDatum>();

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
    datumByKey.set(category.key, datum);
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
      if (numericValue !== null && !hiddenSeriesIds.includes(item.id))
        visibleValues.push(numericValue);
    }
  }

  if (categoryKinds.size > 1) {
    throw new Error(
      `[cinder/bar-chart] rule=mixed-bar-category-kind key="${categoryKey}": category values must share one domain kind.`,
    );
  }

  const sortedCategories = sortXValues(categories);
  const categoryLabels = sortedCategories.map((category, index) =>
    formatXValue(category, orientation === 'vertical' ? xAxis : yAxis, { index }),
  );
  const horizontalCategoryLabelLayout =
    orientation === 'horizontal'
      ? createHorizontalCategoryLabelLayout(categoryLabels, width)
      : undefined;
  const geometry = createGeometry(width, height, horizontalCategoryLabelLayout?.marginLeft);
  // Domain is computed from visible series only — same convention as cartesian
  // charts — so the value scale shrinks correctly when a series is hidden.
  const valueDomain = createPaddedDomain(
    mode === 'stacked'
      ? createStackedBarDomainValues(datumByKey, sortedCategories, visibleSeries)
      : visibleValues,
  );
  if (sortedCategories.length === 0) {
    const tickAxis = orientation === 'vertical' ? yAxis : xAxis;
    return {
      geometry,
      categories: [],
      yTicks: createTicks(valueDomain, tickAxis?.tickCount ?? 5),
      categoryTicks: [],
      bars: [],
      tableRows: [],
      targets: [],
      empty: true,
      valueDomain,
    };
  }
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
  const categoryTicks = sortedCategories.map((category, index) => {
    const categoryPosition = categoryScale(category.key) ?? 0;
    return {
      categoryKey: category.key,
      label:
        horizontalCategoryLabelLayout?.labels[index] ?? categoryLabels[index] ?? category.label,
      fullLabel: categoryLabels[index] ?? category.label,
      x: orientation === 'vertical' ? categoryPosition + categoryScale.bandwidth() / 2 : -8,
      y:
        orientation === 'vertical'
          ? geometry.plotHeight + 20
          : categoryPosition + categoryScale.bandwidth() / 2,
    };
  });

  const bars: BarChartModel['bars'] = [];
  const targets: ChartTarget[] = [];
  const tableRows: BarChartModel['tableRows'] = [];
  for (const [categoryIndex, category] of sortedCategories.entries()) {
    const datum = datumByKey.get(category.key);
    if (!datum) continue;
    let positiveOffset = 0;
    let negativeOffset = 0;
    const rowValues: BarChartModel['tableRows'][number]['values'] = [];
    visibleSeries.forEach((item) => {
      const rawValue = datum[item.valueKey];
      if (typeof rawValue !== 'number') return;
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
        { seriesId: item.id, seriesLabel: item.label, index: categoryIndex },
      );
      const categoryLabel = formatXValue(category, orientation === 'vertical' ? xAxis : yAxis, {
        seriesId: item.id,
        seriesLabel: item.label,
        index: categoryIndex,
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
        categoryKey: category.key,
        categoryLabel: formatXValue(category, orientation === 'vertical' ? xAxis : yAxis, {
          index: tableRows.length,
        }),
        values: rowValues,
      });
    }
  }

  // Sort targets by the dominant axis for binary-search nearestTarget. For
  // vertical bars the dominant axis is x; for horizontal bars it is y.
  targets.sort((a, b) => (orientation === 'vertical' ? a.x - b.x : a.y - b.y));

  return {
    geometry,
    categories: sortedCategories,
    yTicks: valueScale.ticks((orientation === 'vertical' ? yAxis : xAxis)?.tickCount ?? 5),
    categoryTicks,
    bars,
    tableRows,
    targets,
    empty: targets.length === 0,
    valueDomain,
  };
}

/**
 * Locates the target closest to a (x, y) pointer. Uses binary search on the
 * provided `axis` (defaults to `x`) — targets MUST be sorted ascending on that
 * axis (createCartesianModel and createBarModel guarantee this). Falls back to
 * a linear scan when targets are empty.
 */
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

const DEFAULT_CHART_MARGIN_LEFT = 48;
const HORIZONTAL_CATEGORY_LABEL_CHARACTER_WIDTH = 12;
const HORIZONTAL_CATEGORY_LABEL_GAP = 8;
const HORIZONTAL_CATEGORY_LABEL_OUTER_PADDING = 8;
const MAXIMUM_HORIZONTAL_CATEGORY_LABEL_FRACTION = 0.4;

function createGeometry(
  width: number,
  height: number,
  marginLeft = DEFAULT_CHART_MARGIN_LEFT,
): ChartGeometry {
  const marginTop = 16;
  const marginRight = 16;
  const marginBottom = 36;
  return {
    plotWidth: Math.max(1, width - marginLeft - marginRight),
    plotHeight: Math.max(1, height - marginTop - marginBottom),
    marginTop,
    marginRight,
    marginBottom,
    marginLeft,
  };
}

function createHorizontalCategoryLabelLayout(
  labels: string[],
  chartWidth: number,
): { labels: string[]; marginLeft: number } {
  const maximumMarginLeft = Math.max(
    DEFAULT_CHART_MARGIN_LEFT,
    Math.floor(chartWidth * MAXIMUM_HORIZONTAL_CATEGORY_LABEL_FRACTION),
  );
  const requestedMarginLeft =
    Math.max(0, ...labels.map(estimateHorizontalCategoryLabelWidth)) +
    HORIZONTAL_CATEGORY_LABEL_GAP +
    HORIZONTAL_CATEGORY_LABEL_OUTER_PADDING;
  const marginLeft = Math.min(
    maximumMarginLeft,
    Math.max(DEFAULT_CHART_MARGIN_LEFT, requestedMarginLeft),
  );
  const availableLabelWidth = Math.max(
    0,
    marginLeft - HORIZONTAL_CATEGORY_LABEL_GAP - HORIZONTAL_CATEGORY_LABEL_OUTER_PADDING,
  );

  return {
    marginLeft,
    labels: labels.map((label) => truncateHorizontalCategoryLabel(label, availableLabelWidth)),
  };
}

function estimateHorizontalCategoryLabelWidth(label: string): number {
  return Array.from(label).length * HORIZONTAL_CATEGORY_LABEL_CHARACTER_WIDTH;
}

function truncateHorizontalCategoryLabel(label: string, availableWidth: number): string {
  if (estimateHorizontalCategoryLabelWidth(label) <= availableWidth) return label;

  const availableCharacterCount = Math.floor(
    availableWidth / HORIZONTAL_CATEGORY_LABEL_CHARACTER_WIDTH,
  );
  if (availableCharacterCount <= 0) return '';
  if (availableCharacterCount === 1) return '…';

  return `${Array.from(label)
    .slice(0, availableCharacterCount - 1)
    .join('')}…`;
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

type LinearScale = ((value: number) => number) & {
  ticks: (count: number) => number[];
};

type BandlikeScale = ((value: string) => number | undefined) & {
  bandwidth?: () => number;
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

function createPointScale(
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

  // Same Object.assign + satisfies pattern as createLinearScale — the
  // intersection type is satisfied at construction, not asserted after.
  const scale = Object.assign((value: string) => positions.get(value), {
    bandwidth: (): number => bandWidth,
  }) satisfies BandScale;
  return scale;
}

function createNumericDomain(values: NormalizedXValue[]): [number, number] {
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
