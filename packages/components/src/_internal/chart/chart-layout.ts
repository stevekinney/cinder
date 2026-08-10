import type { ChartAxisConfiguration } from '../../components/chart.types.ts';
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
  xAxis?: ChartAxisConfiguration | undefined;
  yAxis?: ChartAxisConfiguration | undefined;
  marginLeft?: number | undefined;
};

export function createChartGeometry(
  width: number,
  height: number,
  options: ChartGeometryOptions = {},
): ChartGeometry {
  const xTickRotation = options.xAxis?.tickLabelRotation ?? 0;
  const xTickHeight = maximumMeasurement(
    options.xTickLabels ?? [],
    (measurement) => measurement.height,
    xTickRotation,
  );
  const yTickWidth = maximumMeasurement(
    options.yTickLabels ?? [],
    (measurement) => measurement.width,
  );
  const xAxisTitleHeight = options.xAxis?.label
    ? measureChartText(options.xAxis.label).height + CHART_AXIS_TITLE_GAP
    : 0;
  const yAxisTitleWidth = options.yAxis?.label
    ? measureChartText(options.yAxis.label, -90).width + CHART_AXIS_TITLE_GAP
    : 0;
  const derivedMarginLeft = CHART_OUTER_PADDING + yTickWidth + CHART_GUIDE_GAP + yAxisTitleWidth;
  const maximumMarginLeft = Math.max(CHART_OUTER_PADDING, Math.floor(width * 0.4));
  const marginLeft = Math.min(
    maximumMarginLeft,
    Math.max(derivedMarginLeft, options.marginLeft ?? 0),
  );
  const marginTop = CHART_OUTER_PADDING;
  const marginRight = CHART_OUTER_PADDING;
  const marginBottom = Math.min(
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

function maximumMeasurement(
  labels: string[],
  select: (measurement: ChartTextMeasurement) => number,
  rotation = 0,
): number {
  let maximum = 0;
  for (const label of labels) {
    maximum = Math.max(maximum, select(measureChartText(label, rotation)));
  }
  return maximum;
}

function measureChartText(label: string, rotation = 0): ChartTextMeasurement {
  const fallback = { width: Array.from(label).length * 7, height: 12 };
  let measurement = fallback;
  if (typeof document !== 'undefined' && document.body) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    svg.setAttribute(
      'style',
      'position:absolute;visibility:hidden;pointer-events:none;inline-size:0;block-size:0',
    );
    text.setAttribute('font-size', '12');
    text.textContent = label;
    svg.append(text);
    document.body.append(svg);
    try {
      const bounds = typeof text.getBBox === 'function' ? text.getBBox() : undefined;
      if (bounds && bounds.width > 0 && bounds.height > 0) {
        measurement = { width: bounds.width, height: bounds.height };
      }
    } catch {
      // Non-layout DOM implementations use the deterministic fallback above.
    } finally {
      svg.remove();
    }
  }

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
