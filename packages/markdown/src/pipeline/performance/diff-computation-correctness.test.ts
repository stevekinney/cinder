/**
 * Correctness checks for diff computation's identity fast paths.
 * DEP-47: Verify diff computation meets timing thresholds.
 *
 * These assertions were split out of diff-computation.perf.test.ts: the
 * timing budgets that used to sit alongside them are non-deterministic
 * under machine load and now live in diff-computation.bench.ts, run on
 * demand via `bun run test:benchmarks`. This file keeps the correctness
 * assertions that must run in the default suite.
 */

import { beforeEach, describe, expect, it } from 'bun:test';
import { clearNormalizeCache, normalizeWithCache } from '../../pipeline/index.js';
import { FIXTURES } from './generate-fixtures';

describe('Diff Computation Correctness', () => {
  beforeEach(() => {
    clearNormalizeCache();
  });

  it('detects identical documents via string equality', () => {
    const { original, current } = FIXTURES.identical();

    const isIdentical = original === current;

    expect(isIdentical).toBe(true);
  });

  it('returns the same normalized result on a cache hit', () => {
    const doc = FIXTURES.small();

    const result1 = normalizeWithCache(doc);
    const result2 = normalizeWithCache(doc);

    expect(result1).toBe(result2);
  });
});
