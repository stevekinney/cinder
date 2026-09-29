import type {
  BarChartDatum,
  BarChartSeries,
  ChartNumericValue,
} from '../../components/chart.types.ts';
import type { NormalizedXValue } from './chart-model-utilities.ts';

export function normalizeNumericValue(
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

export function sortXValues(values: NormalizedXValue[]): NormalizedXValue[] {
  if (values[0]?.kind === 'string') return values;
  const sortedValues = [...values];
  sortedValues.sort((a, b) => Number(a.comparable) - Number(b.comparable));
  return sortedValues;
}

export function createPaddedDomain(values: number[]): [number, number] {
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

export type LinearScale = ((value: number) => number) & {
  ticks: (count: number) => number[];
};

export type BandlikeScale = ((value: string) => number | undefined) & {
  bandwidth?: () => number;
};

export type BandScale = ((value: string) => number | undefined) & {
  bandwidth: () => number;
};

export function createLinearScale(domain: [number, number], range: [number, number]): LinearScale {
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

export function createPointScale(
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

export function createBandScale(
  domain: string[],
  range: [number, number],
  padding: number,
): BandScale {
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

export function createNumericDomain(values: NormalizedXValue[]): [number, number] {
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

export function createTicks(domain: [number, number], count: number): number[] {
  const safeCount = Math.max(1, Math.floor(count));
  if (safeCount === 1) return [domain[0]];
  const step = (domain[1] - domain[0]) / (safeCount - 1);
  return Array.from({ length: safeCount }, (_, index) => domain[0] + step * index);
}

export function createStackedBarDomainValues(
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
