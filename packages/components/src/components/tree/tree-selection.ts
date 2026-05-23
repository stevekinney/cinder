export type TreeSelectionState = {
  checked: boolean;
  indeterminate: boolean;
};

export function uniqueIds(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}

export function selectableIds(
  ids: readonly string[],
  disabledIds: ReadonlySet<string> = new Set(),
): string[] {
  return uniqueIds(ids).filter((id) => !disabledIds.has(id));
}

export function selectionStateFor(
  selectedIds: readonly string[],
  targetIds: readonly string[],
  _disabledIds: ReadonlySet<string> = new Set(),
): TreeSelectionState {
  const targets = uniqueIds(targetIds);
  if (targets.length === 0) return { checked: false, indeterminate: false };

  const selected = new Set(selectedIds);
  const selectedCount = targets.filter((id) => selected.has(id)).length;

  return {
    checked: selectedCount === targets.length,
    indeterminate: selectedCount > 0 && selectedCount < targets.length,
  };
}

export function selectIds(
  selectedIds: readonly string[],
  targetIds: readonly string[],
  disabledIds: ReadonlySet<string> = new Set(),
): string[] {
  const targets = selectableIds(targetIds, disabledIds);
  if (targets.length === 0) return [...selectedIds];

  const existing = new Set(selectedIds);
  const next = [...selectedIds];

  for (const id of targets) {
    if (!existing.has(id)) {
      existing.add(id);
      next.push(id);
    }
  }

  return next;
}

export function deselectIds(
  selectedIds: readonly string[],
  targetIds: readonly string[],
  disabledIds: ReadonlySet<string> = new Set(),
): string[] {
  const targetSet = new Set(selectableIds(targetIds, disabledIds));
  if (targetSet.size === 0) return [...selectedIds];
  return selectedIds.filter((id) => !targetSet.has(id));
}

export function toggleIndependentId(
  selectedIds: readonly string[],
  id: string,
  disabledIds: ReadonlySet<string> = new Set(),
): string[] {
  if (disabledIds.has(id)) return [...selectedIds];
  return selectedIds.includes(id)
    ? selectedIds.filter((selectedId) => selectedId !== id)
    : [...selectedIds, id];
}

export function toggleSelectionScope(
  selectedIds: readonly string[],
  targetIds: readonly string[],
  disabledIds: ReadonlySet<string> = new Set(),
): string[] {
  const targets = selectableIds(targetIds, disabledIds);
  if (targets.length === 0) return [...selectedIds];

  const state = selectionStateFor(selectedIds, targets);
  return state.checked
    ? deselectIds(selectedIds, targets, disabledIds)
    : selectIds(selectedIds, targets, disabledIds);
}
