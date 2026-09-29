import { describe, expect, test } from 'bun:test';

import { nearestTarget, type ChartTarget } from './chart-utilities.ts';

function buildTargets(points: Array<{ x: number; y: number }>): ChartTarget[] {
  return points.map((point, index) => ({
    id: `t-${index}`,
    seriesId: 's',
    seriesLabel: 'Series',
    xLabel: `${point.x}`,
    valueLabel: `${point.y}`,
    x: point.x,
    y: point.y,
    color: 'red',
  }));
}

describe('nearestTarget', () => {
  test('returns undefined for empty targets', () => {
    expect(nearestTarget([], 10, 10)).toBeUndefined();
  });

  test('returns the only target when targets.length === 1', () => {
    const targets = buildTargets([{ x: 50, y: 50 }]);
    expect(nearestTarget(targets, 999, -999)?.id).toBe('t-0');
  });

  test('finds the closest target by x (binary search)', () => {
    const targets = buildTargets([
      { x: 0, y: 100 },
      { x: 100, y: 100 },
      { x: 200, y: 100 },
      { x: 300, y: 100 },
    ]);
    expect(nearestTarget(targets, 95, 100)?.id).toBe('t-1');
    expect(nearestTarget(targets, 210, 100)?.id).toBe('t-2');
    expect(nearestTarget(targets, -50, 100)?.id).toBe('t-0');
    expect(nearestTarget(targets, 500, 100)?.id).toBe('t-3');
  });

  test('compares adjacent x buckets when the pointer is between them', () => {
    const targets = buildTargets([
      { x: 0, y: 100 },
      { x: 100, y: 100 },
    ]);

    expect(nearestTarget(targets, 40, 100)?.id).toBe('t-0');
    expect(nearestTarget(targets, 60, 100)?.id).toBe('t-1');
  });

  test('breaks 1-D ties using full Euclidean distance', () => {
    const targets = buildTargets([
      { x: 100, y: 0 },
      { x: 100, y: 200 },
    ]);
    // Both share x=100; closer in y wins.
    expect(nearestTarget(targets, 100, 10)?.id).toBe('t-0');
    expect(nearestTarget(targets, 100, 190)?.id).toBe('t-1');
  });

  test('compares the previous distinct x bucket when duplicate targets straddle the boundary', () => {
    const targets = buildTargets([
      { x: 0, y: 10 },
      { x: 100, y: 500 },
      { x: 100, y: 600 },
      { x: 200, y: 10 },
    ]);

    expect(nearestTarget(targets, 150, 10)?.id).toBe('t-3');
  });

  test('supports searching on the y axis for horizontal layouts', () => {
    const targets = buildTargets([
      { x: 50, y: 0 },
      { x: 50, y: 100 },
      { x: 50, y: 200 },
    ]);
    expect(nearestTarget(targets, 50, 90, 'y')?.id).toBe('t-1');
    expect(nearestTarget(targets, 50, 210, 'y')?.id).toBe('t-2');
  });

  test('compares adjacent y buckets when the pointer is between them', () => {
    const targets = buildTargets([
      { x: 50, y: 0 },
      { x: 50, y: 100 },
    ]);

    expect(nearestTarget(targets, 50, 40, 'y')?.id).toBe('t-0');
    expect(nearestTarget(targets, 50, 60, 'y')?.id).toBe('t-1');
  });
});
