import type { TreeItemProps } from './tree-item.types.ts';

export type TreeItemAsyncLoaderOptions = {
  getId: () => string;
  getLoadChildren: () => TreeItemProps['loadChildren'];
  getOnLoadError: () => TreeItemProps['onLoadError'];
  setExpanded: (id: string, expanded: boolean) => void;
};

/**
 * Owns the async `loadChildren` lifecycle for a single tree item: at most one
 * in-flight load at a time, aborted on collapse or unmount, with the branch
 * collapsed and `onLoadError` (or a console fallback) invoked on a genuine
 * failure. Callers drive it from the reactive `isExpanded`-watching effects
 * that stay in `tree-item.svelte` — this class has no `$effect` of its own.
 */
export class TreeItemAsyncLoader {
  busy = $state(false);
  loaded = $state(false);

  #activeController: AbortController | null = null;
  readonly #options: TreeItemAsyncLoaderOptions;

  constructor(options: TreeItemAsyncLoaderOptions) {
    this.#options = options;
  }

  async trigger(): Promise<void> {
    const loadChildren = this.#options.getLoadChildren();
    if (!loadChildren || this.loaded || this.busy) return;

    this.#activeController?.abort();
    const controller = new AbortController();
    this.#activeController = controller;
    this.busy = true;

    const id = this.#options.getId();
    try {
      await loadChildren({ id, signal: controller.signal });
      if (!controller.signal.aborted) {
        this.loaded = true;
        this.busy = false;
      }
    } catch (error) {
      if (
        controller.signal.aborted ||
        (error instanceof DOMException && error.name === 'AbortError')
      ) {
        // Only clear busy if this is still the active load. If a newer load
        // has already started (expand→collapse→expand race), clearing busy
        // here would cause the watching effect to re-fire and start a load
        // cascade.
        if (this.#activeController === controller) this.busy = false;
        return;
      }
      this.busy = false;
      this.loaded = false;
      // Collapse the branch on error
      this.#options.setExpanded(id, false);
      const onLoadError = this.#options.getOnLoadError();
      if (onLoadError) {
        onLoadError(error, id);
      } else {
        console.error('[cinder-tree] loadChildren failed for item', id, error);
      }
    }
  }

  /** No-op if there is no in-flight load. Safe to call from an unmount cleanup. */
  abort(): void {
    if (!this.#activeController) return;
    this.#activeController.abort();
    this.#activeController = null;
    this.busy = false;
  }
}
