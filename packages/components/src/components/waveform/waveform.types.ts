import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { ChartDataTableVisibility } from '../chart.types.ts';

export type WaveformRenderMode = 'path' | 'bars';

export type WaveformProps = Omit<HTMLAttributes<HTMLElement>, 'class'> & {
  /** Accessible label for the waveform. Required for screen readers. */
  label: string;
  /** Optional description rendered below the label. */
  description?: string;
  /**
   * Time-domain amplitude samples. Each value should be in the range [-1, 1].
   * Values outside this range are clamped.
   */
  data: number[];
  /** How to render the waveform: as a continuous path or vertical amplitude bars. Default `path`. */
  renderMode?: WaveformRenderMode;
  /** Pixel height of the chart. Default `80`. */
  height?: number;
  /** Whether the waveform is in a loading state. */
  loading?: boolean;
  /** Controls data table visibility. Default `screen-reader-only`. */
  dataTableVisibility?: ChartDataTableVisibility;
  /** Custom data table caption; falls back to `label`. */
  dataTableCaption?: string;
  /** Custom class applied to the root element. */
  class?: string;
  /** Snippet rendered when the chart has no data. */
  empty?: Snippet;
  /** Snippet rendered while loading. */
  loadingContent?: Snippet;
};

export type WaveformSchemaProps = {
  /** Accessible label for the waveform. Required for screen readers. */
  label: string;
  /** Optional description rendered below the label. */
  description?: string;
  /** Time-domain amplitude samples. Each value should be in the range [-1, 1]; values outside this range are clamped. */
  data: number[];
  /** How to render the waveform: as a continuous path or vertical amplitude bars. Default `path`. */
  renderMode?: WaveformRenderMode;
  /** Pixel height of the chart. Default `80`. */
  height?: number;
  /** Whether the waveform is in a loading state. Default `false`. */
  loading?: boolean;
  /** Controls data table visibility. Default `screen-reader-only`. */
  dataTableVisibility?: ChartDataTableVisibility;
  /** Custom data table caption; falls back to `label`. */
  dataTableCaption?: string;
  /** Custom class applied to the root element. */
  class?: string;
};
