export type TreeDataItem = {
  id: string;
  label: string;
  disabled?: boolean;
  children?: readonly TreeDataItem[];
};

export type FlattenedTreeDataItem = {
  id: string;
  label: string;
  disabled: boolean;
  parentId: string | null;
  level: number;
  branch: boolean;
  index: number;
  posInSet: number;
  setSize: number;
  ancestorIds: readonly string[];
};

export type TreeDataFilterPredicate = (item: FlattenedTreeDataItem) => boolean;

export function flattenTreeDataItems(items: readonly TreeDataItem[]): FlattenedTreeDataItem[] {
  const flattenedItems: FlattenedTreeDataItem[] = [];

  const visit = (
    children: readonly TreeDataItem[],
    parentId: string | null,
    level: number,
    ancestorIds: readonly string[],
  ): void => {
    const setSize = children.length;
    children.forEach((item, siblingIndex) => {
      const branch = (item.children?.length ?? 0) > 0;
      const flattenedItem: FlattenedTreeDataItem = {
        id: item.id,
        label: item.label,
        disabled: item.disabled ?? false,
        parentId,
        level,
        branch,
        index: flattenedItems.length,
        posInSet: siblingIndex + 1,
        setSize,
        ancestorIds,
      };
      flattenedItems.push(flattenedItem);
      if (branch) {
        visit(item.children ?? [], item.id, level + 1, [...ancestorIds, item.id]);
      }
    });
  };

  visit(items, null, 1, []);
  return flattenedItems;
}

export function visibleTreeDataItems(
  flattenedItems: readonly FlattenedTreeDataItem[],
  expandedIds: readonly string[],
  filterPredicate?: TreeDataFilterPredicate,
): FlattenedTreeDataItem[] {
  if (filterPredicate) {
    const byId = new Map(flattenedItems.map((item) => [item.id, item]));
    const retainedIds = new Set<string>();
    for (const item of flattenedItems) {
      if (!filterPredicate(item)) continue;
      retainedIds.add(item.id);
      for (const ancestorId of item.ancestorIds) {
        if (byId.has(ancestorId)) retainedIds.add(ancestorId);
      }
    }
    return flattenedItems.filter((item) => retainedIds.has(item.id));
  }

  const expandedIdSet = new Set(expandedIds);
  return flattenedItems.filter((item) =>
    item.ancestorIds.every((ancestorId) => expandedIdSet.has(ancestorId)),
  );
}

export function descendantTreeDataIds(
  flattenedItems: readonly FlattenedTreeDataItem[],
  parentId: string,
): string[] {
  const parent = flattenedItems.find((item) => item.id === parentId);
  if (!parent) return [];
  return flattenedItems
    .filter((item) => item.ancestorIds.includes(parentId) && item.level > parent.level)
    .map((item) => item.id);
}
