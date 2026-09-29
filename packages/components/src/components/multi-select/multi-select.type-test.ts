import type { MultiSelectItem, MultiSelectProps } from './multi-select.types.ts';

const fruitItems = [
  { id: 'apple', label: 'Apple' },
  { id: 'banana', label: 'Banana' },
  { id: 'cherry', label: 'Cherry' },
] satisfies MultiSelectItem<'apple' | 'banana' | 'cherry'>[];

const valid: MultiSelectProps<'apple' | 'banana' | 'cherry'> = {
  id: 'fruit',
  items: fruitItems,
  selectedIds: ['apple'],
};

const empty: MultiSelectProps<'apple' | 'banana' | 'cherry'> = {
  id: 'fruit',
  items: fruitItems,
};

const invalid: MultiSelectProps<'apple' | 'banana' | 'cherry'> = {
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

void valid;
void empty;
void invalid;
