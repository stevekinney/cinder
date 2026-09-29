/**
 * TanStack Query key for the Storage surface's one genuinely cacheable read
 * (the `conditionalBatch` capability probe — parameterless, safe to cache
 * for the session). `src/lib/query.ts`'s frozen `queryKeys` object has no
 * storage entries by design (storage wasn't in the plan §4 list of domains
 * it documents); Get/Scan/Put/Delete/Batch are one-shot user-triggered
 * actions modeled as `createMutation` calls instead (see `get-panel.svelte`'s
 * doc comment for why `createQuery` doesn't fit those), so they need no
 * query key at all.
 */
export const storageQueryKeys = {
  capabilities: () => ['storage', 'capabilities'] as const,
};
