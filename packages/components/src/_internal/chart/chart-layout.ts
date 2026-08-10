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
const MAXIMUM_CHART_TEXT_MEASUREMENTS = 1_024;

export type ChartGeometryOptions = {
  xTickLabels?: string[];
  yTickLabels?: string[];
  xAxis?: ChartXAxisConfiguration | undefined;
  yAxis?: ChartAxisConfiguration | undefined;
  marginLeft?: number | undefined;
  /** Enable browser text measurement after mount; defaults to deterministic fallback metrics. */
  measureText?: boolean | undefined;
  /** Mounted chart root whose inherited typography should be used for browser measurement. */
  measurementElement?: Element | undefined;
  /** Invalidates cached measurements after web-font loading changes. */
  measurementVersion?: number | undefined;
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
  const measurementContext = createChartTextMeasurementContext(
    options.measureText ?? false,
    options.measurementElement,
    options.measurementVersion ?? 0,
  );
  const textMeasurements = measureChartTexts(
    [
      ...xTickLabels.map((label) => ({ label, rotation: xTickRotation })),
      ...yTickLabels.map((label) => ({ label, rotation: 0 })),
      ...(options.xAxis?.label ? [{ label: options.xAxis.label, rotation: 0 }] : []),
      ...(options.yAxis?.label ? [{ label: options.yAxis.label, rotation: -90 }] : []),
    ],
    measurementContext,
  );
  const measurementFor = (label: string, rotation: number): ChartTextMeasurement =>
    textMeasurements.get(chartTextMeasurementKey(label, rotation, measurementContext.cacheKey)) ??
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

export function observeChartFontLoading(onFontsChanged: () => void): () => void {
  if (typeof document === 'undefined' || !document.fonts) return () => {};
  let active = true;
  const handleFontsChanged = (): void => {
    if (active) onFontsChanged();
  };
  document.fonts.addEventListener('loadingdone', handleFontsChanged);
  void document.fonts.ready.then(handleFontsChanged);
  return () => {
    active = false;
    document.fonts.removeEventListener('loadingdone', handleFontsChanged);
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
type ChartTextMeasurementContext = {
  cacheKey: string;
  container?: Element;
  textStyle?: string;
};

function maximumMeasurement(labels: string[], select: (label: string) => number): number {
  let maximum = 0;
  for (const label of labels) maximum = Math.max(maximum, select(label));
  return maximum;
}

const chartTextMeasurementCache = new Map<string, ChartTextMeasurement>();

function measureChartTexts(
  entries: Array<{ label: string; rotation: number }>,
  context: ChartTextMeasurementContext,
): Map<string, ChartTextMeasurement> {
  if (!context.container || typeof document === 'undefined') {
    return new Map(
      entries.map(({ label, rotation }) => [
        chartTextMeasurementKey(label, rotation, context.cacheKey),
        fallbackChartTextMeasurement(label, rotation),
      ]),
    );
  }
  const uniqueEntries = [
    ...new Map(
      entries.map((entry) => [
        chartTextMeasurementKey(entry.label, entry.rotation, context.cacheKey),
        entry,
      ]),
    ).values(),
  ];
  const missing = uniqueEntries.filter(
    ({ label, rotation }) =>
      !chartTextMeasurementCache.has(chartTextMeasurementKey(label, rotation, context.cacheKey)),
  );
  if (missing.length > 0) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute(
      'style',
      'position:absolute;visibility:hidden;pointer-events:none;inline-size:0;block-size:0',
    );
    const texts = missing.map((entry) => {
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      if (context.textStyle) text.setAttribute('style', context.textStyle);
      text.textContent = entry.label;
      svg.append(text);
      return { ...entry, text };
    });
    context.container.append(svg);
    for (const { label, rotation, text } of texts) {
      let measurement: ChartTextMeasurement | undefined;
      try {
        const bounds = text.getBBox();
        if (bounds.width > 0 && bounds.height > 0) {
          measurement = { width: bounds.width, height: bounds.height };
        }
      } catch {
        // Keep deterministic fallback metrics when layout is unavailable.
      }
      if (measurement) {
        cacheChartTextMeasurement(
          chartTextMeasurementKey(label, rotation, context.cacheKey),
          rotateChartTextMeasurement(measurement, rotation),
        );
      }
    }
    svg.remove();
  }
  return new Map(
    entries.map(({ label, rotation }) => [
      chartTextMeasurementKey(label, rotation, context.cacheKey),
      chartTextMeasurementCache.get(chartTextMeasurementKey(label, rotation, context.cacheKey)) ??
        fallbackChartTextMeasurement(label, rotation),
    ]),
  );
}

function cacheChartTextMeasurement(key: string, measurement: ChartTextMeasurement): void {
  if (!chartTextMeasurementCache.has(key)) {
    while (chartTextMeasurementCache.size >= MAXIMUM_CHART_TEXT_MEASUREMENTS) {
      const oldestKey = chartTextMeasurementCache.keys().next().value;
      if (oldestKey === undefined) break;
      chartTextMeasurementCache.delete(oldestKey);
    }
  }
  chartTextMeasurementCache.set(key, measurement);
}

function measureChartText(label: string, rotation = 0): ChartTextMeasurement {
  return fallbackChartTextMeasurement(label, rotation);
}

function chartTextMeasurementKey(
  label: string,
  rotation: number,
  measurementContext: string,
): string {
  return `${label}\u0000${rotation}\u0000${measurementContext}`;
}

function createChartTextMeasurementContext(
  allowBrowserMeasurement: boolean,
  measurementElement: Element | undefined,
  measurementVersion: number,
): ChartTextMeasurementContext {
  if (
    !allowBrowserMeasurement ||
    !measurementElement ||
    typeof window === 'undefined' ||
    !measurementElement.isConnected
  ) {
    return { cacheKey: 'fallback' };
  }
  const style = window.getComputedStyle(measurementElement);
  const fontSize = style.getPropertyValue('--cinder-text-xs').trim() || style.fontSize;
  const textStyle = [
    `font-family:${style.fontFamily}`,
    `font-size:${fontSize}`,
    `font-style:${style.fontStyle}`,
    `font-weight:${style.fontWeight}`,
    `font-stretch:${style.fontStretch}`,
    `font-variant:${style.fontVariant}`,
    `font-feature-settings:${style.fontFeatureSettings}`,
    `font-kerning:${style.fontKerning}`,
    `letter-spacing:${style.letterSpacing}`,
    `text-transform:${style.textTransform}`,
  ].join(';');
  return {
    cacheKey: `browser\u0000${measurementVersion}\u0000${textStyle}`,
    container: measurementElement,
    textStyle,
  };
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
