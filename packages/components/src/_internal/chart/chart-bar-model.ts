import type {
  BarChartDatum,
  BarChartMode,
  BarChartOrientation,
  BarChartSeries,
  ChartAxisConfiguration,
  ChartTheme,
  ChartXAxisConfiguration,
} from '../../components/chart.types.ts';
import { normalizeBarData } from './chart-bar-data.ts';
import { renderBarSeries } from './chart-bar-series.ts';
import { createChartGeometry, createHorizontalCategoryLabelLayout } from './chart-layout.ts';
import {
  assertUniqueSeriesIds,
  assertValidChartNumber,
  assertValidTickCount,
  formatNumericValue,
  formatXValue,
  resolveChartTheme,
  type BarChartModel,
} from './chart-model-utilities.ts';
import { createPaddedDomain, createStackedBarDomainValues, createTicks } from './chart-scale.ts';

type BarModelOptions = {
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
};

export function createBarModel(options: BarModelOptions): BarChartModel {
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
  const normalized = normalizeBarData(data, categoryKey, series, hiddenSeriesIds);
  const categoryAxis = orientation === 'vertical' ? xAxis : yAxis;
  const valueAxis = orientation === 'vertical' ? yAxis : xAxis;
  const axes = createBarAxes(
    {
      width,
      height,
      orientation,
      mode,
      xAxis,
      yAxis,
      categoryAxis,
      valueAxis,
      measureText,
      measurementElement,
      measurementVersion,
    },
    normalized,
  );
  const { geometry, valueTicks, valueDomain, categoryLabels, horizontalCategoryLabels } = axes;
  if (normalized.categories.length === 0) {
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
  const { categoryTicks, bars, targets, tableRows } = renderBarSeries({
    ...normalized,
    series,
    palette: resolvedTheme.palette,
    categoryAxis,
    valueAxis,
    orientation,
    mode,
    geometry,
    valueDomain,
    categoryLabels,
    horizontalCategoryLabels,
  });
  return {
    geometry,
    categories: normalized.categories,
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

type BarAxisOptions = {
  width: number;
  height: number;
  orientation: BarChartOrientation;
  mode: BarChartMode;
  xAxis: ChartXAxisConfiguration | undefined;
  yAxis: ChartAxisConfiguration | undefined;
  categoryAxis: ChartAxisConfiguration | undefined;
  valueAxis: ChartAxisConfiguration | undefined;
  measureText: boolean;
  measurementElement: Element | undefined;
  measurementVersion: number;
};

function createBarAxes(options: BarAxisOptions, normalized: ReturnType<typeof normalizeBarData>) {
  const {
    width,
    height,
    orientation,
    mode,
    xAxis,
    yAxis,
    categoryAxis,
    valueAxis,
    measureText,
    measurementElement,
    measurementVersion,
  } = options;
  const { categories, datumByKey, visibleSeries, visibleValues } = normalized;
  const categoryLabels = categories.map((category, index) =>
    formatXValue(category, categoryAxis, { index }),
  );
  const horizontalCategoryLabelLayout =
    orientation === 'horizontal'
      ? createHorizontalCategoryLabelLayout(categoryLabels, width, {
          measureText,
          measurementElement,
          measurementVersion,
        })
      : undefined;
  // Only visible series contribute to the value domain.
  const valueDomain = createPaddedDomain(
    mode === 'stacked'
      ? createStackedBarDomainValues(datumByKey, categories, visibleSeries)
      : visibleValues,
  );
  const valueTicks = createTicks(valueDomain, valueAxis?.tickCount ?? 5);
  const valueTickLabels = valueTicks.map((tick, index) =>
    formatNumericValue(tick, valueAxis, undefined, { index }),
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
  return {
    geometry,
    valueTicks,
    valueDomain,
    categoryLabels,
    horizontalCategoryLabels: horizontalCategoryLabelLayout?.labels,
  };
}
