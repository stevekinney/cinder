import { SvelteMap } from 'svelte/reactivity';

/** A single registered tree node. */
export type TreeNodeRegistration = {
  id: string;
  parentId: string | null;
  level: number;
  disabled: boolean;
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
   * Returns the flat list of node ids in DFS visible order, respecting the
   * current expansion state. Collapsed subtrees are excluded entirely.
   */
  getVisible(expandedIds: readonly string[]): string[] {
    const result: string[] = [];
    const expandedSet = new Set(expandedIds);

    const visit = (parentId: string | null): void => {
      const childIds = this.#children.get(parentId) ?? [];
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
    return this.#children.get(id)?.[0];
  }

  siblingsOf(id: string): string[] {
    const node = this.#nodes.get(id);
    if (!node) return [];
    return this.#children.get(node.parentId) ?? [];
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

    // Search from item after current, then wrap around to the start
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
