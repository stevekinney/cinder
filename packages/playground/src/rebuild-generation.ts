let rebuildGeneration = 0;
let shellStale = false;

/** Read the generation used to fence artifact publication against invalidation races. */
export function getRebuildGeneration(): number {
  return rebuildGeneration;
}

/** Advance the generation after watcher-driven cache invalidation. */
export function incrementRebuildGeneration(): number {
  rebuildGeneration += 1;
  return rebuildGeneration;
}

/** Whether the cached shell predates the most recent relevant invalidation. */
export function isShellStale(): boolean {
  return shellStale;
}

/** Mark the shell stale on invalidation or current after a successful rebuild. */
export function setShellStale(value: boolean): void {
  shellStale = value;
}
