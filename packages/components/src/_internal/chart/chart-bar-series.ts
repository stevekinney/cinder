import type {
  BarChartDatum,
  BarChartMode,
  BarChartOrientation,
  BarChartSeries,
  ChartAxisConfiguration,
} from '../../components/chart.types.ts';
import { HORIZONTAL_CATEGORY_LABEL_GAP } from './chart-layout.ts';
import {
  chartPaletteColor,
  formatNumericValue,
  formatXValue,
  type BarChartModel,
  type ChartGeometry,
  type ChartTarget,
  type NormalizedXValue,
} from './chart-model-utilities.ts';
import {
  createBandScale,
  createLinearScale,
  type BandScale,
  type LinearScale,
} from './chart-scale.ts';

type BarRenderingOptions = {
  categories: NormalizedXValue[];
  datumByKey: Map<string, BarChartDatum>;
  series: BarChartSeries[];
  visibleSeries: BarChartSeries[];
  palette: string[];
  categoryAxis: ChartAxisConfiguration | undefined;
  valueAxis: ChartAxisConfiguration | undefined;
  orientation: BarChartOrientation;
  mode: BarChartMode;
  geometry: ChartGeometry;
  valueDomain: [number, number];
  categoryLabels: string[];
  horizontalCategoryLabels: string[] | undefined;
};

type BarScales = { value: LinearScale; category: BandScale; group: BandScale };

export function renderBarSeries(options: BarRenderingOptions) {
  const scales = createBarScales(options);
  const categoryTicks = createCategoryTicks(options, scales.category);
  const bars: BarChartModel['bars'] = [];
  const targets: ChartTarget[] = [];
  const tableRows: BarChartModel['tableRows'] = [];
  const { categories, datumByKey, visibleSeries, orientation, categoryAxis } = options;
  for (const [categoryIndex, category] of categories.entries()) {
    const datum = datumByKey.get(category.key);
    if (!datum) continue;
    const offsets = { positive: 0, negative: 0 };
    const rowValues: BarChartModel['tableRows'][number]['values'] = [];
    visibleSeries.forEach((item) => {
      const value = datum[item.valueKey];
      if (typeof value !== 'number') return;
      const bar = createBar(item, value, category, categoryIndex, offsets, options, scales);
      rowValues.push({ seriesId: item.id, seriesLabel: item.label, valueLabel: bar.valueLabel });
      bars.push(bar);
      targets.push({
        ...bar,
        x: bar.x + bar.width / 2,
        y: bar.y + bar.height / 2,
        xLabel: bar.categoryLabel,
      });
    });
    if (rowValues.length > 0) {
      tableRows.push({
        categoryKey: category.key,
        categoryLabel: formatXValue(category, categoryAxis, { index: tableRows.length }),
        values: rowValues,
      });
    }
  }
  targets.sort((a, b) => (orientation === 'vertical' ? a.x - b.x : a.y - b.y));
  return { categoryTicks, bars, targets, tableRows };
}

function createBarScales(options: BarRenderingOptions): BarScales {
  const { valueDomain, categories, visibleSeries, orientation, geometry } = options;
  const value = createLinearScale(
    valueDomain,
    orientation === 'vertical' ? [geometry.plotHeight, 0] : [0, geometry.plotWidth],
  );
  const category = createBandScale(
    categories.map((item) => item.key),
    orientation === 'vertical' ? [0, geometry.plotWidth] : [0, geometry.plotHeight],
    0.18,
  );
  const group = createBandScale(
    visibleSeries.map((item) => item.id),
    [0, category.bandwidth()],
    0.12,
  );
  return { value, category, group };
}

function createCategoryTicks(options: BarRenderingOptions, scale: BandScale) {
  const { categories, categoryLabels, horizontalCategoryLabels, orientation, geometry } = options;
  return categories.map((category, index) => {
    const categoryPosition = scale(category.key) ?? 0;
    return {
      categoryKey: category.key,
      label: horizontalCategoryLabels?.[index] ?? categoryLabels[index] ?? category.label,
      fullLabel: categoryLabels[index] ?? category.label,
      x:
        orientation === 'vertical'
          ? categoryPosition + scale.bandwidth() / 2
          : -HORIZONTAL_CATEGORY_LABEL_GAP,
      y:
        orientation === 'vertical'
          ? geometry.plotHeight + 20
          : categoryPosition + scale.bandwidth() / 2,
    };
  });
}

function createBar(
  item: BarChartSeries,
  value: number,
  category: NormalizedXValue,
  categoryIndex: number,
  offsets: { positive: number; negative: number },
  options: BarRenderingOptions,
  scales: BarScales,
): BarChartModel['bars'][number] {
  const seriesColorIndex = Math.max(
    0,
    options.series.findIndex((entry) => entry.id === item.id),
  );
  const color = item.color ?? chartPaletteColor(seriesColorIndex, options.palette);
  const categoryPosition = scales.category(category.key) ?? 0;
  const groupOffset = options.mode === 'grouped' ? (scales.group(item.id) ?? 0) : 0;
  const offsetKey = value >= 0 ? 'positive' : 'negative';
  const start = options.mode === 'stacked' ? offsets[offsetKey] : 0;
  const end = start + value;
  if (options.mode === 'stacked') offsets[offsetKey] = end;
  const lower = scales.value(start);
  const upper = scales.value(end);
  const thickness =
    options.mode === 'grouped' ? scales.group.bandwidth() : scales.category.bandwidth();
  const bounds =
    options.orientation === 'vertical'
      ? {
          x: categoryPosition + groupOffset,
          y: Math.min(lower, upper),
          width: thickness,
          height: Math.abs(upper - lower),
        }
      : {
          x: Math.min(lower, upper),
          y: categoryPosition + groupOffset,
          width: Math.abs(upper - lower),
          height: thickness,
        };
  const valueLabel = formatNumericValue(value, options.valueAxis, item.valueFormatter, {
    seriesId: item.id,
    seriesLabel: item.label,
    index: categoryIndex,
  });
  const categoryLabel = formatXValue(category, options.categoryAxis, {
    seriesId: item.id,
    seriesLabel: item.label,
    index: categoryIndex,
  });
  return {
    id: `${item.id}-${category.key}`,
    seriesId: item.id,
    seriesLabel: item.label,
    categoryLabel,
    valueLabel,
    ...bounds,
    color,
    hidden: false,
  };
}
