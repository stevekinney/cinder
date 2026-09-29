import type { BarChartDatum, BarChartSeries } from '../../components/chart.types.ts';
import { normalizeXValue, type NormalizedXValue } from './chart-model-utilities.ts';
import { normalizeNumericValue, sortXValues } from './chart-scale.ts';

export function normalizeBarData(
  data: BarChartDatum[],
  categoryKey: string,
  series: BarChartSeries[],
  hiddenSeriesIds: string[],
) {
  const categories: NormalizedXValue[] = [];
  const seenCategories = new Set<string>();
  const categoryKinds = new Set<string>();
  const visibleSeries = series.filter((item) => !hiddenSeriesIds.includes(item.id));
  const visibleValues: number[] = [0];
  const datumByKey = new Map<string, BarChartDatum>();

  for (const datum of data) {
    const category = readBarCategory(datum, categoryKey);
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
      const numericValue = readBarValue(datum, item, category.label);
      if (numericValue !== null && !hiddenSeriesIds.includes(item.id)) {
        visibleValues.push(numericValue);
      }
    }
  }

  if (categoryKinds.size > 1) {
    throw new Error(
      `[cinder/bar-chart] rule=mixed-bar-category-kind key="${categoryKey}": category values must share one domain kind.`,
    );
  }
  return { categories: sortXValues(categories), datumByKey, visibleSeries, visibleValues };
}

function readBarCategory(datum: BarChartDatum, categoryKey: string): NormalizedXValue {
  if (!(categoryKey in datum)) {
    throw new Error(
      `[cinder/bar-chart] rule=invalid-bar-category key="${categoryKey}": category key is missing.`,
    );
  }
  const rawCategory = datum[categoryKey];
  if (
    typeof rawCategory === 'string' ||
    typeof rawCategory === 'number' ||
    rawCategory instanceof Date
  ) {
    return normalizeXValue(rawCategory);
  }
  throw new Error(
    `[cinder/bar-chart] rule=invalid-bar-category key="${categoryKey}": category must be string, number, or Date.`,
  );
}

function readBarValue(datum: BarChartDatum, series: BarChartSeries, categoryLabel: string) {
  if (!(series.valueKey in datum)) {
    throw new Error(
      `[cinder/bar-chart] rule=missing-bar-value-key key="${series.valueKey}": value key is missing.`,
    );
  }
  const value = datum[series.valueKey];
  if (typeof value === 'number' || value === null || value === undefined) {
    return normalizeNumericValue('bar-chart', series.id, categoryLabel, value);
  }
  throw new Error(
    `[cinder/bar-chart] rule=invalid-bar-value key="${series.valueKey}" category="${categoryLabel}": value must be number, null, or undefined.`,
  );
}
