import type { TreeDragController } from '../../_internal/tree-drag-controller.svelte.ts';

export type TreeItemDragHandlersOptions = {
  getDragController: () => TreeDragController | null;
  getId: () => string;
  getLabel: () => string;
  /**
   * `canDrag` depends on the `draggable` prop and the `disabled` prop, both
   * component-level concerns this class has no reason to know about — the
   * component computes the boolean and hands it in.
   */
  getCanDrag: () => boolean;
  getDragHandleElement: () => HTMLButtonElement | undefined;
  getOuterElement: () => HTMLElement | undefined;
};

/**
 * Drag/reorder interaction for a single tree item: keyboard lift-and-move,
 * pointer lift, and the derived drag/drop-target booleans the template reads.
 * Modeled on the `$state`-fields-plus-`#options`-object shape of
 * `TreeDragController` — this class does not own drag STATE itself (that
 * lives on the shared `TreeDragController` from tree context), it only
 * translates this item's DOM events into calls against it.
 */
export class TreeItemDragHandlers {
  #dragKeyboardReturnTarget: HTMLElement | undefined;
  readonly #options: TreeItemDragHandlersOptions;

  constructor(options: TreeItemDragHandlersOptions) {
    this.#options = options;
  }

  get canDrag(): boolean {
    return this.#options.getCanDrag();
  }

  get isDraggingItem(): boolean {
    return this.#options.getDragController()?.isDragging(this.#options.getId()) ?? false;
  }

  get isDropBefore(): boolean {
    return (
      this.#options.getDragController()?.isDropTarget(this.#options.getId(), 'before') ?? false
    );
  }

  get isDropAfter(): boolean {
    return this.#options.getDragController()?.isDropTarget(this.#options.getId(), 'after') ?? false;
  }

  get isDropInto(): boolean {
    return this.#options.getDragController()?.isDropTarget(this.#options.getId(), 'child') ?? false;
  }

  get dragHandleLabel(): string {
    return `Reorder ${this.#options.getLabel()}`;
  }

  #restoreDragKeyboardFocus(): void {
    const target =
      this.#dragKeyboardReturnTarget ??
      this.#options.getDragHandleElement() ??
      this.#options.getOuterElement();
    queueMicrotask(() => target?.focus());
  }

  #canLiftWithKeyboard(event: KeyboardEvent): boolean {
    const fromDragHandle = event.currentTarget === this.#options.getDragHandleElement();
    const treeItemShortcut =
      event.key === ' ' && event.ctrlKey && event.shiftKey && !event.altKey && !event.metaKey;
    return (fromDragHandle && (event.key === ' ' || event.key === 'Enter')) || treeItemShortcut;
  }

  handleKeyboard = (event: KeyboardEvent): boolean => {
    const controller = this.#options.getDragController();
    if (!this.canDrag || !controller) return false;

    if (!controller.dragging && this.#canLiftWithKeyboard(event)) {
      event.preventDefault();
      event.stopPropagation();
      this.#dragKeyboardReturnTarget =
        event.currentTarget instanceof HTMLElement ? event.currentTarget : undefined;
      controller.lift(this.#options.getId(), 'keyboard');
      this.#restoreDragKeyboardFocus();
      return true;
    }

    if (!controller.isDragging(this.#options.getId())) return false;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        event.stopPropagation();
        controller.moveBy(1);
        return true;
      case 'ArrowUp':
        event.preventDefault();
        event.stopPropagation();
        controller.moveBy(-1);
        return true;
      case 'ArrowRight':
        event.preventDefault();
        event.stopPropagation();
        controller.moveIntoPreviousBranch();
        return true;
      case 'ArrowLeft':
        event.preventDefault();
        event.stopPropagation();
        controller.moveOut();
        return true;
      case 'Home':
        event.preventDefault();
        event.stopPropagation();
        controller.moveToEdge('first');
        return true;
      case 'End':
        event.preventDefault();
        event.stopPropagation();
        controller.moveToEdge('last');
        return true;
      case 'F2':
        event.preventDefault();
        event.stopPropagation();
        return true;
      case 'Tab':
        event.stopPropagation();
        controller.cancel();
        return true;
      case ' ':
      case 'Enter':
        event.preventDefault();
        event.stopPropagation();
        controller.drop();
        this.#restoreDragKeyboardFocus();
        return true;
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        controller.cancel();
        this.#restoreDragKeyboardFocus();
        return true;
      default:
        return false;
    }
  };

  handlePointerDown = (event: PointerEvent): void => {
    const controller = this.#options.getDragController();
    if (!this.canDrag || !controller || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const dragHandleElement = this.#options.getDragHandleElement();
    dragHandleElement?.focus();
    dragHandleElement?.setPointerCapture(event.pointerId);
    controller.lift(this.#options.getId(), 'pointer');
  };

  handleClick = (event: MouseEvent): void => {
    event.stopPropagation();
  };
}
