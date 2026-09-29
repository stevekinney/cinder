import { createChangeTracker } from './change-tracker.svelte.ts';

export function createChangeTrackerFixture() {
  let tracker: ReturnType<typeof createChangeTracker> | undefined;
  const dispose = $effect.root(() => {
    tracker = createChangeTracker();
    return () => tracker?.destroy();
  });
  if (!tracker) {
    dispose();
    throw new Error('Change tracker did not initialize.');
  }
  return { tracker, dispose };
}
