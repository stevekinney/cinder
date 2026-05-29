/**
 * Compile-time regression tests for SelectProps generic inference.
 * svelte-check processes this file; tsc does not (it excludes .svelte imports).
 *
 * These verify that:
 *   - T is correctly inferred as the union of option values.
 *   - value uses NoInfer<T> so it consumes but never widens T.
 *   - undefined is assignable to value (unselected sentinel).
 *   - A value outside the inferred union is a type error.
 *   - Existing non-generic usage (plain mutable options, T=string) compiles.
 */
import type { SelectOption, SelectProps } from './select.types.ts';

const countryOptions = [
  { value: 'us', label: 'United States' },
  { value: 'ca', label: 'Canada' },
  { value: 'gb', label: 'United Kingdom' },
] satisfies SelectOption<'us' | 'ca' | 'gb'>[];

// Valid: value is a member of the typed union.
const _validValue: SelectProps<'us' | 'ca' | 'gb'> = {
  id: 'country',
  options: countryOptions,
  value: 'us',
};

// Valid: value omitted — undefined is the unselected sentinel.
const _undefinedValue: SelectProps<'us' | 'ca' | 'gb'> = {
  id: 'country',
  options: countryOptions,
};

// @ts-expect-error — 'invalid' is not assignable to NoInfer<'us' | 'ca' | 'gb'>
const _invalidValue: SelectProps<'us' | 'ca' | 'gb'> = {
  id: 'country',
  options: countryOptions,
  value: 'invalid',
};

// --- Compatibility: default T=string (non-generic usage) ---

const plainOptions: SelectOption[] = [
  { value: 'a', label: 'A' },
  { value: 'b', label: 'B' },
];

const _plainUsage: SelectProps = {
  id: 'plain',
  options: plainOptions,
  value: 'a',
};

// --- SelectOption is also generic ---

const _typedOption: SelectOption<'x' | 'y'> = { value: 'x', label: 'X' };

// @ts-expect-error — 'z' is not assignable to 'x' | 'y'
const _invalidOption: SelectOption<'x' | 'y'> = { value: 'z', label: 'Z' };

// --- INFERENCE-WIDENING GUARD (the case NoInfer<T> actually protects) ---
//
// The explicitly-annotated cases above pin T, so they would reject an
// out-of-union value even WITHOUT NoInfer. The real risk is inference: T derived
// from `options`, with an inline `value` literal that a non-NoInfer `value: T`
// would WIDEN T to include. `mountSelect` mirrors how Svelte infers the
// component's generic — T is inferred SOLELY from the options element value type
// (the `const` modifier preserves literals without a call-site `as const`), and
// `value` then flows through SelectProps<T>'s NoInfer-typed `value`.
//
// VERIFIED non-vacuous: replacing `NoInfer<T>` with plain `T` in select.types.ts
// makes the @ts-expect-error below report as an UNUSED directive (svelte-check
// errors), because without NoInfer the inline literal widens T and the bad value
// is accepted. So this case genuinely exercises NoInfer, not a pinned annotation.
declare function mountSelect<const T extends string>(
  props: { options: readonly SelectOption<T>[] } & SelectProps<T>,
): void;

mountSelect({
  id: 'country',
  options: [
    { value: 'us', label: 'United States' },
    { value: 'ca', label: 'Canada' },
  ],
  value: 'us',
});

// @ts-expect-error — inline 'invalid' must NOT widen the inferred union (NoInfer).
// The whole-argument type mismatch attaches to the call expression, so the
// directive sits on the mountSelect(...) line.
mountSelect({
  id: 'country',
  options: [
    { value: 'us', label: 'United States' },
    { value: 'ca', label: 'Canada' },
  ],
  value: 'invalid',
});

void _validValue;
void _undefinedValue;
void _invalidValue;
void _plainUsage;
void _typedOption;
void _invalidOption;
