import type {
  AreaChartMode,
  ChartAxisSchemaConfiguration,
  ChartCartesianSeries,
  ChartDataTableVisibility,
  ChartJsonXValue,
  ChartLegendPosition,
  ChartSharedProps,
} from '../chart.types.ts';

export type AreaChartProps = ChartSharedProps & {
  /** Series rendered as independent filled areas or stacked areas. */
  series: ChartCartesianSeries[];
  /** Area rendering mode. Default `single`. */
  mode?: AreaChartMode;
};

/** @schemaObject */
export type AreaChartSchemaPoint = {
  x: ChartJsonXValue;
  y?: number | null;
};

/** @schemaObject */
export type AreaChartSchemaSeries = {
  id: string;
  label: string;
  data: AreaChartSchemaPoint[];
  color?: string;
};

export type AreaChartSchemaProps = {
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
  series: AreaChartSchemaSeries[];
  mode?: AreaChartMode;
};
