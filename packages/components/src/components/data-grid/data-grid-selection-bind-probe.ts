import type { DataGridSelectionModel } from './data-grid.types.ts';

let observedSelectionModel: DataGridSelectionModel | undefined;

export function getObservedSelectionModel(): DataGridSelectionModel | undefined {
  return observedSelectionModel;
}

export function resetObservedSelectionModel(): void {
  observedSelectionModel = undefined;
}

export function observeSelectionModel(selectionModel: DataGridSelectionModel): void {
  observedSelectionModel = selectionModel;
}
