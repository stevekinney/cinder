/**
 * LRU cache for rendered Mermaid SVGs.
 *
 * DEP-95: Mermaid diagram support for MarkdownPreview.
 *
 * Separate from the HTML render cache because:
 * - Different invalidation patterns (theme changes require re-render)
 * - Theme-aware keys: `${theme}:${hash(code)}`
 * - Different size constraints (SVGs can be larger)
 *
 * Also provides a render mutex to serialize Mermaid operations, since
 * Mermaid is a singleton and concurrent renders can corrupt state.
 *
 * @module
 */

/**
 * Maximum number of cached SVGs.
 * Each entry can be several KB, so we keep this smaller than HTML cache.
 */
const CACHE_SIZE = 100;

/**
 * Internal cache storage.
 */
const cache = new Map<string, string>();

/**
 * Render mutex to serialize Mermaid operations.
 *
 * Mermaid is a global singleton - calling mermaid.initialize() or
 * mermaid.render() concurrently (e.g., in parallel tests) corrupts
 * internal state. This mutex ensures only one render happens at a time.
 */
let renderLock: Promise<void> = Promise.resolve();

/**
 * Execute a function with exclusive access to Mermaid.
 *
 * Serializes access to prevent concurrent renders from corrupting
 * Mermaid's internal state (theme config, DOM manipulation, etc.).
 *
 * @param fn - Async function that uses Mermaid
 * @returns Result of the function
 */
export async function withMermaidLock<T>(fn: () => Promise<T>): Promise<T> {
  // Wait for any pending render to complete
  const previousLock = renderLock;

  // Create a new lock that resolves when our operation completes
  let releaseLock: () => void = () => {};
  renderLock = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });

  try {
    await previousLock;
    return await fn();
  } finally {
    releaseLock();
  }
}

/**
 * Simple hash function for generating cache keys.
 * Uses DJB2 algorithm for good distribution and speed.
 */
function hashCode(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

/**
 * Generate a cache key from mermaid code and theme.
 *
 * @param code - Mermaid diagram source code
 * @param theme - Current theme ('default', 'dark', etc.)
 */
export function getCacheKey(code: string, theme: string): string {
  return `${theme}:${hashCode(code)}`;
}

/**
 * Get a cached SVG if available.
 *
 * @param key - Cache key from getCacheKey()
 * @returns Cached SVG string or undefined
 */
export function getCachedSvg(key: string): string | undefined {
  const svg = cache.get(key);
  if (svg) {
    // Move to end (LRU behavior)
    cache.delete(key);
    cache.set(key, svg);
  }
  return svg;
}

/**
 * Store an SVG in the cache.
 *
 * @param key - Cache key from getCacheKey()
 * @param svg - Rendered SVG string
 */
export function setCachedSvg(key: string, svg: string): void {
  // Evict oldest if at capacity (but only if adding a new key)
  if (cache.size >= CACHE_SIZE && !cache.has(key)) {
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) {
      cache.delete(firstKey);
    }
  }
  cache.set(key, svg);
}

/**
 * Clear all cached SVGs.
 * Useful when theme changes globally or for testing.
 */
export function clearMermaidCache(): void {
  cache.clear();
}

/**
 * Get current cache size (for testing/debugging).
 */
export function getMermaidCacheSize(): number {
  return cache.size;
}
