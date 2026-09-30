import { tick } from 'svelte';

import { createDiffController, type DiffControllerOptions } from './diff-controller.svelte.ts';

/**
 * Mounts a controller inside an effect root (the controller registers a
 * `$effect`, which needs an owner) and flushes its first run.
 */
export async function mountDiffController(
  original: string,
  current: string,
  options?: DiffControllerOptions,
): Promise<{ controller: ReturnType<typeof createDiffController>; dispose: () => void }> {
  let controller!: ReturnType<typeof createDiffController>;
  const stop = $effect.root(() => {
    controller = createDiffController(options);
    controller.setOriginal(original);
    controller.setCurrent(current);
    return () => controller.destroy();
  });

  await tick();

  return { controller, dispose: stop };
}
