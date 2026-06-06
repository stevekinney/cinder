import type { ChartTarget } from './chart-utilities.ts';

export const DEFAULT_CHART_FOCUS_RING_STROKE_PADDING = 8;

const DEFAULT_POINT_FOCUS_RING_RADIUS = 10;
const MINIMUM_FOCUS_RING_SIZE = 2;
const MINIMUM_BAR_FOCUS_RING_SIZE = 12;
const FOCUS_RING_DOT_RADIUS = 2.5;

export type ChartFocusRingConnectorGeometry = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type ChartFocusRingDotGeometry = {
  cx: number;
  cy: number;
  radius: number;
};

export type ChartPointFocusRingGeometry =
  | {
      kind: 'point';
      cx: number;
      cy: number;
      radius: number;
      targetX: number;
      targetY: number;
      offsetX: number;
      offsetY: number;
      offsetDistance: number;
      connector?: ChartFocusRingConnectorGeometry;
      dot?: ChartFocusRingDotGeometry;
    }
  | ChartPlotFrameFocusRingGeometry;

export type ChartBarFocusRingGeometry =
  | {
      kind: 'bar';
      x: number;
      y: number;
      width: number;
      height: number;
      radius: number;
    }
  | ChartPlotFrameFocusRingGeometry;

export type ChartPlotFrameFocusRingGeometry = {
  kind: 'plot-frame';
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
};

export function createPointFocusRingGeometry(options: {
  target: Pick<ChartTarget, 'x' | 'y'>;
  plotWidth: number;
  plotHeight: number;
  strokePadding?: number;
  radius?: number;
}): ChartPointFocusRingGeometry | null {
  const {
    target,
    plotWidth,
    plotHeight,
    strokePadding = DEFAULT_CHART_FOCUS_RING_STROKE_PADDING,
    radius = DEFAULT_POINT_FOCUS_RING_RADIUS,
  } = options;

  if (plotWidth <= 0 || plotHeight <= 0) return null;

  const drawableWidth = plotWidth - strokePadding * 2;
  const drawableHeight = plotHeight - strokePadding * 2;
  const largestDrawableRadius = Math.min(drawableWidth, drawableHeight) / 2;

  if (
    largestDrawableRadius < MINIMUM_FOCUS_RING_SIZE ||
    drawableWidth < FOCUS_RING_DOT_RADIUS * 2 ||
    drawableHeight < FOCUS_RING_DOT_RADIUS * 2
  ) {
    return createPlotFrameFocusRingGeometry(plotWidth, plotHeight, strokePadding);
  }

  const resolvedRadius = Math.min(Math.max(radius, MINIMUM_FOCUS_RING_SIZE), largestDrawableRadius);
  const minimumCenterX = strokePadding + resolvedRadius;
  const maximumCenterX = plotWidth - strokePadding - resolvedRadius;
  const minimumCenterY = strokePadding + resolvedRadius;
  const maximumCenterY = plotHeight - strokePadding - resolvedRadius;

  const cx = clamp(target.x, minimumCenterX, maximumCenterX);
  const cy = clamp(target.y, minimumCenterY, maximumCenterY);
  const dotInset = strokePadding + FOCUS_RING_DOT_RADIUS;
  let targetX = clamp(target.x, dotInset, plotWidth - dotInset);
  let targetY = clamp(target.y, dotInset, plotHeight - dotInset);
  const initialOffsetX = targetX - cx;
  const initialOffsetY = targetY - cy;
  const initialOffsetDistance = Math.hypot(initialOffsetX, initialOffsetY);

  if (initialOffsetDistance > resolvedRadius) {
    const scale = resolvedRadius / initialOffsetDistance;
    targetX = cx + initialOffsetX * scale;
    targetY = cy + initialOffsetY * scale;
  }

  const offsetX = targetX - cx;
  const offsetY = targetY - cy;
  const offsetDistance = Math.hypot(offsetX, offsetY);

  const geometry = {
    kind: 'point' as const,
    cx,
    cy,
    radius: resolvedRadius,
    targetX,
    targetY,
    offsetX,
    offsetY,
    offsetDistance,
  };

  if (offsetDistance <= 0) return geometry;

  return {
    ...geometry,
    connector: {
      x1: targetX,
      y1: targetY,
      x2: cx,
      y2: cy,
    },
    dot: {
      cx: targetX,
      cy: targetY,
      radius: FOCUS_RING_DOT_RADIUS,
    },
  };
}

export function createBarFocusRingGeometry(options: {
  target: Pick<ChartTarget, 'x' | 'y' | 'width' | 'height'>;
  plotWidth: number;
  plotHeight: number;
  strokePadding?: number;
  minimumWidth?: number;
  minimumHeight?: number;
}): ChartBarFocusRingGeometry | null {
  const {
    target,
    plotWidth,
    plotHeight,
    strokePadding = DEFAULT_CHART_FOCUS_RING_STROKE_PADDING,
    minimumWidth = MINIMUM_BAR_FOCUS_RING_SIZE,
    minimumHeight = MINIMUM_BAR_FOCUS_RING_SIZE,
  } = options;

  if (plotWidth <= 0 || plotHeight <= 0) return null;

  const requestedWidth = Math.max(target.width ?? 0, minimumWidth);
  const requestedHeight = Math.max(target.height ?? 0, minimumHeight);
  const drawableWidth = plotWidth - strokePadding * 2;
  const drawableHeight = plotHeight - strokePadding * 2;

  if (drawableWidth < MINIMUM_FOCUS_RING_SIZE || drawableHeight < MINIMUM_FOCUS_RING_SIZE) {
    return createPlotFrameFocusRingGeometry(plotWidth, plotHeight, strokePadding);
  }

  const width = Math.min(requestedWidth, drawableWidth);
  const height = Math.min(requestedHeight, drawableHeight);
  const x = clamp(target.x - width / 2, strokePadding, plotWidth - width - strokePadding);
  const y = clamp(target.y - height / 2, strokePadding, plotHeight - height - strokePadding);

  return {
    kind: 'bar',
    x,
    y,
    width,
    height,
    radius: Math.min(4, width / 2, height / 2),
  };
}

function createPlotFrameFocusRingGeometry(
  plotWidth: number,
  plotHeight: number,
  strokePadding: number,
): ChartPlotFrameFocusRingGeometry {
  const inset = Math.min(
    strokePadding,
    Math.max(0, plotWidth - MINIMUM_FOCUS_RING_SIZE) / 2,
    Math.max(0, plotHeight - MINIMUM_FOCUS_RING_SIZE) / 2,
  );
  return {
    kind: 'plot-frame',
    x: inset,
    y: inset,
    width: Math.max(0, plotWidth - inset * 2),
    height: Math.max(0, plotHeight - inset * 2),
    radius: 0,
  };
}

function clamp(value: number, minimum: number, maximum: number): number {
  if (maximum < minimum) return (minimum + maximum) / 2;
  return Math.min(Math.max(value, minimum), maximum);
}
