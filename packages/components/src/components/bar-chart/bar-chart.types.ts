import type {
  BarChartDatum,
  BarChartMode,
  BarChartOrientation,
  BarChartSchemaDatum,
  BarChartSchemaSeries,
  BarChartSeries,
  ChartAxisSchemaConfiguration,
  ChartDataTableVisibility,
  ChartLegendPosition,
  ChartSharedProps,
} from '../chart.types.ts';

export type BarChartProps = ChartSharedProps & {
  /** Rows containing the category and value-key fields used by each series. */
  data: BarChartDatum[];
  /** Datum key used for the category axis. Runtime validation requires string, number, or Date values. */
  categoryKey: string;
  /** Series descriptors. Each valueKey must resolve to number, null, or undefined on every datum. */
  series: BarChartSeries[];
  /** Bar orientation. Default `vertical`. */
  orientation?: BarChartOrientation;
  /** Grouped or stacked bar layout. Default `grouped`. */
  mode?: BarChartMode;
};

export type BarChartSchemaProps = {
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
  /** JSON-safe data rows. Schema cannot express dynamic categoryKey/valueKey relationships; runtime validation narrows value-key fields to number, null, or undefined. */
  data: BarChartSchemaDatum[];
  /** Category field name. Runtime validation requires every row to contain a string, number, or Date category. */
  categoryKey: string;
  /** Series value keys. Schema cannot prove every valueKey exists on every row; runtime validation enforces it. */
  series: BarChartSchemaSeries[];
  orientation?: BarChartOrientation;
  mode?: BarChartMode;
};
