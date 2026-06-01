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
  test('parses thresholds from coverage-ratchet.json', () => {
    expect(parseCoverageThresholds(JSON.stringify({ lines: 0.65, functions: 0.63 }))).toEqual({
      lines: 0.65,
      functions: 0.63,
    });
  });

  test('rejects missing threshold properties', () => {
    expect(() => parseCoverageThresholds(JSON.stringify({ lines: 0.65 }))).toThrow(
      'coverage-ratchet.json must define numeric lines and functions thresholds.',
    );
  });

  test('computes aggregate hit/found percentages from LCOV records', () => {
    const averages = computeCoverageAverages(parseLcovRecords(lcovFixture));
    expect(averages).toEqual({
      files: 2,
      functionsFound: 4,
      functionsHit: 3,
      functions: 75,
      linesFound: 4,
      linesHit: 3,
      lines: 75,
    });
  });

  test('keeps function coverage aggregate and line coverage aligned to the All files row', () => {
    const weightedFixture = `TN:
SF:tiny.ts
FNF:1
FNH:1
LF:1
LH:1
end_of_record
TN:
SF:large.ts
FNF:99
FNH:50
LF:99
LH:50
end_of_record
`;

    const averages = computeCoverageAverages(parseLcovRecords(weightedFixture));
    expect(averages.functions).toBe(51);
    expect(averages.lines).toBeCloseTo(75.2525);
    expect(averages.functionsFound).toBe(100);
    expect(averages.linesFound).toBe(100);
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
