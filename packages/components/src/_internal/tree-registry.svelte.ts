import { SvelteMap } from 'svelte/reactivity';

import { inDocumentOrder } from '../utilities/document-order.ts';

/** A single registered tree node. */
export type TreeNodeRegistration = {
  id: string;
  parentId: string | null;
  level: number;
  /** The outer role="treeitem" DOM node, used for document-order sorting. */
  node: HTMLElement;
  /** Getter so runtime prop changes stay in sync without re-registration. */
  readonly disabled: boolean;
  selectionScopeIds?: () => readonly string[] | undefined;
  isBranch: () => boolean;
  label: () => string;
  /** DOM-focus the outer role="treeitem" element. */
  focus: () => void;
};

/**
 * Reactive registry for tree nodes. Tracks registration order (DOM mount
 * order), parent/child relationships, and computes a flat visible-order list
 * via DFS over the current expansion state.
 *
 * Stored in a `.svelte.ts` module so runes (`$state`, `$derived`) are valid.
 */
export class TreeRegistry {
  readonly #nodes = new SvelteMap<string, TreeNodeRegistration>();
  /** Ordered child lists, keyed by parentId (null = root level). */
  readonly #children = new SvelteMap<string | null, string[]>();

  register(node: TreeNodeRegistration): () => void {
    if (this.#nodes.has(node.id)) {
      throw new Error(
        `[cinder-tree] Duplicate TreeItem id: "${node.id}". All node ids must be unique within the tree.`,
      );
    }

    this.#nodes.set(node.id, node);

    const siblings = this.#children.get(node.parentId) ?? [];
    this.#children.set(node.parentId, [...siblings, node.id]);

    return () => {
      this.#nodes.delete(node.id);
      const remaining = (this.#children.get(node.parentId) ?? []).filter((id) => id !== node.id);
      if (remaining.length === 0) {
        this.#children.delete(node.parentId);
      } else {
        this.#children.set(node.parentId, remaining);
      }
    };
  }

  /**
   * Returns the ordered child id list for a parent, sorted by DOM document
   * order. Registration order normally matches DOM order because {@attach}
   * fires after mount, but conditional ({#if}) blocks that re-mount middle
   * items can desync the registry. Sorting on read keeps navigation aligned
   * with the visual tree.
   */
  #orderedChildren(parentId: string | null): string[] {
    const ids = this.#children.get(parentId);
    if (!ids || ids.length <= 1) return ids ?? [];
    const withNodes = ids
      .map((id) => ({ id, node: this.#nodes.get(id)?.node }))
      .filter((entry): entry is { id: string; node: HTMLElement } => entry.node !== undefined);
    return inDocumentOrder(withNodes).map((entry) => entry.id);
  }

  /**
   * Returns the flat list of node ids in DFS visible order, respecting the
   * current expansion state. Collapsed subtrees are excluded entirely.
   */
  getVisible(expandedIds: readonly string[]): string[] {
    const result: string[] = [];
    const expandedSet = new Set(expandedIds);

    const visit = (parentId: string | null): void => {
      const childIds = this.#orderedChildren(parentId);
      for (const id of childIds) {
        result.push(id);
        const node = this.#nodes.get(id);
        if (node?.isBranch() && expandedSet.has(id)) {
          visit(id);
        }
      }
    };

    visit(null);
    return result;
  }

  getNode(id: string): TreeNodeRegistration | undefined {
    return this.#nodes.get(id);
  }

  parentOf(id: string): string | null | undefined {
    return this.#nodes.get(id)?.parentId;
  }

  firstChildOf(id: string): string | undefined {
    return this.#orderedChildren(id)[0];
  }

  childrenOf(parentId: string | null): string[] {
    return this.#orderedChildren(parentId);
  }

  descendantsOf(parentId: string): string[] {
    const result: string[] = [];

    const visit = (id: string): void => {
      for (const childId of this.#orderedChildren(id)) {
        result.push(childId);
        visit(childId);
      }
    };

    visit(parentId);
    return result;
  }

  siblingsOf(id: string): string[] {
    const node = this.#nodes.get(id);
    if (!node) return [];
    return this.#orderedChildren(node.parentId);
  }

  /**
   * Returns the next visible item id whose label starts with `prefix`
   * (case-insensitive), searching forward from `currentId` and wrapping.
   * Returns `undefined` when no match found.
   */
  typeaheadMatch(
    prefix: string,
    currentId: string,
    expandedIds: readonly string[],
  ): string | undefined {
    const visible = this.getVisible(expandedIds);
    const lower = prefix.toLowerCase();
    const startIndex = visible.indexOf(currentId);

    // Search from item after current, then wrap around to the start.
    // visible[index] is always defined: index = (startIndex + offset) % visible.length
    // and we only enter this loop when visible.length > 0 (offset <= visible.length guard).
    for (let offset = 1; offset <= visible.length; offset++) {
      const index = (startIndex + offset) % visible.length;
      const id = visible[index]!;
      const node = this.#nodes.get(id);
      if (node && node.label().toLowerCase().startsWith(lower)) {
        return id;
      }
    }
    return undefined;
  }
}
