import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { ChartDataTableVisibility } from '../chart.types.ts';

export type MatrixColorScale = 'sequential' | 'diverging';

export type MatrixChartDatum = Record<string, string | number | null | undefined>;

export type MatrixChartProps = Omit<HTMLAttributes<HTMLElement>, 'class'> & {
  /** Accessible label for the chart. Required for screen readers. */
  label: string;
  /** Optional description rendered below the label. */
  description?: string;
  /** Rows of data. Each row must contain xField, yField, and valueField. */
  data: MatrixChartDatum[];
  /** Key on each datum used for the x-axis (columns). */
  xField: string;
  /** Key on each datum used for the y-axis (rows). */
  yField: string;
  /** Key on each datum used for the numeric cell value. */
  valueField: string;
  /** Color interpolation scale. Default `sequential`. */
  colorScale?: MatrixColorScale;
  /** Show cell value labels. Default `true`. */
  showCellLabels?: boolean;
  /** Pixel height of the chart viewport. Default `280`. */
  height?: number;
  /** Whether the chart is in a loading state. */
  loading?: boolean;
  /** Custom data table caption; falls back to `label`. */
  dataTableCaption?: string;
  /** Controls data table visibility. Default `screen-reader-only`. */
  dataTableVisibility?: ChartDataTableVisibility;
  /** Custom class applied to the root element. */
  class?: string;
  /** Snippet rendered when the chart has no data. */
  empty?: Snippet;
  /** Snippet rendered while the chart is loading. */
  loadingContent?: Snippet;
};

export type MatrixChartSchemaProps = {
  label: string;
  description?: string;
  data: Record<string, string | number | null>[];
  xField: string;
  yField: string;
  valueField: string;
  colorScale?: MatrixColorScale;
  showCellLabels?: boolean;
  height?: number;
  loading?: boolean;
  dataTableCaption?: string;
  dataTableVisibility?: ChartDataTableVisibility;
  class?: string;
};
