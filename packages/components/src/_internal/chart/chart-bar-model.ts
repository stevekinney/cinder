import type {
  BarChartDatum,
  BarChartMode,
  BarChartOrientation,
  BarChartSeries,
  ChartAxisConfiguration,
  ChartTheme,
  ChartXAxisConfiguration,
} from '../../components/chart.types.ts';
import {
  createChartGeometry,
  createHorizontalCategoryLabelLayout,
  HORIZONTAL_CATEGORY_LABEL_GAP,
} from './chart-layout.ts';
import {
  assertUniqueSeriesIds,
  assertValidChartNumber,
  assertValidTickCount,
  chartPaletteColor,
  formatNumericValue,
  formatXValue,
  normalizeXValue,
  resolveChartTheme,
  type BarChartModel,
  type ChartTarget,
  type NormalizedXValue,
} from './chart-model-utilities.ts';
import {
  createBandScale,
  createLinearScale,
  createPaddedDomain,
  createStackedBarDomainValues,
  createTicks,
  normalizeNumericValue,
  sortXValues,
} from './chart-scale.ts';
export function createBarModel(options: {
  data: BarChartDatum[];
  categoryKey: string;
  series: BarChartSeries[];
  hiddenSeriesIds: string[];
  width: number;
  height: number;
  orientation: BarChartOrientation;
  mode: BarChartMode;
  xAxis?: ChartXAxisConfiguration | undefined;
  yAxis?: ChartAxisConfiguration | undefined;
  theme?: ChartTheme | undefined;
  measureText?: boolean | undefined;
  measurementElement?: Element | undefined;
  measurementVersion?: number | undefined;
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
    theme,
    measureText = false,
    measurementElement,
    measurementVersion = 0,
  } = options;
  assertUniqueSeriesIds('bar-chart', series);
  assertValidChartNumber('bar-chart', 'invalid-height', height, 'height');
  assertValidTickCount('bar-chart', xAxis);
  assertValidTickCount('bar-chart', yAxis);
  const resolvedTheme = resolveChartTheme(theme);

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
      ? createHorizontalCategoryLabelLayout(categoryLabels, width, {
          measureText,
          measurementElement,
          measurementVersion,
        })
      : undefined;
  // Domain is computed from visible series only — same convention as cartesian
  // charts — so the value scale shrinks correctly when a series is hidden.
  const valueDomain = createPaddedDomain(
    mode === 'stacked'
      ? createStackedBarDomainValues(datumByKey, sortedCategories, visibleSeries)
      : visibleValues,
  );
  const valueTickAxis = orientation === 'vertical' ? yAxis : xAxis;
  const valueTicks = createTicks(valueDomain, valueTickAxis?.tickCount ?? 5);
  const valueTickLabels = valueTicks.map((tick, index) =>
    formatNumericValue(tick, valueTickAxis, undefined, { index }),
  );
  const geometry = createChartGeometry(width, height, {
    xTickLabels: orientation === 'vertical' ? categoryLabels : valueTickLabels,
    yTickLabels: orientation === 'vertical' ? valueTickLabels : categoryLabels,
    xAxis,
    yAxis,
    measureText,
    measurementElement,
    measurementVersion,
    marginLeft: horizontalCategoryLabelLayout?.marginLeft,
  });
  if (sortedCategories.length === 0) {
    return {
      geometry,
      categories: [],
      yTicks: valueTicks,
      categoryTicks: [],
      bars: [],
      tableRows: [],
      targets: [],
      empty: true,
      valueDomain,
      theme: resolvedTheme,
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
      x:
        orientation === 'vertical'
          ? categoryPosition + categoryScale.bandwidth() / 2
          : -HORIZONTAL_CATEGORY_LABEL_GAP,
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
      const color = item.color ?? chartPaletteColor(seriesColorIndex, resolvedTheme.palette);
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
    yTicks: valueTicks,
    categoryTicks,
    bars,
    tableRows,
    targets,
    empty: targets.length === 0,
    valueDomain,
    theme: resolvedTheme,
  };
}

/**
 * Locates the target closest to a (x, y) pointer. Uses binary search on the
 * provided `axis` (defaults to `x`) — targets MUST be sorted ascending on that
 * axis (createCartesianModel and createBarModel guarantee this). Falls back to
 * a linear scan when targets are empty.
 */
