import { describe, expect, test } from 'bun:test';

import { metricPointValue, MetricsHistory } from './metrics-history.ts';

describe('metricPointValue', () => {
  test('undefined entry contributes 0', () => {
    expect(metricPointValue(undefined)).toBe(0);
  });

  test('counter/gauge contribute their value', () => {
    expect(metricPointValue({ type: 'counter', value: 12 })).toBe(12);
    expect(metricPointValue({ type: 'gauge', value: 3 })).toBe(3);
  });

  test('histogram contributes p99', () => {
    expect(
      metricPointValue({
        type: 'histogram',
        count: 3,
        sum: 90,
        p50: 20,
        p99: 40,
        min: 10,
        max: 40,
      }),
    ).toBe(40);
  });
});

describe('MetricsHistory', () => {
  test('starts empty', () => {
    const history = new MetricsHistory();
    expect(history.points).toEqual([]);
    expect(history.latest).toBeUndefined();
  });

  test('push appends and reports the latest snapshot', () => {
    const history = new MetricsHistory();
    history.push({ 'weft.workflow.active': { type: 'gauge', value: 1 } }, 1000);
    history.push({ 'weft.workflow.active': { type: 'gauge', value: 2 } }, 2000);

    expect(history.points.length).toBe(2);
    expect(history.latest).toEqual({ 'weft.workflow.active': { type: 'gauge', value: 2 } });
  });

  test('trims to the configured limit, keeping the newest points', () => {
    const history = new MetricsHistory(2);
    history.push({}, 1000);
    history.push({}, 2000);
    history.push({}, 3000);

    expect(history.points.map((point) => point.atMs)).toEqual([2000, 3000]);
  });

  test('series() builds an {x,y} array across the buffered history, defaulting missing entries to 0', () => {
    const history = new MetricsHistory();
    history.push({ 'weft.workflow.active': { type: 'gauge', value: 1 } }, 1000);
    history.push({}, 2000);
    history.push({ 'weft.workflow.active': { type: 'gauge', value: 3 } }, 3000);

    expect(history.series('weft.workflow.active')).toEqual([
      { x: 1000, y: 1 },
      { x: 2000, y: 0 },
      { x: 3000, y: 3 },
    ]);
  });
});
