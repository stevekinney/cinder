import type { TreeNodeRegistration } from './tree-registry.svelte.ts';

// Inline the selection mode type here to avoid a circular import with
// tree.svelte (which imports TreeContext from this file).
type TreeSelectionMode = 'none' | 'single' | 'multiple';

/**
 * Shape of the context object provided by Tree to all descendant TreeItems.
 *
 * Kept in a plain `.ts` file (no runes) so it can be imported by both
 * `tree.svelte` and `tree-item.svelte` without triggering the Svelte compiler's
 * rune-only constraint on `.svelte.ts` files.
 *
 * The context object itself lives in `tree.svelte` (instance block); this file
 * only holds the shared type.
 */
export type TreeContext = {
  readonly selectionMode: TreeSelectionMode;
  readonly multiselectable: boolean;
  readonly typeaheadEnabled: boolean;
  /** Reactive getter — reading inside $derived registers cross-component dependency. */
  readonly expandedIds: readonly string[];
  /** Reactive getter — reading inside $derived registers cross-component dependency. */
  readonly selectedIds: readonly string[];
  /** Reactive getter — reading inside $derived registers cross-component dependency. */
  readonly focusedId: string | null;
  isExpanded(id: string): boolean;
  isSelected(id: string): boolean;
  isFocused(id: string): boolean;
  setExpanded(id: string, next: boolean): void;
  toggleSelected(id: string, event: KeyboardEvent | MouseEvent | null): void;
  register(node: TreeNodeRegistration): () => void;
  focusVisibleDelta(currentId: string, delta: number): void;
  focusFirstVisible(): void;
  focusLastVisible(): void;
  focusParent(currentId: string): void;
  focusFirstChild(currentId: string): void;
  handleTypeahead(char: string, currentId: string): void;
  expandSiblings(currentId: string): void;
  /** Called by TreeItem on native focus so focusedId stays in sync. */
  notifyFocus(id: string): void;
};

/** Context value passed down the tree item hierarchy to track nesting. */
export type TreeItemParentContext = {
  parentId: string | null;
  level: number;
};
