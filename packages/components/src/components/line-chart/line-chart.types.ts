import type {
  ChartAxisSchemaConfiguration,
  ChartCartesianSeries,
  ChartDataTableVisibility,
  ChartJsonXValue,
  ChartLegendPosition,
  ChartSharedProps,
} from '../chart.types.ts';

export type LineChartProps = ChartSharedProps & {
  /** Series to render as one or more connected line paths. */
  series: ChartCartesianSeries[];
};

/** @schemaObject */
export type LineChartSchemaPoint = {
  x: ChartJsonXValue;
  y?: number | null;
};

/** @schemaObject */
export type LineChartSchemaSeries = {
  id: string;
  label: string;
  data: LineChartSchemaPoint[];
  color?: string;
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
  series: LineChartSchemaSeries[];
};
