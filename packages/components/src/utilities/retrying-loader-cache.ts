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
 * Used by the bundled Shiki adapter (to wrap `import('shiki')`) and by
 * `<CodeBlock>`'s default-highlighter seam (to wrap the dynamic import of the
 * Shiki adapter module). Lives in `utilities/` so the default-highlighter seam
 * can reuse it WITHOUT a static import edge to the Shiki adapter — keeping the
 * adapter out of CodeBlock's static import graph (see
 * `code-block.bundle-boundary.test.ts`).
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
