/**
 * Compile-time regression tests for ComboboxProps generic inference.
 * svelte-check processes this file; tsc does not (it excludes .svelte imports).
 *
 * These verify that:
 *   - T is correctly inferred as the union of option values.
 *   - value uses NoInfer<T> | '' so it consumes but never widens T.
 *   - The empty string '' is always assignable to value (unselected sentinel).
 *   - A value outside the inferred union (and not '') is a type error.
 *   - filter receives ComboboxOption<T> — a callback parameter is contra-variant,
 *     so it is never an inference site for T and cannot widen it (no NoInfer needed).
 *   - Existing non-generic usage (plain mutable options, T=string) compiles.
 */
import type { ComboboxOption, ComboboxProps } from './combobox.types.ts';

const fruitOptions = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry' },
] satisfies ComboboxOption<'apple' | 'banana' | 'cherry'>[];

// Valid: value is a member of the typed union.
const _validValue: ComboboxProps<'apple' | 'banana' | 'cherry'> = {
  id: 'fruit',
  options: fruitOptions,
  value: 'apple',
};

// Valid: empty string is always allowed — the unselected sentinel.
const _emptyStringValue: ComboboxProps<'apple' | 'banana' | 'cherry'> = {
  id: 'fruit',
  options: fruitOptions,
  value: '',
};

// Valid: value omitted.
const _undefinedValue: ComboboxProps<'apple' | 'banana' | 'cherry'> = {
  id: 'fruit',
  options: fruitOptions,
};

// Invalid value: must fire a type error on the `value` property.
const _invalidValue: ComboboxProps<'apple' | 'banana' | 'cherry'> = {
  id: 'fruit',
  options: fruitOptions,
  // @ts-expect-error — 'invalid' is not assignable to NoInfer<'apple' | 'banana' | 'cherry'> | ''
  value: 'invalid',
};

// Valid: filter callback accepts ComboboxOption<T>.
const _validFilter: ComboboxProps<'apple' | 'banana' | 'cherry'> = {
  id: 'fruit',
  options: fruitOptions,
  filter: (option, query) => option.label.toLowerCase().includes(query),
};

// --- Compatibility: default T=string (non-generic usage) ---

const plainOptions: ComboboxOption[] = [
  { value: 'x', label: 'X' },
  { value: 'y', label: 'Y' },
];

const _plainUsage: ComboboxProps = {
  id: 'plain',
  options: plainOptions,
  value: 'x',
};

// --- ComboboxOption is also generic ---

const _typedOption: ComboboxOption<'p' | 'q'> = { value: 'p', label: 'P' };

// @ts-expect-error — 'r' is not assignable to 'p' | 'q'
const _invalidOption: ComboboxOption<'p' | 'q'> = { value: 'r', label: 'R' };

// --- INFERENCE-WIDENING GUARD (the case NoInfer<T> actually protects) ---
//
// The explicitly-annotated `_invalidValue` above pins T, so it would reject an
// out-of-union value even WITHOUT NoInfer. The real risk is inference: T derived
// from `options`, with an inline `value` literal a non-NoInfer `value` would
// widen T to include. `mountCombobox` mirrors Svelte's prop inference — T is
// inferred SOLELY from the options element value type; `value` then flows through
// ComboboxProps<T>'s NoInfer-typed `value` (`NoInfer<T> | ''`).
//
// VERIFIED non-vacuous: replacing `NoInfer<T>` with plain `T` in
// combobox.types.ts makes the @ts-expect-error below report as UNUSED
// (svelte-check errors), confirming it genuinely exercises NoInfer.
declare function mountCombobox<const T extends string>(
  props: { options: readonly ComboboxOption<T>[] } & ComboboxProps<T>,
): void;

mountCombobox({
  id: 'fruit',
  options: [
    { value: 'apple', label: 'Apple' },
    { value: 'banana', label: 'Banana' },
  ],
  value: 'apple',
});

// Valid: '' is always accepted (unselected sentinel), even under inference.
mountCombobox({
  id: 'fruit',
  options: [
    { value: 'apple', label: 'Apple' },
    { value: 'banana', label: 'Banana' },
  ],
  value: '',
});

// Inline 'invalid' must NOT widen the inferred union (NoInfer). The mismatch
// attaches to the `value` property, so the directive sits directly above it.
mountCombobox({
  id: 'fruit',
  options: [
    { value: 'apple', label: 'Apple' },
    { value: 'banana', label: 'Banana' },
  ],
  // @ts-expect-error — 'invalid' is not in the inferred union | '' (NoInfer guard)
  value: 'invalid',
});

void _validValue;
void _emptyStringValue;
void _undefinedValue;
void _invalidValue;
void _validFilter;
void _plainUsage;
void _typedOption;
void _invalidOption;
