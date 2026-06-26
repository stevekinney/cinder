import { SvelteMap } from 'svelte/reactivity';

import { inDocumentOrder } from '../utilities/document-order.ts';
import { findTypeaheadMatch } from '../utilities/typeahead.ts';

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
  bulkExpandable?: () => boolean;
  label: () => string;
  /** DOM-focus the outer role="treeitem" element. */
  focus: () => void;
};

export type TreeVisibilityCandidate = {
  id: string;
  label: string;
  parentId: string | null;
  level: number;
};

export type TreeVisibilityPredicate = (candidate: TreeVisibilityCandidate) => boolean;

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

  get size(): number {
    return this.#nodes.size;
  }

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
   * current expansion state. Collapsed subtrees are excluded entirely unless a
   * filter predicate is supplied, in which case matching nodes and their
   * ancestors are retained.
   */
  getVisible(
    expandedIds: readonly string[],
    visibilityPredicate?: TreeVisibilityPredicate,
  ): string[] {
    const result: string[] = [];
    const expandedSet = new Set(expandedIds);
    const retainedIds = visibilityPredicate
      ? this.#retainedIdsForPredicate(visibilityPredicate)
      : undefined;

    const visit = (parentId: string | null): void => {
      const childIds = this.#orderedChildren(parentId);
      for (const id of childIds) {
        if (retainedIds && !retainedIds.has(id)) continue;
        result.push(id);
        const node = this.#nodes.get(id);
        if (node?.isBranch() && (expandedSet.has(id) || retainedIds?.has(id))) {
          visit(id);
        }
      }
    };

    visit(null);
    return result;
  }

  #retainedIdsForPredicate(visibilityPredicate: TreeVisibilityPredicate): Set<string> {
    const retainedIds = new Set<string>();

    for (const [id, node] of this.#nodes) {
      if (
        !visibilityPredicate({
          id,
          label: node.label(),
          parentId: node.parentId,
          level: node.level,
        })
      ) {
        continue;
      }

      retainedIds.add(id);
      let parentId = node.parentId;
      while (parentId !== null) {
        retainedIds.add(parentId);
        parentId = this.parentOf(parentId) ?? null;
      }
    }

    return retainedIds;
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

  getAllBranchIds(options: { bulkOnly?: boolean } = {}): string[] {
    const result: string[] = [];

    const visit = (parentId: string | null): void => {
      for (const id of this.#orderedChildren(parentId)) {
        const node = this.#nodes.get(id);
        if (!node?.isBranch()) continue;
        if (!options.bulkOnly || this.isBulkExpandableBranch(id)) {
          result.push(id);
        }
        visit(id);
      }
    };

    visit(null);
    return result;
  }

  isBulkExpandableBranch(id: string): boolean {
    const node = this.#nodes.get(id);
    return Boolean(node?.isBranch() && (node.bulkExpandable?.() ?? true));
  }

  ancestorsOf(id: string): string[] {
    const result: string[] = [];
    let parentId = this.parentOf(id);

    while (parentId !== null && parentId !== undefined) {
      result.push(parentId);
      parentId = this.parentOf(parentId);
    }

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
    visibilityPredicate?: TreeVisibilityPredicate,
  ): string | undefined {
    const visible = this.getVisible(expandedIds, visibilityPredicate);
    return findTypeaheadMatch(
      visible.map((id) => {
        const node = this.#nodes.get(id);
        return {
          value: id,
          label: node?.label() ?? '',
        };
      }),
      prefix,
      visible.indexOf(currentId),
    );
  }
}
