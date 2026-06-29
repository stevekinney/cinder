import type { MultiSelectItem, MultiSelectProps } from './multi-select.types.ts';

const fruitItems = [
  { id: 'apple', label: 'Apple' },
  { id: 'banana', label: 'Banana' },
  { id: 'cherry', label: 'Cherry' },
] satisfies MultiSelectItem<'apple' | 'banana' | 'cherry'>[];

const _valid: MultiSelectProps<'apple' | 'banana' | 'cherry'> = {
  id: 'fruit',
  items: fruitItems,
  selectedIds: ['apple'],
};

const _empty: MultiSelectProps<'apple' | 'banana' | 'cherry'> = {
  id: 'fruit',
  items: fruitItems,
};

const _invalid: MultiSelectProps<'apple' | 'banana' | 'cherry'> = {
  id: 'fruit',
  items: fruitItems,
  // @ts-expect-error - invalid item id
  selectedIds: ['durian'],
};

declare function mountMultiSelect<const T extends string>(
  props: { items: readonly MultiSelectItem<T>[] } & MultiSelectProps<T>,
): void;

mountMultiSelect({
  id: 'fruit',
  items: [
    { id: 'apple', label: 'Apple' },
    { id: 'banana', label: 'Banana' },
  ],
  selectedIds: ['apple'],
});

mountMultiSelect({
  id: 'fruit',
  items: [
    { id: 'apple', label: 'Apple' },
    { id: 'banana', label: 'Banana' },
  ],
  // @ts-expect-error - must not widen inferred id union
  selectedIds: ['durian'],
});

void _valid;
void _empty;
void _invalid;
