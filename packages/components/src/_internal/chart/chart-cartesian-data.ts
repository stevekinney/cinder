import type { ChartCartesianSeries } from '../../components/chart.types.ts';
import type { LayerDecimationSelection } from './chart-decimation-gaps.ts';
import { decimationIndicesForLayers } from './chart-decimation.ts';
import {
  chartPaletteColor,
  normalizeXValue,
  type NormalizedPoint,
  type NormalizedXValue,
} from './chart-model-utilities.ts';
import { normalizeNumericValue, sortXValues } from './chart-scale.ts';

export type NormalizedCartesianSeries = {
  id: string;
  label: string;
  color: string;
  points: NormalizedPoint[];
};

export function normalizeCartesianData(
  componentId: string,
  series: ChartCartesianSeries[],
  palette: string[],
  stackedArea: boolean,
) {
  const allKinds = new Set<string>();
  const xValuesByKey = new Map<string, NormalizedXValue>();

  const normalizedSeries = series.map((item, seriesIndex) => {
    const seenX = new Set<string>();
    const color = item.color ?? chartPaletteColor(seriesIndex, palette);
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

  if (stackedArea) assertNonNegativeStackedPoints(componentId, normalizedSeries);

  const sortedXValues = sortXValues([...xValuesByKey.values()]);
  return { normalizedSeries, sortedXValues };
}

function assertNonNegativeStackedPoints(
  componentId: string,
  normalizedSeries: NormalizedCartesianSeries[],
) {
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

export function cartesianDomainValues(
  componentId: string,
  normalizedSeries: NormalizedCartesianSeries[],
  sortedXValues: NormalizedXValue[],
  hiddenSeriesIds: string[],
  stackedArea: boolean,
): number[] {
  // Hidden series do not compress the visible chart against invisible data.
  const visibleSeries = normalizedSeries.filter((item) => !hiddenSeriesIds.includes(item.id));
  if (stackedArea) return [0, ...stackedTotals(visibleSeries, sortedXValues)];
  const values = visibleSeries.flatMap((item) =>
    item.points.flatMap((point) => (point.y === null ? [] : [point.y])),
  );
  return componentId === 'area-chart' ? [0, ...values] : values;
}

function stackedTotals(
  series: NormalizedCartesianSeries[],
  sortedXValues: NormalizedXValue[],
): number[] {
  const totals = new Map(sortedXValues.map((value) => [value.key, 0]));
  for (const item of series) {
    for (const point of item.points) {
      if (point.y === null) continue;
      totals.set(point.x.key, (totals.get(point.x.key) ?? 0) + point.y);
    }
  }
  return [...totals.values()];
}

export type StackedRenderSelection = {
  domain: NormalizedXValue[];
  layerIndexBySeriesId: Map<string, number>;
  selections: LayerDecimationSelection[];
};

export function createStackedRenderSelection(
  normalizedSeries: NormalizedCartesianSeries[],
  sortedXValues: NormalizedXValue[],
  hiddenSeriesIds: string[],
  stackedArea: boolean,
): StackedRenderSelection | undefined {
  if (!stackedArea) return undefined;
  const pointsBySeriesId = new Map(
    normalizedSeries.map((item) => [
      item.id,
      new Map(item.points.map((point) => [point.x.key, point])),
    ]),
  );
  const visibleSeries = normalizedSeries.filter((item) => !hiddenSeriesIds.includes(item.id));
  const domain = sortedXValues.filter((value) =>
    visibleSeries.some((item) => pointsBySeriesId.get(item.id)?.has(value.key)),
  );
  const cumulativeValuesByKey = new Map(domain.map((value) => [value.key, 0]));
  const boundaryLayers = visibleSeries.map((item) =>
    domain.map((value) => {
      const point = pointsBySeriesId.get(item.id)?.get(value.key);
      if (point?.y === null || point?.y === undefined) return null;
      const cumulativeValue = (cumulativeValuesByKey.get(value.key) ?? 0) + point.y;
      cumulativeValuesByKey.set(value.key, cumulativeValue);
      return cumulativeValue;
    }),
  );
  return {
    domain,
    layerIndexBySeriesId: new Map(visibleSeries.map((item, layerIndex) => [item.id, layerIndex])),
    selections: decimationIndicesForLayers(boundaryLayers),
  };
}
