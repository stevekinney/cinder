import type { TreeNodeRegistration } from './tree-registry.svelte.ts';

export type TreeDropPosition = 'before' | 'after' | 'child';

export type TreeDropTarget = {
  id: string;
  position: TreeDropPosition;
};

export type TreeReorderTarget = TreeDropTarget & {
  fromParentId: string | null;
  toParentId: string | null;
};

export type TreeMoveNode = {
  id: string;
  parentId: string | null;
};

type TreeDragControllerOptions = {
  getVisibleIds: () => readonly string[];
  getNode: (id: string) => TreeNodeRegistration | undefined;
  getParentId: (id: string) => string | null | undefined;
  isBranch: (id: string) => boolean;
  focus: (id: string) => void;
  announce: (message: string) => void;
  commit: (draggedId: string, target: TreeReorderTarget) => void;
};

export class TreeDragController {
  phase = $state<'idle' | 'dragging'>('idle');
  draggedId = $state<string | null>(null);
  dropTarget = $state<TreeDropTarget | null>(null);

  readonly #options: TreeDragControllerOptions;

  constructor(options: TreeDragControllerOptions) {
    this.#options = options;
  }

  get dragging(): boolean {
    return this.phase === 'dragging';
  }

  isDragging(id: string): boolean {
    return this.draggedId === id;
  }

  isDropTarget(id: string, position?: TreeDropPosition): boolean {
    if (this.dropTarget?.id !== id) return false;
    return position === undefined || this.dropTarget.position === position;
  }

  lift(id: string): void {
    if (this.phase !== 'idle') return;
    this.phase = 'dragging';
    this.draggedId = id;
    this.dropTarget = null;
    const visibleIds = this.#options.getVisibleIds();
    const position = Math.max(1, visibleIds.indexOf(id) + 1);
    this.#options.announce(
      `${this.#labelFor(id)}, lifted. Position ${position} of ${visibleIds.length} ${this.#parentPhrase(id)}. Arrow keys to move, Space to drop, Escape to cancel.`,
    );
  }

  moveBy(delta: 1 | -1): void {
    if (this.phase !== 'dragging' || !this.draggedId) return;
    const visibleIds = this.#options.getVisibleIds();
    if (visibleIds.length === 0) return;
    const currentId = this.dropTarget?.id ?? this.draggedId;
    const currentIndex = Math.max(0, visibleIds.indexOf(currentId));
    let nextIndex = currentIndex + delta;
    while (nextIndex >= 0 && nextIndex < visibleIds.length) {
      const nextId = visibleIds[nextIndex];
      const target: TreeDropTarget | null = nextId
        ? { id: nextId, position: delta > 0 ? 'after' : 'before' }
        : null;
      if (target && this.#setValidDropTarget(target)) {
        this.#options.announce(
          `${this.#labelFor(this.draggedId)}, moved ${this.#targetPhrase(target)}.`,
        );
        return;
      }
      nextIndex += delta;
    }
  }

  moveToEdge(edge: 'first' | 'last'): void {
    if (this.phase !== 'dragging' || !this.draggedId) return;
    const visibleIds = this.#options.getVisibleIds();
    const candidates = edge === 'first' ? visibleIds : [...visibleIds].toReversed();
    for (const targetId of candidates) {
      const target: TreeDropTarget = {
        id: targetId,
        position: edge === 'first' ? 'before' : 'after',
      };
      if (this.#setValidDropTarget(target)) {
        this.#options.announce(
          `${this.#labelFor(this.draggedId)}, moved ${this.#targetPhrase(target)}.`,
        );
        return;
      }
    }
  }

  moveIntoPreviousBranch(): void {
    if (this.phase !== 'dragging' || !this.draggedId) return;
    const visibleIds = this.#options.getVisibleIds();
    const currentId = this.dropTarget?.id ?? this.draggedId;
    const currentIndex = visibleIds.indexOf(currentId);
    const before = visibleIds.slice(0, Math.max(0, currentIndex)).toReversed();
    const branchId = before.find(
      (id) => this.#isValidDropTarget({ id, position: 'child' }) && this.#options.isBranch(id),
    );
    if (!branchId || !this.#setValidDropTarget({ id: branchId, position: 'child' })) return;
    this.#options.announce(
      `${this.#labelFor(this.draggedId)}, moved into ${this.#labelFor(branchId)}.`,
    );
  }

  moveOut(): void {
    if (this.phase !== 'dragging' || !this.draggedId) return;
    const parentId = this.#options.getParentId(this.draggedId);
    if (!parentId) return;
    if (!this.#setValidDropTarget({ id: parentId, position: 'after' })) return;
    this.#options.announce(
      `${this.#labelFor(this.draggedId)}, moved out after ${this.#labelFor(parentId)}.`,
    );
  }

  setDropTarget(target: TreeDropTarget | null): void {
    if (this.phase !== 'dragging') return;
    this.#setValidDropTarget(target);
  }

  drop(): void {
    if (this.phase !== 'dragging' || !this.draggedId) return;
    if (!this.#isValidDropTarget(this.dropTarget)) {
      const focusId = this.draggedId;
      this.#options.announce(`${this.#labelFor(focusId)}, no reorder target selected.`);
      this.#reset();
      this.#options.focus(focusId);
      return;
    }
    const target = this.#reorderTarget(this.draggedId, this.dropTarget);
    this.#options.commit(this.draggedId, target);
    this.#options.announce(
      `${this.#labelFor(this.draggedId)}, dropped ${this.#targetPhrase(this.dropTarget)}.`,
    );
    const focusId = this.draggedId;
    this.#reset();
    this.#options.focus(focusId);
  }

  cancel(): void {
    if (this.phase !== 'dragging') return;
    const focusId = this.draggedId;
    const label = focusId ? this.#labelFor(focusId) : 'Item';
    this.#options.announce(`${label}, reorder cancelled.`);
    this.#reset();
    if (focusId) this.#options.focus(focusId);
  }

  targetFromPointer(pointerY: number, element: HTMLElement): TreeDropTarget | null {
    const item = element.closest<HTMLElement>('[data-cinder-tree-item-id]');
    if (!item) return null;
    const id = item.dataset['cinderTreeItemId'];
    if (!id || id === this.draggedId) return null;
    const rect = item.getBoundingClientRect();
    const offset = pointerY - rect.top;
    const topThreshold = rect.height * 0.25;
    const bottomThreshold = rect.height * 0.75;
    const target =
      offset < topThreshold
        ? { id, position: 'before' as const }
        : offset > bottomThreshold
          ? { id, position: 'after' as const }
          : this.#options.isBranch(id)
            ? { id, position: 'child' as const }
            : { id, position: 'after' as const };
    return this.#isValidDropTarget(target) ? target : null;
  }

  #setValidDropTarget(target: TreeDropTarget | null): boolean {
    if (!target) {
      this.dropTarget = null;
      return true;
    }
    if (!this.#isValidDropTarget(target)) return false;
    this.dropTarget = target;
    return true;
  }

  #isValidDropTarget(target: TreeDropTarget | null): target is TreeDropTarget {
    if (!this.draggedId || !target || target.id === this.draggedId) return false;
    let currentId: string | null | undefined = target.id;
    while (currentId) {
      if (currentId === this.draggedId) return false;
      currentId = this.#options.getParentId(currentId);
    }
    return true;
  }

  #reorderTarget(draggedId: string, dropTarget: TreeDropTarget): TreeReorderTarget {
    const fromParentId = this.#options.getParentId(draggedId) ?? null;
    const toParentId =
      dropTarget.position === 'child'
        ? dropTarget.id
        : (this.#options.getParentId(dropTarget.id) ?? null);
    return { ...dropTarget, fromParentId, toParentId };
  }

  #labelFor(id: string): string {
    return this.#options.getNode(id)?.label() ?? id;
  }

  #parentPhrase(id: string): string {
    const parentId = this.#options.getParentId(id);
    return parentId ? `in ${this.#labelFor(parentId)}` : 'in root';
  }

  #targetPhrase(target: TreeDropTarget): string {
    if (target.position === 'child') return `into ${this.#labelFor(target.id)}`;
    return `${target.position} ${this.#labelFor(target.id)}`;
  }

  #reset(): void {
    this.phase = 'idle';
    this.draggedId = null;
    this.dropTarget = null;
  }
}

export function moveTreeNode<Node extends TreeMoveNode>(
  nodes: readonly Node[],
  draggedId: string,
  target: TreeDropTarget,
): Node[] {
  const dragged = nodes.find((node) => node.id === draggedId);
  const targetNode = nodes.find((node) => node.id === target.id);
  if (!dragged || !targetNode) return [...nodes];

  const subtreeIds = descendantIds(nodes, draggedId);
  subtreeIds.add(draggedId);
  if (subtreeIds.has(target.id)) return [...nodes];

  const withoutSubtree = nodes.filter((node) => !subtreeIds.has(node.id));
  const subtree = nodes.filter((node) => subtreeIds.has(node.id));
  const nextParentId = target.position === 'child' ? target.id : targetNode.parentId;
  const movedSubtree = subtree.map((node) =>
    node.id === draggedId ? ({ ...node, parentId: nextParentId } as Node) : node,
  );

  const insertionIndex = insertionIndexFor(withoutSubtree, target);
  const currentWithoutSubtreeIndex = withoutSubtree.findIndex((node) => node.id === draggedId);
  if (currentWithoutSubtreeIndex === insertionIndex && dragged.parentId === nextParentId) {
    return [...nodes];
  }
  return [
    ...withoutSubtree.slice(0, insertionIndex),
    ...movedSubtree,
    ...withoutSubtree.slice(insertionIndex),
  ];
}

function descendantIds(nodes: readonly TreeMoveNode[], id: string): Set<string> {
  const descendants = new Set<string>();
  const visit = (parentId: string) => {
    for (const node of nodes) {
      if (node.parentId !== parentId || descendants.has(node.id)) continue;
      descendants.add(node.id);
      visit(node.id);
    }
  };
  visit(id);
  return descendants;
}

function insertionIndexFor(nodes: readonly TreeMoveNode[], target: TreeDropTarget): number {
  const targetIndex = nodes.findIndex((node) => node.id === target.id);
  if (targetIndex < 0) return nodes.length;
  if (target.position === 'before') return targetIndex;
  if (target.position === 'child') return targetIndex + 1;
  const targetSubtree = descendantIds(nodes, target.id);
  let index = targetIndex + 1;
  while (index < nodes.length && targetSubtree.has(nodes[index]!.id)) index += 1;
  return index;
}
