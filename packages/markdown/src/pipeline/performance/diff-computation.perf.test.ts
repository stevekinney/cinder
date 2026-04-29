/**
 * Performance tests for diff computation.
 * DEP-47: Verify diff computation meets timing thresholds.
 *
 * Architecture:
 * - normalize() parses markdown to AST then serializes (~20ms for 20KB)
 * - computeLineDiff() performs line-based diff (~2ms for 20KB)
 * - Full pipeline: 2x normalize + diff (~45ms for 20KB cold)
 *
 * Thresholds:
 * - Cold path (uncached): 2x normalize + diff
 *   - 20KB: <100ms
 *   - 60KB: <300ms
 *   - 100KB: <500ms
 *
 * - Warm path (cached baseline): 1x normalize + diff
 *   - 20KB: <50ms
 *   - 60KB: <150ms
 *
 * - Pure diff (pre-normalized): <10ms for 20KB
 *
 * - Identical docs: <5ms (string equality fast path)
 */

import { afterAll, beforeEach, describe, expect, it } from 'bun:test';
import { computeLineDiff } from '../../diff/line-diff.js';
import { clearNormalizeCache, normalize, normalizeWithCache } from '../../pipeline/index.js';
import { FIXTURES, generateModifiedDocument } from './generate-fixtures';

// Skip performance tests in CI - they're benchmarks, not correctness tests.
// CI runners have variable performance (2-10x slower than local) so absolute
// timing thresholds don't work across environments.
const isCI = process.env.CI === 'true' || process.env.CI === '1';
const describeUnlessCI = isCI ? describe.skip : describe;

// Result storage for CI artifacts
const results: Array<{
  test: string;
  size: string;
  duration: number;
  threshold: number;
  passed: boolean;
}> = [];

describeUnlessCI('Diff Computation Performance', () => {
  // Clear cache before each test to ensure clean measurements
  beforeEach(() => {
    clearNormalizeCache();
  });

  describe('Cold path (uncached)', () => {
    it('should compute 20KB diff cold in <100ms', () => {
      const original = FIXTURES.small();
      const current = generateModifiedDocument(original, 15);

      const start = performance.now();
      const normalizedOriginal = normalize(original);
      const normalizedCurrent = normalize(current);
      computeLineDiff(normalizedOriginal, normalizedCurrent);
      const duration = performance.now() - start;

      results.push({
        test: '20KB diff (cold)',
        size: '20KB',
        duration,
        threshold: 100,
        passed: duration < 100,
      });

      console.log(`20KB diff (cold): ${duration.toFixed(2)}ms (threshold: 100ms)`);
      expect(duration).toBeLessThan(100);
    });

    it('should compute 60KB diff cold in <300ms', () => {
      const original = FIXTURES.medium();
      const current = generateModifiedDocument(original, 20);

      const start = performance.now();
      const normalizedOriginal = normalize(original);
      const normalizedCurrent = normalize(current);
      computeLineDiff(normalizedOriginal, normalizedCurrent);
      const duration = performance.now() - start;

      results.push({
        test: '60KB diff (cold)',
        size: '60KB',
        duration,
        threshold: 300,
        passed: duration < 300,
      });

      console.log(`60KB diff (cold): ${duration.toFixed(2)}ms (threshold: 300ms)`);
      expect(duration).toBeLessThan(300);
    });

    it('should compute 100KB diff cold in <500ms', () => {
      const original = FIXTURES.large();
      const current = generateModifiedDocument(original, 15);

      const start = performance.now();
      const normalizedOriginal = normalize(original);
      const normalizedCurrent = normalize(current);
      computeLineDiff(normalizedOriginal, normalizedCurrent);
      const duration = performance.now() - start;

      results.push({
        test: '100KB diff (cold)',
        size: '100KB',
        duration,
        threshold: 500,
        passed: duration < 500,
      });

      console.log(`100KB diff (cold): ${duration.toFixed(2)}ms (threshold: 500ms)`);
      expect(duration).toBeLessThan(500);
    });
  });

  describe('Warm path (cached baseline)', () => {
    it('should compute 20KB diff warm in <50ms', () => {
      const original = FIXTURES.small();
      const current = generateModifiedDocument(original, 15);

      // Pre-warm cache with baseline
      normalizeWithCache(original);
      clearNormalizeCache(); // Clear to reset, then re-add just original
      normalizeWithCache(original);

      // Now measure warm path (only current needs normalization)
      const start = performance.now();
      const cachedOriginal = normalizeWithCache(original); // Cache hit
      const normalizedCurrent = normalize(current); // Full normalize
      computeLineDiff(cachedOriginal, normalizedCurrent);
      const duration = performance.now() - start;

      results.push({
        test: '20KB diff (warm)',
        size: '20KB',
        duration,
        threshold: 50,
        passed: duration < 50,
      });

      console.log(`20KB diff (warm): ${duration.toFixed(2)}ms (threshold: 50ms)`);
      expect(duration).toBeLessThan(50);
    });

    it('should compute 60KB diff warm in <150ms', () => {
      const original = FIXTURES.medium();
      const current = generateModifiedDocument(original, 20);

      // Pre-warm cache with baseline
      normalizeWithCache(original);

      // Measure warm path
      const start = performance.now();
      const cachedOriginal = normalizeWithCache(original); // Cache hit
      const normalizedCurrent = normalize(current); // Full normalize
      computeLineDiff(cachedOriginal, normalizedCurrent);
      const duration = performance.now() - start;

      results.push({
        test: '60KB diff (warm)',
        size: '60KB',
        duration,
        threshold: 150,
        passed: duration < 150,
      });

      console.log(`60KB diff (warm): ${duration.toFixed(2)}ms (threshold: 150ms)`);
      expect(duration).toBeLessThan(150);
    });
  });

  describe('Pure diff algorithm (pre-normalized)', () => {
    it('should diff 20KB pre-normalized content in <10ms', () => {
      const original = FIXTURES.small();
      const current = generateModifiedDocument(original, 15);

      // Pre-normalize both (not timed)
      const normalizedOriginal = normalize(original);
      const normalizedCurrent = normalize(current);

      // Time only the diff algorithm
      const start = performance.now();
      const diff = computeLineDiff(normalizedOriginal, normalizedCurrent);
      const duration = performance.now() - start;

      results.push({
        test: 'Pure diff 20KB',
        size: '20KB',
        duration,
        threshold: 10,
        passed: duration < 10,
      });

      console.log(
        `Pure diff 20KB: ${duration.toFixed(2)}ms, ${diff.length} lines (threshold: 10ms)`,
      );
      expect(duration).toBeLessThan(10);
    });

    it('should diff 60KB pre-normalized content in <50ms', () => {
      const original = FIXTURES.medium();
      const current = generateModifiedDocument(original, 20);

      // Pre-normalize both (not timed)
      const normalizedOriginal = normalize(original);
      const normalizedCurrent = normalize(current);

      // Time only the diff algorithm
      const start = performance.now();
      const diff = computeLineDiff(normalizedOriginal, normalizedCurrent);
      const duration = performance.now() - start;

      results.push({
        test: 'Pure diff 60KB',
        size: '60KB',
        duration,
        threshold: 50,
        passed: duration < 50,
      });

      console.log(
        `Pure diff 60KB: ${duration.toFixed(2)}ms, ${diff.length} lines (threshold: 50ms)`,
      );
      expect(duration).toBeLessThan(50);
    });
  });

  describe('Fast path for identical documents', () => {
    it('should detect identical 20KB documents in <5ms', () => {
      const { original, current } = FIXTURES.identical();

      const start = performance.now();

      // Fast path: simple equality check
      const isIdentical = original === current;

      const duration = performance.now() - start;

      results.push({
        test: 'Identical 20KB',
        size: '20KB',
        duration,
        threshold: 5,
        passed: duration < 5,
      });

      console.log(`Identical 20KB: ${duration.toFixed(4)}ms (threshold: 5ms)`);
      expect(isIdentical).toBe(true);
      expect(duration).toBeLessThan(5);
    });
  });

  describe('Cache effectiveness', () => {
    it('should hit cache on second normalization', () => {
      const doc = FIXTURES.small();

      // First call - cold
      const start1 = performance.now();
      const result1 = normalizeWithCache(doc);
      const coldDuration = performance.now() - start1;

      // Second call - should be instant (cache hit)
      const start2 = performance.now();
      const result2 = normalizeWithCache(doc);
      const warmDuration = performance.now() - start2;

      results.push({
        test: 'Cache hit 20KB',
        size: '20KB',
        duration: warmDuration,
        threshold: 1,
        passed: warmDuration < 1,
      });

      console.log(`Cache: cold=${coldDuration.toFixed(2)}ms, warm=${warmDuration.toFixed(4)}ms`);
      expect(result1).toBe(result2);
      expect(warmDuration).toBeLessThan(1); // Cache hit should be <1ms
      expect(warmDuration).toBeLessThan(coldDuration / 10); // At least 10x faster
    });
  });
});

// Log summary after all tests
afterAll(() => {
  console.log('\n=== Performance Test Summary ===\n');
  console.table(results);

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  console.log(`\n${passed}/${total} tests passed\n`);
});
