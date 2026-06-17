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
    }
  | {
      type: 'select-active-cell';
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
  if (event.key === 'Enter' || event.key === ' ') return { type: 'select-active-cell' };

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
    const lastCellIndex = rowCount * columnCount - 1;
    if (nextCellIndex < 0 || nextCellIndex > lastCellIndex) return undefined;

    return {
      type: 'move-cell',
      rowIndex: Math.floor(nextCellIndex / columnCount),
      columnIndex: nextCellIndex % columnCount,
      extend: false,
    };
  }

  return undefined;
}
