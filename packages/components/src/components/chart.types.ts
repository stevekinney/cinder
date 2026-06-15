import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

export type ChartXValue = string | number | Date;
export type ChartNumericValue = number | null | undefined;
export type ChartLegendPosition = 'top' | 'bottom' | 'none';
export type ChartDataTableVisibility = 'screen-reader-only' | 'visible' | 'hidden';

export type ChartFormatterContext = {
  seriesId?: string;
  seriesLabel?: string;
  index: number;
};

export type ChartTickFormatter = (
  value: string | number | Date,
  context: ChartFormatterContext,
) => string;

export type ChartValueFormatter = (value: number, context: ChartFormatterContext) => string;

export type ChartAxisConfiguration = {
  label?: string;
  tickCount?: number;
  format?: ChartTickFormatter;
};

export type ChartPoint = {
  x: ChartXValue;
  y: ChartNumericValue;
};

export type ChartCartesianSeries = {
  id: string;
  label: string;
  data: ChartPoint[];
  color?: string;
  valueFormatter?: ChartValueFormatter;
};

export type ChartSharedProps = Omit<HTMLAttributes<HTMLElement>, 'class'> & {
  /** Accessible label for the chart. Required for screen readers. */
  label: string;
  /** Optional description rendered below the label. */
  description?: string;
  /** Pixel height of the chart viewport. Default `280`. */
  height?: number;
  /** Configuration for the x-axis label and tick formatting. */
  xAxis?: ChartAxisConfiguration;
  /** Configuration for the y-axis label and tick formatting. */
  yAxis?: ChartAxisConfiguration;
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
  empty?: Snippet;
  loadingContent?: Snippet;
};

export type BarChartOrientation = 'vertical' | 'horizontal';
export type BarChartMode = 'grouped' | 'stacked';
export type AreaChartMode = 'single' | 'stacked';

export type BarChartDatum = Record<string, string | number | Date | null | undefined>;

export type BarChartSeries = {
  id: string;
  label: string;
  valueKey: string;
  color?: string;
  valueFormatter?: ChartValueFormatter;
};

export type ChartJsonXValue = string | number;
export type ChartJsonValue = string | number | null;

/** @schemaObject */
export type ChartAxisSchemaConfiguration = {
  label?: string;
  tickCount?: number;
};

/** @schemaObject */
export type ChartSchemaPoint = {
  x: ChartJsonXValue;
  y?: number | null;
};

/** @schemaObject */
export type ChartCartesianSchemaSeries = {
  id: string;
  label: string;
  /** @schemaObject */
  data: ChartSchemaPoint[];
  color?: string;
};

export type BarChartSchemaDatum = Record<string, ChartJsonValue>;

/** @schemaObject */
export type BarChartSchemaSeries = {
  id: string;
  label: string;
  valueKey: string;
  color?: string;
};
