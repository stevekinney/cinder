import { describe, expect, test } from 'bun:test';

import {
  computeCoverageAverages,
  coverageFailures,
  formatCoverageSummary,
  parseCoverageThresholds,
  parseLcovRecords,
} from './check-coverage-ratchet.ts';

const lcovFixture = `TN:
SF:covered.ts
FNF:2
FNH:2
DA:1,1
DA:2,1
LF:2
LH:2
end_of_record
TN:
SF:partial.ts
FNF:2
FNH:1
DA:1,1
DA:2,0
LF:2
LH:1
end_of_record
`;

describe('coverage ratchet check', () => {
  test('parses object thresholds from bunfig.toml', () => {
    expect(
      parseCoverageThresholds('[test]\ncoverageThreshold = { lines = 0.65, functions = 0.63 }'),
    ).toEqual({
      lines: 0.65,
      functions: 0.63,
    });
  });

  test('parses a shared threshold for both metrics', () => {
    expect(parseCoverageThresholds('[test]\ncoverageThreshold = 0.8')).toEqual({
      lines: 0.8,
      functions: 0.8,
    });
  });

  test('computes Bun-compatible unweighted file averages from LCOV records', () => {
    const averages = computeCoverageAverages(parseLcovRecords(lcovFixture));
    expect(averages).toEqual({
      files: 2,
      functions: 75,
      lines: 75,
    });
  });

  test('reports no failures when the aggregate ratchet is met', () => {
    const averages = computeCoverageAverages(parseLcovRecords(lcovFixture));
    expect(coverageFailures(averages, { functions: 0.7, lines: 0.7 })).toEqual([]);
  });

  test('reports each metric that drops below the configured floor', () => {
    const averages = computeCoverageAverages(parseLcovRecords(lcovFixture));
    expect(coverageFailures(averages, { functions: 0.8, lines: 0.9 })).toEqual([
      'functions 75.00% < 80.00%',
      'lines 75.00% < 90.00%',
    ]);
  });

  test('formats the gate summary with the measured file count', () => {
    const averages = computeCoverageAverages(parseLcovRecords(lcovFixture));
    expect(formatCoverageSummary(averages, { functions: 0.7, lines: 0.7 })).toBe(
      'Coverage ratchet (2 files): functions 75.00% >= 70.00% lines 75.00% >= 70.00%',
    );
  });
});
