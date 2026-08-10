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

export type ChartXAxisConfiguration = ChartAxisConfiguration & {
  /** Tick-label rotation in degrees. Default `0`. */
  tickLabelRotation?: number;
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

export type ChartTheme = {
  foreground?: string;
  muted?: string;
  grid?: string;
  background?: string;
  palette?: string[];
};

export type ResolvedChartTheme = {
  foreground: string;
  muted: string;
  grid: string;
  background: string;
  palette: string[];
};

export type NormalizedXValue = {
  raw: ChartXValue;
  key: string;
  label: string;
  comparable: string | number;
  kind: 'string' | 'number' | 'date';
};

export type PlacedPoint = {
  seriesId: string;
  seriesLabel: string;
  color: string;
  x: NormalizedXValue;
  y: number | null;
  originalY: ChartNumericValue;
  index: number;
  pixelX: number;
  pixelY: number;
  /** Pixel-space baseline for filled marks. In stacked areas, this is the lower stack coordinate. */
  pixelY0: number;
};

export type ChartGeometry = {
  plotWidth: number;
  plotHeight: number;
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
};

export type ChartTarget = {
  id: string;
  seriesId: string;
  seriesLabel: string;
  xLabel: string;
  valueLabel: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  color: string;
};

export type BarChartPlacedBar = {
  id: string;
  seriesId: string;
  seriesLabel: string;
  categoryLabel: string;
  valueLabel: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  hidden: boolean;
};

export type ChartMarkContext<TSeries = ChartCartesianSeries, TPoint = PlacedPoint> = {
  series: TSeries;
  points: TPoint[];
  geometry: ChartGeometry;
};

export type ChartSharedProps<TSeries = ChartCartesianSeries, TPoint = PlacedPoint> = Omit<
  HTMLAttributes<HTMLElement>,
  'class'
> & {
  /** Accessible label for the chart. Required for screen readers. */
  label: string;
  /** Optional description rendered below the label. */
  description?: string;
  /** Pixel height of the chart viewport. Default `280`. */
  height?: number;
  /** Configuration for the x-axis label and tick formatting. */
  xAxis?: ChartXAxisConfiguration;
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
  /** Partial visual theme override. Omitted fields inherit the surrounding application. */
  theme?: ChartTheme;
  /** Opt-in visual tooltip. Pass a snippet to replace the default visual content. */
  tooltip?: boolean | Snippet<[ChartTarget]>;
  /** Per-series renderer override. The chart retains scales, guides, focus, and data-table semantics. */
  mark?: Snippet<[ChartMarkContext<TSeries, TPoint>]>;
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
export type ChartXAxisSchemaConfiguration = {
  label?: string;
  tickCount?: number;
  tickLabelRotation?: number;
};

/** @schemaObject */
export type ChartThemeSchema = {
  foreground?: string;
  muted?: string;
  grid?: string;
  background?: string;
  palette?: string[];
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
