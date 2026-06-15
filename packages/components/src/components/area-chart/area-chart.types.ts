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
  /** Series rendered as independent filled areas or stacked areas. */
  series: AreaChartSchemaSeries[];
  /** Area rendering mode. Default `single`. */
  mode?: AreaChartMode;
};
