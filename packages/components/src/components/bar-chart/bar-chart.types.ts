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
  /** Accessible label for the chart. Required for screen readers. */
  label: string;
  /** Optional description rendered below the label. */
  description?: string;
  /** Pixel height of the chart viewport. Default `280`. */
  height?: number;
  /** Configuration for the x-axis label and tick count. */
  xAxis?: ChartAxisSchemaConfiguration;
  /** Configuration for the y-axis label and tick count. */
  yAxis?: ChartAxisSchemaConfiguration;
  /** Where to render the series legend relative to the chart. Default `top`. */
  legendPosition?: ChartLegendPosition;
  /** IDs of series currently hidden from the chart. Can be two-way bound with `bind:hiddenSeriesIds`. */
  hiddenSeriesIds?: string[];
  /** Whether the chart is in a loading state. Default `false`. */
  loading?: boolean;
  /** Custom data table caption; falls back to `label`. */
  dataTableCaption?: string;
  /** Controls data table visibility. Default `screen-reader-only`. */
  dataTableVisibility?: ChartDataTableVisibility;
  /** Maximum number of interactive focus targets before keyboard navigation is disabled. Default `500`. */
  maximumInteractivePoints?: number;
  /** Custom class applied to the root element. */
  class?: string;
  /** JSON-safe data rows. Schema cannot express dynamic categoryKey/valueKey relationships; runtime validation narrows value-key fields to number, null, or undefined. */
  data: BarChartSchemaDatum[];
  /** Category field name. Runtime validation requires every row to contain a string, number, or Date category. */
  categoryKey: string;
  /** Series value keys. Schema cannot prove every valueKey exists on every row; runtime validation enforces it. */
  series: BarChartSchemaSeries[];
  /** Bar orientation. Default `vertical`. */
  orientation?: BarChartOrientation;
  /** Grouped or stacked bar layout. Default `grouped`. */
  mode?: BarChartMode;
};
