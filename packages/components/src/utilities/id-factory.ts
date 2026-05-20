/**
 * Deterministic ID factory utilities.
 *
 * Provides counters and seed-based hashing so component IDs are stable across
 * re-renders and snapshot runs — avoiding the visual churn that
 * `crypto.randomUUID()` and `Math.random()` cause in screenshot regression tests.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A factory that vends deterministic, incrementing IDs for a given prefix. */
export type IdFactory = {
  /** Returns the next ID in the sequence: `${prefix}-${counter}`. */
  next: () => string;
  /** Resets the internal counter to 0 so the next call to `next()` returns `${prefix}-1`. */
  reset: () => void;
};

// ---------------------------------------------------------------------------
// createIdFactory
// ---------------------------------------------------------------------------

/**
 * Creates an independent ID factory for the given prefix.
 *
 * Each factory maintains its own counter, so two factories with the same
 * prefix produce independent sequences and do not interfere with each other.
 *
 * @param prefix - String prepended to every generated ID (default `''`).
 * @returns An `IdFactory` with `next()` and `reset()` methods.
 *
 * @example
 * ```ts
 * const factory = createIdFactory('tooltip');
 * factory.next(); // 'tooltip-1'
 * factory.next(); // 'tooltip-2'
 * factory.reset();
 * factory.next(); // 'tooltip-1'
 * ```
 */
export function createIdFactory(prefix = ''): IdFactory {
  let counter = 0;

  return {
    next(): string {
      return `${prefix}-${++counter}`;
    },
    reset(): void {
      counter = 0;
    },
  };
}

// ---------------------------------------------------------------------------
// defaultIdFactory
// ---------------------------------------------------------------------------

/**
 * A module-level singleton factory useful when callers do not need an
 * isolated counter. Uses the `'cinder'` prefix.
 *
 * @example
 * ```ts
 * defaultIdFactory.next(); // 'cinder-1'
 * defaultIdFactory.next(); // 'cinder-2'
 * ```
 */
export const defaultIdFactory: IdFactory = createIdFactory('cinder');

// ---------------------------------------------------------------------------
// useStableId
// ---------------------------------------------------------------------------

/**
 * Returns a deterministic ID derived from `seed`.
 *
 * When a seed is provided the ID is derived from the first 8 hex characters of
 * the SHA-1 digest of that seed, prefixed with `'id-'`. The same seed always
 * produces the same ID, making it safe for snapshot/regression test runs that
 * capture DOM output.
 *
 * When no seed is provided the call falls back to `defaultIdFactory.next()`,
 * which returns a sequentially incrementing ID.
 *
 * @param seed - An optional string whose content uniquely identifies the element
 *   (e.g. `file.name + file.size + file.lastModified`).
 * @returns A stable string ID.
 *
 * @example
 * ```ts
 * useStableId('report.pdf12345678901234'); // 'id-a3f2c1b0'  (deterministic)
 * useStableId();                            // 'cinder-1'   (fallback counter)
 * ```
 */
export function useStableId(seed?: string): string {
  if (seed === undefined) {
    return defaultIdFactory.next();
  }

  const hasher = new Bun.CryptoHasher('sha1');
  hasher.update(seed);
  // digest('hex') returns the full 40-char hex string; take the first 8 chars.
  const digest = hasher.digest('hex').slice(0, 8);
  return `id-${digest}`;
}
