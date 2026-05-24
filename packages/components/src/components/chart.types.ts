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
  label: string;
  description?: string;
  height?: number;
  xAxis?: ChartAxisConfiguration;
  yAxis?: ChartAxisConfiguration;
  legendPosition?: ChartLegendPosition;
  hiddenSeriesIds?: string[];
  loading?: boolean;
  dataTableCaption?: string;
  dataTableVisibility?: ChartDataTableVisibility;
  maximumInteractivePoints?: number;
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

export type ChartAxisSchemaConfiguration = {
  label?: string;
  tickCount?: number;
};

export type ChartSchemaPoint = {
  x: ChartJsonXValue;
  y?: number | null;
};

export type ChartCartesianSchemaSeries = {
  id: string;
  label: string;
  data: ChartSchemaPoint[];
  color?: string;
};

export type BarChartSchemaDatum = Record<string, ChartJsonValue>;

export type BarChartSchemaSeries = {
  id: string;
  label: string;
  valueKey: string;
  color?: string;
};
