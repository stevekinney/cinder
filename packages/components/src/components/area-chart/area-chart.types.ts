import type {
  AreaChartMode,
  ChartAxisSchemaConfiguration,
  ChartCartesianSchemaSeries,
  ChartCartesianSeries,
  ChartDataTableVisibility,
  ChartLegendPosition,
  ChartSharedProps,
} from '../chart.types.ts';

export type AreaChartProps = ChartSharedProps & {
  /** Series rendered as independent filled areas or stacked areas. */
  series: ChartCartesianSeries[];
  /** Area rendering mode. Default `single`. */
  mode?: AreaChartMode;
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
  series: ChartCartesianSchemaSeries[];
  mode?: AreaChartMode;
};
