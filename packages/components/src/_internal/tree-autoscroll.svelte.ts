export type TreeAutoscrollControllerOptions = {
  isPointerDragging: () => boolean;
  /**
   * Called with the resolved drop-target element once autoscroll has
   * (re-)resolved a pointer position. Deliberately typed as `EventTarget |
   * null` rather than `HTMLElement | null`: this class has no reason to know
   * about `TreeDragController` or import it directly, so it hands the raw
   * clientX/clientY back alongside the resolved element and lets the owning
   * component (which already holds the drag controller) call
   * `dragController.targetFromPointer(clientY, target)` itself.
   */
  setDropTarget: (clientX: number, clientY: number, target: EventTarget | null) => void;
};

const AUTOSCROLL_EDGE_PX = 32;
const AUTOSCROLL_SPEED_PX = 8;

/**
 * Pointer-drag autoscroll for the tree's scroll container: while a pointer
 * drag is active and near the top/bottom edge, nudges `scrollTop` on every
 * animation frame and re-resolves the drop target as the content scrolls
 * underneath the pointer. Modeled on the `$state`-fields-plus-`#options`-
 * object shape of `TreeDragController` (private fields here since nothing
 * outside this class reads pointer position or scroll-element state).
 */
export class TreeAutoscrollController {
  #latestPointerX = 0;
  #latestPointerY = 0;
  #scrollElement: HTMLElement | null = null;
  #animationFrame: number | null = null;
  readonly #options: TreeAutoscrollControllerOptions;

  constructor(options: TreeAutoscrollControllerOptions) {
    this.#options = options;
  }

  #pointerTargetElement(
    clientX: number,
    clientY: number,
    fallbackTarget: EventTarget | null,
  ): HTMLElement | null {
    if (typeof document !== 'undefined') {
      const element = document.elementFromPoint(clientX, clientY);
      if (element instanceof HTMLElement) return element;
    }
    return fallbackTarget instanceof HTMLElement ? fallbackTarget : null;
  }

  #updateDragTargetFromPointer(
    clientX: number,
    clientY: number,
    fallbackTarget: EventTarget | null,
  ): void {
    const element = this.#pointerTargetElement(clientX, clientY, fallbackTarget);
    if (!element) return;
    this.#options.setDropTarget(clientX, clientY, element);
  }

  #scheduleAutoscroll(): void {
    if (
      this.#animationFrame !== null ||
      !this.#options.isPointerDragging() ||
      !this.#scrollElement ||
      typeof requestAnimationFrame !== 'function'
    ) {
      return;
    }

    this.#animationFrame = requestAnimationFrame(() => {
      this.#animationFrame = null;
      const tree = this.#scrollElement;
      if (!this.#options.isPointerDragging() || !tree) return;

      const rect = tree.getBoundingClientRect();
      const previousScrollTop = tree.scrollTop;
      if (this.#latestPointerY - rect.top < AUTOSCROLL_EDGE_PX) {
        tree.scrollTop -= AUTOSCROLL_SPEED_PX;
      } else if (rect.bottom - this.#latestPointerY < AUTOSCROLL_EDGE_PX) {
        tree.scrollTop += AUTOSCROLL_SPEED_PX;
      }

      if (tree.scrollTop === previousScrollTop) return;
      this.#updateDragTargetFromPointer(this.#latestPointerX, this.#latestPointerY, tree);
      this.#scheduleAutoscroll();
    });
  }

  handlePointerMove(event: PointerEvent, scrollElement: HTMLElement): void {
    if (!this.#options.isPointerDragging()) return;
    event.preventDefault();
    this.#latestPointerX = event.clientX;
    this.#latestPointerY = event.clientY;
    this.#scrollElement = scrollElement;
    this.#updateDragTargetFromPointer(event.clientX, event.clientY, event.target);
    this.#scheduleAutoscroll();
  }

  stop(): void {
    if (this.#animationFrame !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.#animationFrame);
    }
    this.#animationFrame = null;
    this.#scrollElement = null;
  }
}
