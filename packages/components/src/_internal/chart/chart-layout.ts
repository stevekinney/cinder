import type {
  ChartAxisConfiguration,
  ChartXAxisConfiguration,
} from '../../components/chart.types.ts';
import type { ChartGeometry } from './chart-model-utilities.ts';
const CHART_OUTER_PADDING = 16;
const CHART_GUIDE_GAP = 8;
const CHART_AXIS_TITLE_GAP = 12;
export const HORIZONTAL_CATEGORY_LABEL_GAP = 8;
const HORIZONTAL_CATEGORY_LABEL_OUTER_PADDING = 8;
const MAXIMUM_HORIZONTAL_CATEGORY_LABEL_FRACTION = 0.4;

export type ChartGeometryOptions = {
  xTickLabels?: string[];
  yTickLabels?: string[];
  xAxis?: ChartXAxisConfiguration | undefined;
  yAxis?: ChartAxisConfiguration | undefined;
  marginLeft?: number | undefined;
  /** Enable browser text measurement after mount; defaults to deterministic fallback metrics. */
  measureText?: boolean | undefined;
  xTickPosition?: 'top' | 'bottom';
};

export function createChartGeometry(
  width: number,
  height: number,
  options: ChartGeometryOptions = {},
): ChartGeometry {
  const xTickRotation = options.xAxis?.tickLabelRotation ?? 0;
  if (!Number.isFinite(xTickRotation)) {
    throw new Error(
      `[cinder/chart] rule=invalid-tick-label-rotation tickLabelRotation="${xTickRotation}": expected a finite number.`,
    );
  }
  const xTickLabels = options.xTickLabels ?? [];
  const yTickLabels = options.yTickLabels ?? [];
  const textMeasurements = measureChartTexts(
    [
      ...xTickLabels.map((label) => ({ label, rotation: xTickRotation })),
      ...yTickLabels.map((label) => ({ label, rotation: 0 })),
      ...(options.xAxis?.label ? [{ label: options.xAxis.label, rotation: 0 }] : []),
      ...(options.yAxis?.label ? [{ label: options.yAxis.label, rotation: -90 }] : []),
    ],
    options.measureText ?? false,
  );
  const measurementFor = (label: string, rotation: number): ChartTextMeasurement =>
    textMeasurements.get(chartTextMeasurementKey(label, rotation, options.measureText ?? false)) ??
    fallbackChartTextMeasurement(label, rotation);
  const xTickHeight = maximumMeasurement(
    xTickLabels,
    (label) => measurementFor(label, xTickRotation).height,
  );
  const xTickWidth = maximumMeasurement(
    xTickLabels,
    (label) => measurementFor(label, xTickRotation).width,
  );
  const yTickWidth = maximumMeasurement(yTickLabels, (label) => measurementFor(label, 0).width);
  const xAxisTitleHeight = options.xAxis?.label
    ? measurementFor(options.xAxis.label, 0).height + CHART_AXIS_TITLE_GAP
    : 0;
  const yAxisTitleWidth = options.yAxis?.label
    ? measurementFor(options.yAxis.label, -90).width + CHART_AXIS_TITLE_GAP
    : 0;
  const derivedMarginLeft = CHART_OUTER_PADDING + yTickWidth + CHART_GUIDE_GAP + yAxisTitleWidth;
  const maximumMarginLeft = Math.max(CHART_OUTER_PADDING, Math.floor(width * 0.4));
  const endpointSideMargin =
    xTickRotation === 0 ? CHART_OUTER_PADDING : Math.ceil(xTickWidth / 2) + CHART_GUIDE_GAP;
  const marginLeft = Math.min(
    maximumMarginLeft,
    Math.max(derivedMarginLeft, options.marginLeft ?? 0, endpointSideMargin),
  );
  const marginTop =
    options.xTickPosition === 'top'
      ? Math.min(
          Math.max(CHART_OUTER_PADDING, Math.floor(height * 0.45)),
          CHART_OUTER_PADDING + xTickHeight + CHART_GUIDE_GAP + xAxisTitleHeight,
        )
      : CHART_OUTER_PADDING;
  const marginRight = endpointSideMargin;
  const marginBottom =
    options.xTickPosition === 'top'
      ? CHART_OUTER_PADDING
      : Math.min(
          Math.max(CHART_OUTER_PADDING, Math.floor(height * 0.45)),
          CHART_OUTER_PADDING + xTickHeight + CHART_GUIDE_GAP + xAxisTitleHeight,
        );
  return {
    plotWidth: Math.max(1, width - marginLeft - marginRight),
    plotHeight: Math.max(1, height - marginTop - marginBottom),
    marginTop,
    marginRight,
    marginBottom,
    marginLeft,
  };
}

export function createHorizontalCategoryLabelLayout(
  labels: string[],
  chartWidth: number,
): { labels: string[]; marginLeft: number } {
  const maximumMarginLeft = Math.max(
    CHART_OUTER_PADDING,
    Math.floor(chartWidth * MAXIMUM_HORIZONTAL_CATEGORY_LABEL_FRACTION),
  );
  let longestLabelWidth = 0;
  for (const label of labels) {
    longestLabelWidth = Math.max(longestLabelWidth, measureChartText(label).width);
  }
  const requestedMarginLeft =
    longestLabelWidth + HORIZONTAL_CATEGORY_LABEL_GAP + HORIZONTAL_CATEGORY_LABEL_OUTER_PADDING;
  const marginLeft = Math.min(
    maximumMarginLeft,
    Math.max(CHART_OUTER_PADDING, requestedMarginLeft),
  );
  const availableLabelWidth = Math.max(
    0,
    marginLeft - HORIZONTAL_CATEGORY_LABEL_GAP - HORIZONTAL_CATEGORY_LABEL_OUTER_PADDING,
  );

  return {
    marginLeft,
    labels: labels.map((label) => truncateHorizontalCategoryLabel(label, availableLabelWidth)),
  };
}

function truncateHorizontalCategoryLabel(label: string, availableWidth: number): string {
  if (measureChartText(label).width <= availableWidth) return label;

  const characters = Array.from(label);
  while (characters.length > 0) {
    const truncated = `${characters.join('')}…`;
    if (measureChartText(truncated).width <= availableWidth) return truncated;
    characters.pop();
  }
  return availableWidth >= measureChartText('…').width ? '…' : '';
}

type ChartTextMeasurement = { width: number; height: number };

function maximumMeasurement(labels: string[], select: (label: string) => number): number {
  let maximum = 0;
  for (const label of labels) maximum = Math.max(maximum, select(label));
  return maximum;
}

const chartTextMeasurementCache = new Map<string, ChartTextMeasurement>();

function measureChartTexts(
  entries: Array<{ label: string; rotation: number }>,
  allowBrowserMeasurement: boolean,
): Map<string, ChartTextMeasurement> {
  if (!allowBrowserMeasurement || typeof document === 'undefined' || !document.body) {
    return new Map(
      entries.map(({ label, rotation }) => [
        chartTextMeasurementKey(label, rotation, false),
        fallbackChartTextMeasurement(label, rotation),
      ]),
    );
  }
  const uniqueEntries = [
    ...new Map(
      entries.map((entry) => [chartTextMeasurementKey(entry.label, entry.rotation, true), entry]),
    ).values(),
  ];
  const missing = uniqueEntries.filter(
    ({ label, rotation }) =>
      !chartTextMeasurementCache.has(chartTextMeasurementKey(label, rotation, true)),
  );
  if (missing.length > 0) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute(
      'style',
      'position:absolute;visibility:hidden;pointer-events:none;inline-size:0;block-size:0',
    );
    const texts = missing.map((entry) => {
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('font-size', '12');
      text.textContent = entry.label;
      svg.append(text);
      return { ...entry, text };
    });
    document.body.append(svg);
    for (const { label, rotation, text } of texts) {
      let measurement = { width: Array.from(label).length * 7, height: 12 };
      try {
        const bounds = text.getBBox();
        if (bounds.width > 0 && bounds.height > 0)
          measurement = { width: bounds.width, height: bounds.height };
      } catch {
        // Keep deterministic fallback metrics when layout is unavailable.
      }
      chartTextMeasurementCache.set(
        chartTextMeasurementKey(label, rotation, true),
        rotateChartTextMeasurement(measurement, rotation),
      );
    }
    svg.remove();
  }
  return new Map(
    entries.map(({ label, rotation }) => [
      chartTextMeasurementKey(label, rotation, true),
      chartTextMeasurementCache.get(chartTextMeasurementKey(label, rotation, true)) ??
        fallbackChartTextMeasurement(label, rotation),
    ]),
  );
}

function measureChartText(label: string, rotation = 0): ChartTextMeasurement {
  return fallbackChartTextMeasurement(label, rotation);
}

function chartTextMeasurementKey(
  label: string,
  rotation: number,
  browserMeasurement: boolean,
): string {
  return `${label}\u0000${rotation}\u0000${browserMeasurement ? 'browser' : 'fallback'}`;
}

function fallbackChartTextMeasurement(label: string, rotation: number): ChartTextMeasurement {
  return rotateChartTextMeasurement({ width: Array.from(label).length * 7, height: 12 }, rotation);
}

function rotateChartTextMeasurement(
  measurement: ChartTextMeasurement,
  rotation: number,
): ChartTextMeasurement {
  if (rotation === 0) return measurement;
  const radians = (Math.abs(rotation) * Math.PI) / 180;
  return {
    width:
      Math.abs(measurement.width * Math.cos(radians)) +
      Math.abs(measurement.height * Math.sin(radians)),
    height:
      Math.abs(measurement.width * Math.sin(radians)) +
      Math.abs(measurement.height * Math.cos(radians)),
  };
}
