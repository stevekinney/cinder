import type { TableHeaderProps } from './table-header.types.ts';

const _valid: TableHeaderProps = {
  children: undefined as unknown as TableHeaderProps['children'],
  allSelected: true,
  someSelected: false,
  onSelectAll: () => {},
};

const _validNoSelection: TableHeaderProps = {
  children: undefined as unknown as TableHeaderProps['children'],
};

// @ts-expect-error - allSelected without the other two required members of TableHeaderSelectionProps
const _invalid: TableHeaderProps = {
  children: undefined as unknown as TableHeaderProps['children'],
  allSelected: true,
};

void _valid;
void _validNoSelection;
void _invalid;
