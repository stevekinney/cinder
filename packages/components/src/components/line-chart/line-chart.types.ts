import type {
  ChartAxisSchemaConfiguration,
  ChartCartesianSchemaSeries,
  ChartCartesianSeries,
  ChartDataTableVisibility,
  ChartLegendPosition,
  ChartSharedProps,
} from '../chart.types.ts';

export type LineChartProps = ChartSharedProps & {
  /** Series to render as one or more connected line paths. */
  series: ChartCartesianSeries[];
};

export type LineChartSchemaProps = {
  label: string;
  description?: string;
  height?: number;
  xAxis?: ChartAxisSchemaConfiguration;
  yAxis?: ChartAxisSchemaConfiguration;
  legendPosition?: ChartLegendPosition;
  hiddenSeriesIds?: string[];
  loading?: boolean;
  dataTableCaption?: string;
  dataTableVisibility?: ChartDataTableVisibility;
  maximumInteractivePoints?: number;
  class?: string;
  series: ChartCartesianSchemaSeries[];
};
