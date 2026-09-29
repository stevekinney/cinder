import { describe, expect, test } from 'bun:test';

import { createCartesianModel } from './chart-utilities.ts';

describe('createCartesianModel', () => {
  test('rejects negative values in stacked-area mode', () => {
    expect(() =>
      createCartesianModel({
        componentId: 'area-chart',
        series: [{ id: 's', label: 'S', data: [{ x: 'Jan', y: -1 }] }],
        hiddenSeriesIds: [],
        width: 640,
        height: 280,
        stackedArea: true,
      }),
    ).toThrow('negative-stacked-area');
  });

  test('rejects duplicate x values within a series', () => {
    expect(() =>
      createCartesianModel({
        componentId: 'line-chart',
        series: [
          {
            id: 's',
            label: 'S',
            data: [
              { x: 'Jan', y: 1 },
              { x: 'Jan', y: 2 },
            ],
          },
        ],
        hiddenSeriesIds: [],
        width: 640,
        height: 280,
      }),
    ).toThrow('duplicate-x');
  });

  test('rejects mixed x domain kinds', () => {
    expect(() =>
      createCartesianModel({
        componentId: 'line-chart',
        series: [
          {
            id: 's',
            label: 'S',
            data: [
              { x: 'Jan', y: 1 },
              { x: 2, y: 2 },
            ],
          },
        ],
        hiddenSeriesIds: [],
        width: 640,
        height: 280,
      }),
    ).toThrow('mixed-x-domain-kind');
  });

  test('rejects non-finite y values', () => {
    expect(() =>
      createCartesianModel({
        componentId: 'line-chart',
        series: [{ id: 's', label: 'S', data: [{ x: 'Jan', y: Number.NaN }] }],
        hiddenSeriesIds: [],
        width: 640,
        height: 280,
      }),
    ).toThrow('non-finite-y');
  });
});
