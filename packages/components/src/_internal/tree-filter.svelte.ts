import { untrack } from 'svelte';

export type TreeFilterControllerOptions = {
  getFilterValue: () => string | undefined;
  isControlled: () => boolean;
  onFilterChange?: (value: string) => void;
  focusFirstVisible: () => void;
};

/**
 * Tree's search/filter input: controlled-vs-uncontrolled value resolution, a
 * debounced "N results found" live-region announcement, and the filter
 * input's own keyboard shortcuts (ArrowDown to jump into the tree, Escape to
 * clear). Modeled on the `$state`-fields-plus-`#options`-object shape of
 * `TreeDragController`.
 *
 * The debounce timer is bookkeeping only: `scheduleStatusAnnouncement` takes
 * an explicit `resultCount` rather than reading a `getVisibleCount` getter,
 * so the reactive dependency on `visibleIds.length` (a large, tree-shape-
 * dependent computation) stays owned by the `$effect` in `tree.svelte` that
 * calls it, not duplicated inside this class.
 */
export class TreeFilterController {
  uncontrolledValue = $state('');
  filterInputElement: HTMLInputElement | null = $state(null);
  statusAnnouncement = $state('');
  statusAnnouncementSequence = $state(0);
  statusBusy = $state(false);

  #statusTimer: ReturnType<typeof setTimeout> | null = null;
  readonly #options: TreeFilterControllerOptions;

  constructor(options: TreeFilterControllerOptions) {
    this.#options = options;
    this.uncontrolledValue = untrack(() => options.getFilterValue() ?? '');
  }

  get currentValue(): string {
    return this.#options.isControlled()
      ? (this.#options.getFilterValue() ?? '')
      : this.uncontrolledValue;
  }

  get normalizedValue(): string {
    return this.currentValue.trim();
  }

  get filtering(): boolean {
    return this.normalizedValue.length > 0;
  }

  update(next: string): void {
    if (!this.#options.isControlled()) this.uncontrolledValue = next;
    this.#options.onFilterChange?.(next);
  }

  scheduleStatusAnnouncement(resultCount: number): void {
    if (this.#statusTimer !== null) {
      clearTimeout(this.#statusTimer);
      this.#statusTimer = null;
    }

    if (!this.filtering) {
      this.statusBusy = false;
      this.statusAnnouncement = '';
      return;
    }

    const query = this.normalizedValue;
    this.statusBusy = true;
    this.#statusTimer = setTimeout(() => {
      this.statusAnnouncement =
        resultCount === 0
          ? `No results for ${query}.`
          : `${resultCount} result${resultCount === 1 ? '' : 's'} found.`;
      this.statusAnnouncementSequence += 1;
      this.statusBusy = false;
      this.#statusTimer = null;
    }, 500);
  }

  handleInput = (event: Event): void => {
    const target = event.currentTarget;
    if (!(target instanceof HTMLInputElement)) return;
    this.update(target.value);
  };

  handleKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.#options.focusFirstVisible();
      return;
    }

    if (event.key === 'Escape' && this.currentValue.length > 0) {
      event.preventDefault();
      event.stopPropagation();
      this.update('');
      this.filterInputElement?.focus();
    }
  };

  /** Clears any pending debounce timer. Call from the owner's unmount cleanup. */
  destroy(): void {
    if (this.#statusTimer !== null) {
      clearTimeout(this.#statusTimer);
      this.#statusTimer = null;
    }
  }
}
