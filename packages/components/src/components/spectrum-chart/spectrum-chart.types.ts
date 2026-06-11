import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { ChartDataTableVisibility } from '../chart.types.ts';

/** @schemaObject */
export type SpectrumBin = {
  /** Frequency label, e.g. '440 Hz' or '1 kHz'. */
  label: string;
  /** Magnitude or power for this bin. Non-negative. */
  value: number;
};

export type SpectrumChartProps = Omit<HTMLAttributes<HTMLElement>, 'class'> & {
  /** Accessible label for the chart. Required for screen readers. */
  label: string;
  /** Optional description rendered below the label. */
  description?: string;
  /** Frequency bins with label + magnitude value. */
  bins: SpectrumBin[];
  /** Pixel height of the chart. Default `160`. */
  height?: number;
  /** Whether the chart is in a loading state. */
  loading?: boolean;
  /** Controls data table visibility. Default `screen-reader-only`. */
  dataTableVisibility?: ChartDataTableVisibility;
  /** Custom data table caption; falls back to `label`. */
  dataTableCaption?: string;
  /** Custom class applied to the root element. */
  class?: string;
  /** Snippet rendered when there are no bins. */
  empty?: Snippet;
  /** Snippet rendered while loading. */
  loadingContent?: Snippet;
};

export type SpectrumChartSchemaProps = {
  label: string;
  description?: string;
  bins: SpectrumBin[];
  height?: number;
  loading?: boolean;
  dataTableVisibility?: ChartDataTableVisibility;
  dataTableCaption?: string;
  class?: string;
};
