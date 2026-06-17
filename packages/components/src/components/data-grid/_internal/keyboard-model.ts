export type DataGridKeyboardAction =
  | {
      type: 'move-cell';
      rowIndex: number;
      columnIndex: number;
      extend: boolean;
    }
  | {
      type: 'copy-selection';
    }
  | {
      type: 'select-all';
    }
  | {
      type: 'collapse-selection';
    };

export type DataGridKeyboardContext = {
  activeRowIndex: number;
  activeColumnIndex: number;
  rowCount: number;
  columnCount: number;
  pageSize?: number;
};

export function dataGridKeyToAction(
  event: KeyboardEvent,
  context: DataGridKeyboardContext,
): DataGridKeyboardAction | undefined {
  const { activeRowIndex, activeColumnIndex, rowCount, columnCount, pageSize = 10 } = context;
  if (rowCount === 0 || columnCount === 0) return undefined;

  const extend = event.shiftKey;
  const isCommand = event.ctrlKey || event.metaKey;

  if (isCommand && event.key.toLowerCase() === 'a') return { type: 'select-all' };
  if (isCommand && event.key.toLowerCase() === 'c') return { type: 'copy-selection' };
  if (event.key === 'Escape') return { type: 'collapse-selection' };

  if (event.key === 'ArrowRight') {
    return {
      type: 'move-cell',
      rowIndex: activeRowIndex,
      columnIndex: activeColumnIndex + 1,
      extend,
    };
  }

  if (event.key === 'ArrowLeft') {
    return {
      type: 'move-cell',
      rowIndex: activeRowIndex,
      columnIndex: activeColumnIndex - 1,
      extend,
    };
  }

  if (event.key === 'ArrowDown') {
    return {
      type: 'move-cell',
      rowIndex: activeRowIndex + 1,
      columnIndex: activeColumnIndex,
      extend,
    };
  }

  if (event.key === 'ArrowUp') {
    return {
      type: 'move-cell',
      rowIndex: activeRowIndex - 1,
      columnIndex: activeColumnIndex,
      extend,
    };
  }

  if (event.key === 'Home') {
    return {
      type: 'move-cell',
      rowIndex: isCommand ? 0 : activeRowIndex,
      columnIndex: 0,
      extend,
    };
  }

  if (event.key === 'End') {
    return {
      type: 'move-cell',
      rowIndex: isCommand ? rowCount - 1 : activeRowIndex,
      columnIndex: columnCount - 1,
      extend,
    };
  }

  if (event.key === 'PageDown') {
    return {
      type: 'move-cell',
      rowIndex: activeRowIndex + pageSize,
      columnIndex: activeColumnIndex,
      extend,
    };
  }

  if (event.key === 'PageUp') {
    return {
      type: 'move-cell',
      rowIndex: activeRowIndex - pageSize,
      columnIndex: activeColumnIndex,
      extend,
    };
  }

  if (event.key === 'Tab') {
    const direction = event.shiftKey ? -1 : 1;
    const nextCellIndex = activeRowIndex * columnCount + activeColumnIndex + direction;
    const clampedCellIndex = Math.min(Math.max(nextCellIndex, 0), rowCount * columnCount - 1);
    return {
      type: 'move-cell',
      rowIndex: Math.floor(clampedCellIndex / columnCount),
      columnIndex: clampedCellIndex % columnCount,
      extend: false,
    };
  }

  return undefined;
}
