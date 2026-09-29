export function createLinePath(points: Array<{ x: number; y: number | null }>): string {
  if (points.length === 0) return '';
  const commands: string[] = [];
  for (const [index, point] of points.entries()) {
    if (point.y === null) continue;
    const previous = points[index - 1];
    commands.push(
      previous?.y === null || commands.length === 0
        ? `M${formatPathNumber(point.x)},${formatPathNumber(point.y)}`
        : `L${formatPathNumber(point.x)},${formatPathNumber(point.y)}`,
    );
  }
  return commands.join('');
}

export function createAreaPath(
  points: Array<{ x: number; y: number | null; y0?: number }>,
  baseline: number | undefined,
): string {
  const segments: Array<Array<{ x: number; y: number; y0?: number }>> = [];
  let segment: Array<{ x: number; y: number; y0?: number }> = [];
  for (const point of points) {
    if (point.y === null) {
      if (segment.length > 0) segments.push(segment);
      segment = [];
      continue;
    }
    segment.push({ ...point, y: point.y });
  }
  if (segment.length > 0) segments.push(segment);

  return segments
    .map((visiblePoints) => {
      const firstPoint = visiblePoints[0]!;
      const lowerPoints: string[] = [];
      for (let index = visiblePoints.length - 1; index >= 0; index--) {
        const point = visiblePoints[index]!;
        lowerPoints.push(
          `L${formatPathNumber(point.x)},${formatPathNumber(point.y0 ?? baseline ?? 0)}`,
        );
      }
      return [
        `M${formatPathNumber(firstPoint.x)},${formatPathNumber(firstPoint.y0 ?? baseline ?? 0)}`,
        `L${formatPathNumber(firstPoint.x)},${formatPathNumber(firstPoint.y)}`,
        ...visiblePoints
          .slice(1)
          .map((point) => `L${formatPathNumber(point.x)},${formatPathNumber(point.y)}`),
        ...lowerPoints,
        'Z',
      ].join('');
    })
    .join('');
}

function formatPathNumber(value: number): string {
  return Number(value.toFixed(3)).toString();
}
