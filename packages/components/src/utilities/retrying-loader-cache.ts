/**
 * Wrap a one-shot async loader in a promise cache that:
 *
 *   1. De-duplicates concurrent callers — multiple `await` callers during the
 *      same in-flight load share one promise.
 *   2. Evicts the cached promise on rejection so the next call retries.
 *      Without eviction, a single transient failure (network error,
 *      chunk-load failure, etc.) would lock the cached rejection in forever
 *      and every subsequent call would replay the failure.
 *
 * Used by the Shiki adapter (to wrap its lazy Shiki imports) and by the JSON
 * Schema interpreter. Lives in `utilities/` so a module can reuse it without
 * an import edge to the Shiki adapter.
 */
export function createRetryingLoaderCache<T>(loader: () => Promise<T>): () => Promise<T> {
  let cached: Promise<T> | undefined;
  return () => {
    if (cached === undefined) {
      const pending = loader();
      // Attach a rejection handler that evicts the cached promise so the next
      // call retries. `.catch` returns a new promise; we don't await it — the
      // original `pending` is what concurrent callers share, and they'll
      // observe its rejection through their own awaits.
      pending.catch(() => {
        if (cached === pending) {
          cached = undefined;
        }
      });
      cached = pending;
    }
    return cached;
  };
}
