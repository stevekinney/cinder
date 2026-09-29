import type { TableHeaderProps } from './table-header.types.ts';

const valid: TableHeaderProps = {
  children: undefined as unknown as TableHeaderProps['children'],
  allSelected: true,
  someSelected: false,
  onSelectAll: () => {},
};

const validNoSelection: TableHeaderProps = {
  children: undefined as unknown as TableHeaderProps['children'],
};

// @ts-expect-error - allSelected without the other two required members of TableHeaderSelectionProps
const invalid: TableHeaderProps = {
  children: undefined as unknown as TableHeaderProps['children'],
  allSelected: true,
};

void valid;
void validNoSelection;
void invalid;
