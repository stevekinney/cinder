/**
 * Tests for mermaid SVG cache.
 *
 * DEP-95: Mermaid diagram support.
 */

import { beforeEach, describe, expect, it } from 'bun:test';
import {
  clearMermaidCache,
  getCacheKey,
  getCachedSvg,
  getMermaidCacheSize,
  setCachedSvg,
  withMermaidLock,
} from './mermaid-cache';

describe('mermaid-cache', () => {
  beforeEach(() => {
    clearMermaidCache();
  });

  describe('getCacheKey', () => {
    it('generates deterministic keys for same input', () => {
      const code = 'flowchart TD\n    A --> B';
      const theme = 'default';

      const key1 = getCacheKey(code, theme);
      const key2 = getCacheKey(code, theme);

      expect(key1).toBe(key2);
    });

    it('generates different keys for different themes', () => {
      const code = 'flowchart TD\n    A --> B';

      const lightKey = getCacheKey(code, 'default');
      const darkKey = getCacheKey(code, 'dark');

      expect(lightKey).not.toBe(darkKey);
    });

    it('generates different keys for different code', () => {
      const theme = 'default';

      const key1 = getCacheKey('flowchart TD\n    A --> B', theme);
      const key2 = getCacheKey('flowchart TD\n    C --> D', theme);

      expect(key1).not.toBe(key2);
    });

    it('includes theme prefix in key', () => {
      const code = 'flowchart TD\n    A --> B';

      const defaultKey = getCacheKey(code, 'default');
      const darkKey = getCacheKey(code, 'dark');

      expect(defaultKey).toMatch(/^default:/);
      expect(darkKey).toMatch(/^dark:/);
    });
  });

  describe('getCachedSvg / setCachedSvg', () => {
    it('returns undefined for uncached key', () => {
      const result = getCachedSvg('nonexistent:key');
      expect(result).toBeUndefined();
    });

    it('stores and retrieves SVG', () => {
      const key = 'default:abc123';
      const svg = '<svg>diagram</svg>';

      setCachedSvg(key, svg);
      const result = getCachedSvg(key);

      expect(result).toBe(svg);
    });

    it('maintains LRU order on get', () => {
      // Set up cache with 3 items
      setCachedSvg('key1', 'svg1');
      setCachedSvg('key2', 'svg2');
      setCachedSvg('key3', 'svg3');

      // Access key1 (moves it to end)
      getCachedSvg('key1');

      expect(getMermaidCacheSize()).toBe(3);

      // All items should still be accessible
      expect(getCachedSvg('key1')).toBe('svg1');
      expect(getCachedSvg('key2')).toBe('svg2');
      expect(getCachedSvg('key3')).toBe('svg3');
    });
  });

  describe('clearMermaidCache', () => {
    it('clears all cached entries', () => {
      setCachedSvg('key1', 'svg1');
      setCachedSvg('key2', 'svg2');

      expect(getMermaidCacheSize()).toBe(2);

      clearMermaidCache();

      expect(getMermaidCacheSize()).toBe(0);
      expect(getCachedSvg('key1')).toBeUndefined();
      expect(getCachedSvg('key2')).toBeUndefined();
    });
  });

  describe('getMermaidCacheSize', () => {
    it('returns 0 for empty cache', () => {
      expect(getMermaidCacheSize()).toBe(0);
    });

    it('returns correct count after adds', () => {
      setCachedSvg('key1', 'svg1');
      expect(getMermaidCacheSize()).toBe(1);

      setCachedSvg('key2', 'svg2');
      expect(getMermaidCacheSize()).toBe(2);
    });
  });

  describe('LRU eviction', () => {
    it('evicts oldest entry when at capacity', () => {
      // The cache size is 100, but we can test the eviction mechanism
      // by filling it and checking the behavior

      // Add items up to capacity
      for (let i = 0; i < 100; i++) {
        setCachedSvg(`key${i}`, `svg${i}`);
      }

      expect(getMermaidCacheSize()).toBe(100);

      // Add one more - should evict key0
      setCachedSvg('key100', 'svg100');

      expect(getMermaidCacheSize()).toBe(100);
      expect(getCachedSvg('key0')).toBeUndefined();
      expect(getCachedSvg('key100')).toBe('svg100');
    });

    it('does not evict when updating an existing key', () => {
      for (let i = 0; i < 100; i++) {
        setCachedSvg(`key${i}`, `svg${i}`);
      }

      // Overwrite an existing key — should not evict anything
      setCachedSvg('key50', 'updated-svg50');

      expect(getMermaidCacheSize()).toBe(100);
      expect(getCachedSvg('key0')).toBe('svg0');
      expect(getCachedSvg('key50')).toBe('updated-svg50');
    });
  });

  describe('withMermaidLock', () => {
    it('executes the function and returns its result', async () => {
      const result = await withMermaidLock(async () => 42);
      expect(result).toBe(42);
    });

    it('serializes concurrent operations', async () => {
      const order: number[] = [];

      const first = withMermaidLock(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        order.push(1);
      });

      const second = withMermaidLock(async () => {
        order.push(2);
      });

      await Promise.all([first, second]);

      // Second should wait for first to complete
      expect(order).toEqual([1, 2]);
    });

    it('releases lock even when function throws', async () => {
      // First call throws
      await expect(
        withMermaidLock(async () => {
          throw new Error('test error');
        }),
      ).rejects.toThrow('test error');

      // Second call should still execute (lock was released)
      const result = await withMermaidLock(async () => 'success');
      expect(result).toBe('success');
    });
  });
});
