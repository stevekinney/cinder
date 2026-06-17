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

  test('allows recovery metadata alongside active thresholds', () => {
    expect(
      parseCoverageThresholds(
        JSON.stringify({
          lines: 0.37,
          functions: 0.81,
          lineFloorRecoveryPlan: {
            target: 0.65,
            reviewBy: '2026-06-14',
          },
        }),
      ),
    ).toEqual({
      lines: 0.37,
      functions: 0.81,
    });
  });

  test('rejects missing threshold properties', () => {
    expect(() => parseCoverageThresholds(JSON.stringify({ lines: 0.65 }))).toThrow(
      'coverage-ratchet.json must define numeric lines and functions thresholds.',
    );
  });

  test('rejects non-object threshold data', () => {
    expect(() => parseCoverageThresholds('null')).toThrow(
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
    expect(averages.lines).toBe(51);
    expect(averages.functionsFound).toBe(100);
    expect(averages.linesFound).toBe(100);
  });

  test('excludes transient SSR test artifacts from the aggregate', () => {
    // `.cinder-ssr-*.mjs` modules are compiled by the SSR test helpers, imported
    // once, and deleted — Bun still instruments them, so they leak into LCOV and
    // depress the aggregate. They must not count toward the ratchet.
    const withArtifact = `${lcovFixture}TN:
SF:src/components/portal/.cinder-ssr-12345-1780000000000-abc123.mjs
FNF:10
FNH:0
LF:10
LH:0
end_of_record
`;
    const records = parseLcovRecords(withArtifact);
    expect(records.map((record) => record.file)).toEqual(['covered.ts', 'partial.ts']);
    // Aggregate is unchanged from the artifact-free fixture (still 3/4 = 75%).
    expect(computeCoverageAverages(records).functions).toBe(75);
  });

  test('excludes hydration-safety and legacy SSR probe artifacts from the aggregate', () => {
    const withArtifacts = `${lcovFixture}TN:
SF:tmp/hydration-safety/client-12345-1780000000000-abc123.mjs
FNF:10
FNH:0
LF:10
LH:0
end_of_record
TN:
SF:tmp/hydration-safety/server-12345-1780000000000-def456.mjs
FNF:10
FNH:0
LF:10
LH:0
end_of_record
TN:
SF:src/components/resizable-panels/.cinder-ssr-test-12345-1780000000000.mjs
FNF:10
FNH:0
LF:10
LH:0
end_of_record
TN:
SF:src/components/chat/.cinder-ssr-chat-12345-1780000000000.mjs
FNF:10
FNH:0
LF:10
LH:0
end_of_record
TN:
SF:src/components/chat/message/.cinder-ssr-parts-12345-1780000000000.mjs
FNF:10
FNH:0
LF:10
LH:0
end_of_record
`;

    const records = parseLcovRecords(withArtifacts);
    expect(records.map((record) => record.file)).toEqual(['covered.ts', 'partial.ts']);
    expect(computeCoverageAverages(records).functions).toBe(75);
  });

  test('does not exclude real source whose path merely contains the artifact prefix', () => {
    // The exclusion is anchored to the final path segment with the generated
    // `<pid>-<epoch>-<rand>.mjs` shape — a real `.ts` file under a directory that
    // happens to share the prefix must still count.
    const lookalike = `${lcovFixture}TN:
SF:src/.cinder-ssr-12345-1780000000000-abc123.mjs/real-module.ts
FNF:4
FNH:4
LF:4
LH:4
end_of_record
`;
    const records = parseLcovRecords(lookalike);
    expect(records.map((record) => record.file)).toContain(
      'src/.cinder-ssr-12345-1780000000000-abc123.mjs/real-module.ts',
    );
  });

  test('does not exclude real source under lookalike hydration-safety directories', () => {
    const lookalike = `${lcovFixture}TN:
SF:src/tmp/hydration-safety/client-12345-1780000000000-abc123.mjs/real-module.ts
FNF:4
FNH:4
LF:4
LH:4
end_of_record
`;

    const records = parseLcovRecords(lookalike);
    expect(records.map((record) => record.file)).toContain(
      'src/tmp/hydration-safety/client-12345-1780000000000-abc123.mjs/real-module.ts',
    );
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
