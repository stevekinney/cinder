import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { ChartDataTableVisibility } from '../chart.types.ts';

/**
 * A single time-frame of frequency-bin magnitudes.
 * `label` identifies the time point (e.g. '0 ms', '10 ms').
 * `bins` is an ordered array of frequency-bin magnitudes, one per column.
 *
 * @schemaObject
 */
export type SpectrogramFrame = {
  /** Time-axis label for this frame, e.g. '0 ms' or 't=0'. */
  label: string;
  /**
   * Magnitude values per frequency bin. A consistent length across frames is
   * preferred, but ragged frames are supported: the grid uses the maximum bin
   * count across all frames and renders any missing bins in shorter frames as
   * "missing" cells. Non-finite values (NaN/Infinity) also render as missing.
   */
  bins: number[];
};

export type SpectrogramProps = Omit<HTMLAttributes<HTMLElement>, 'class'> & {
  /** Accessible label for the chart. Required for screen readers. */
  label: string;
  /** Optional description rendered below the label. */
  description?: string;
  /**
   * Ordered sequence of time-indexed frames. Each frame contains a label and an
   * array of per-frequency-bin magnitudes.
   */
  frames: SpectrogramFrame[];
  /**
   * Optional frequency-bin labels for the y-axis (e.g. ['100 Hz', '200 Hz', …]).
   * When omitted, bins are labelled by index.
   */
  frequencyLabels?: string[];
  /** Pixel height of the chart. Default `200`. */
  height?: number;
  /** Whether the chart is in a loading state. */
  loading?: boolean;
  /** Controls data table visibility. Default `screen-reader-only`. */
  dataTableVisibility?: ChartDataTableVisibility;
  /** Custom data table caption; falls back to `label`. */
  dataTableCaption?: string;
  /** Custom class applied to the root element. */
  class?: string;
  /** Snippet rendered when there are no frames. */
  empty?: Snippet;
  /** Snippet rendered while loading. */
  loadingContent?: Snippet;
};

export type SpectrogramSchemaProps = {
  /** Accessible label for the chart. Required for screen readers. */
  label: string;
  /** Optional description rendered below the label. */
  description?: string;
  /** Ordered sequence of time-indexed frames. Each frame contains a label and an array of per-frequency-bin magnitudes. */
  frames: SpectrogramFrame[];
  /** Optional frequency-bin labels for the y-axis (e.g. ['100 Hz', '200 Hz', …]). When omitted, bins are labelled by index. */
  frequencyLabels?: string[];
  /** Pixel height of the chart. Default `200`. */
  height?: number;
  /** Whether the chart is in a loading state. Default `false`. */
  loading?: boolean;
  /** Controls data table visibility. Default `screen-reader-only`. */
  dataTableVisibility?: ChartDataTableVisibility;
  /** Custom data table caption; falls back to `label`. */
  dataTableCaption?: string;
  /** Custom class applied to the root element. */
  class?: string;
};
