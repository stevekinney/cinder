import type { HTMLAttributes } from 'svelte/elements';
export type DonutChartDatum = {
  /**
   * Unique within the chart. Keys the rendered arc and value-list row so
   * keyboard focus and activation stay attached to the same logical datum
   * across reorders, insertions, and removals of `data`. Labels are not a
   * substitute—they are editable and need not be unique.
   */
  id: string;
  label: string;
  /** A negative, `NaN`, or infinite value renders as `0`—it is not rejected, and does not round-trip back to the caller. */
  value: number;
  color?: string;
};
export type DonutChartProps = Omit<HTMLAttributes<HTMLDivElement>, 'class'> & {
  /** Names both the chart and its non-visual fallback list. */
  label: string;
  /**
   * Part-to-whole values rendered as the ring and, when `valueLabels` is
   * off, as a screen-reader-only fallback `<ul>` (not a data table). A
   * negative, `NaN`, or infinite `value` renders as `0` rather than being
   * rejected—see `DonutChartDatum.value`.
   */
  data: DonutChartDatum[];
  /**
   * Adds a visible `<ul>` legend with value labels below the ring, in place
   * of the screen-reader-only fallback list. Defaults to `false`.
   * @default false
   */
  valueLabels?: boolean;
  /** Supplemental label rendered at the ring's center. Should not be the only explanation of the total. */
  centerLabel?: string;
  /**
   * Enables a horizontal-scroll escape hatch for narrow containers.
   * Defaults to `false`.
   * @default false
   */
  scrollable?: boolean;
  /** Called when a series is activated. Provide only when the series is actionable. */
  onSeriesClick?: (datum: DonutChartDatum, index: number) => void;
  /** Additional class merged with the component's root class. */
  class?: string;
};
