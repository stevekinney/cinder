import { createContext } from 'svelte';

import type { TreeSelectionState } from '../components/tree/tree-selection.ts';
import { optionalContext } from './optional-context.ts';
import type { TreeDragController } from './tree-drag-controller.svelte.ts';
import type { TreeNodeRegistration } from './tree-registry.svelte.ts';

// Inline the selection mode type here to avoid a circular import with
// tree.svelte (which imports TreeContext from this file).
type TreeSelectionMode = 'none' | 'single' | 'multiple';
type TreeSelectionBehavior = 'independent' | 'cascade';

export type TreeItemSelectionState = TreeSelectionState;

/**
 * Shape of the context object provided by Tree to all descendant TreeItems.
 *
 * Kept in a plain `.ts` file (no runes) so it can be imported by both
 * `tree.svelte` and `tree-item.svelte` without triggering the Svelte compiler's
 * rune-only constraint on `.svelte.ts` files.
 *
 * The context object itself lives in `tree.svelte` (instance block); this file
 * only holds the shared type and the typed context handles.
 */
export type TreeContext = {
  readonly selectionMode: TreeSelectionMode;
  readonly selectionBehavior: TreeSelectionBehavior;
  readonly checkboxSelection: boolean;
  readonly multiselectable: boolean;
  readonly typeaheadEnabled: boolean;
  /** Reactive getter — reading inside $derived registers cross-component dependency. */
  readonly expandedIds: readonly string[];
  /** Reactive getter — reading inside $derived registers cross-component dependency. */
  readonly selectedIds: readonly string[];
  /** Reactive getter — reading inside $derived registers cross-component dependency. */
  readonly focusedId: string | null;
  readonly filtering: boolean;
  readonly filterValue: string;
  readonly hasRegisteredItems: boolean;
  readonly expandableBranchCount: number;
  readonly hasExpandedItems: boolean;
  readonly dragController: TreeDragController | null;
  readonly dragInstructionsId: string;
  isExpanded(id: string): boolean;
  isSelected(id: string): boolean;
  isFocused(id: string): boolean;
  isVisible(id: string): boolean;
  hasVisibleDescendant(id: string): boolean;
  matchesFilter(label: string, id: string): boolean;
  checkboxSelectionActive(): boolean;
  selectionStateFor(id: string): TreeItemSelectionState;
  toggleSelectionScope(id: string): void;
  selectSelectionScope(parentId: string | null, next: boolean, includeDescendants: boolean): void;
  hasSelectableSelectionScope(parentId: string | null, includeDescendants: boolean): boolean;
  selectionTargetsFor(id: string): readonly string[];
  selectionTargetsForChildren(
    parentId: string | null,
    includeDescendants: boolean,
  ): readonly string[];
  setExpanded(id: string, next: boolean): void;
  expandAll(): Promise<void>;
  collapseAll(): void;
  expandOneLevel(): void;
  focusItem(id: string): void;
  expandToItem(id: string): Promise<void>;
  scrollToRow(id: string, options?: ScrollIntoViewOptions): void;
  toggleSelected(id: string, event: KeyboardEvent | MouseEvent | null): void;
  register(node: TreeNodeRegistration): () => void;
  focusVisibleDelta(currentId: string, delta: number): void;
  canFocusVisibleDelta(currentId: string, delta: number): boolean;
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

const [getTreeContextStrict, setTreeContextRaw] = createContext<TreeContext>();

export { setTreeContextRaw as setTreeContext };

/**
 * Required read — a TreeItem or TreeSelectAll outside a Tree is a programmer
 * error; the strict getter throws automatically when no provider exists.
 */
export const getTreeContext: () => TreeContext = getTreeContextStrict;

const [getTreeItemParentContextStrict, setTreeItemParentContextRaw] =
  createContext<TreeItemParentContext>();

export { setTreeItemParentContextRaw as setTreeItemParentContext };

/**
 * Optional read — a TreeItem at the root level has no TreeItem parent provider;
 * a missing context is a valid state (top-level item, parentId = null, level = 1).
 */
export const tryGetTreeItemParentContext: () => TreeItemParentContext | undefined = optionalContext(
  getTreeItemParentContextStrict,
);
