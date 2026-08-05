// Test-only reactive fixture for `data-grid-range.test.ts`. `DataGridSelectionModel`
// takes `rowIds`/`columnKeys` as accessor functions and only memoizes its
// index maps when the accessors read genuine Svelte state, exactly like
// `data-grid.svelte` closing over the `$derived` `rowDomIds`/`columnKeys`. A
// plain mutable closure variable carries no reactive dependency, so tests
// need a real `$state`-backed source to prove the memoized maps rebuild.
export function createReactiveIdList(initial: readonly string[]): {
  get: () => readonly string[];
  set: (next: readonly string[]) => void;
} {
  let ids = $state<readonly string[]>(initial);
  return {
    get: () => ids,
    set: (next: readonly string[]) => {
      ids = next;
    },
  };
}
