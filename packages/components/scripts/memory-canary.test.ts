import { describe, expect, test } from 'bun:test';

import {
  bytesFromMaxRss,
  bytesToMegabytes,
  formatCanaryReport,
  measureSubprocess,
  runMemoryCanary,
} from './memory-canary.ts';

describe('memory-canary RSS reporting', () => {
  test('treats Bun subprocess maxRSS as bytes on every platform', () => {
    expect(bytesFromMaxRss(1_048_576)).toBe(1_048_576);
    expect(bytesToMegabytes(bytesFromMaxRss(1_048_576))).toBe(1);
    expect(formatCanaryReport({ peakRssBytes: 1_048_576, exitCode: 0 }, 1)).toContain(
      '1048576 bytes (1.0 MB)',
    );
  });

  test('reports missing resource usage as unavailable', () => {
    expect(formatCanaryReport({ peakRssBytes: null, exitCode: 0 }, 1)).toContain(
      'peak RSS unavailable',
    );
    expect(formatCanaryReport({ peakRssBytes: null, exitCode: 0 }, 1)).not.toContain('0 MB');
  });

  test('records runtime, raw bytes, and converted megabytes for a real child', async () => {
    const result = await measureSubprocess(['bun', '-e', 'process.stdout.write("fixture")']);
    expect(result.exitCode).toBe(0);
    expect(result.peakRssBytes).toEqual(expect.any(Number));
    expect(formatCanaryReport(result, 0)).toMatch(
      /memory-canary: runtime .+; peak RSS \d+ bytes \(\d+\.\d MB\) over 0 suites/,
    );
  });

  test('preserves a failed child exit code', async () => {
    const result = await runMemoryCanary(['missing-fixture']);
    expect(result.exitCode).not.toBe(0);
    expect(result.peakRssBytes).toEqual(expect.any(Number));
  });
});
