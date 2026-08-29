import type { HTMLAttributes } from 'svelte/elements';
export type DonutChartDatum = { label: string; value: number; color?: string };
export type DonutChartProps = Omit<HTMLAttributes<HTMLDivElement>, 'class'> & {
  label: string;
  data: DonutChartDatum[];
  valueLabels?: boolean;
  centerLabel?: string;
  scrollable?: boolean;
  onSeriesClick?: (datum: DonutChartDatum, index: number) => void;
  class?: string;
};
