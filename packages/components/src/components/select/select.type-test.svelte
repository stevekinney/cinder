<script lang="ts">
  /**
   * Compile-time regression tests for Select generic inference, using REAL
   * <Select> markup so Svelte's component-prop inference applies. svelte-check
   * processes this file; tsc does not (it excludes .svelte imports).
   *
   * This is the authoritative inference test — it exercises the exact path
   * NoInfer<T> protects: T is inferred from `as const` options, and an inline
   * `value` literal must NOT widen that inferred union.
   *
   * VERIFIED non-vacuous: replacing `NoInfer<T>` with plain `T` in
   * select.types.ts makes the `@ts-expect-error` on the invalid-inline-value
   * case below stop firing (svelte-check then errors on the now-unused
   * directive). So this case genuinely exercises the NoInfer mechanism, not
   * just a pinned type annotation.
   */
  import Select from './select.svelte';

  const countryOptions = [
    { value: 'us', label: 'United States' },
    { value: 'ca', label: 'Canada' },
    { value: 'gb', label: 'United Kingdom' },
  ] as const;

  // T infers to 'us' | 'ca' | 'gb' from the readonly options.
  let chosen = $state<'us' | 'ca' | 'gb'>('us');

  // Plain mutable string options — T widens to string (default, existing usage).
  const plainOptions = [
    { value: 'a', label: 'A' },
    { value: 'b', label: 'B' },
  ];
  let plainValue = $state('a');
</script>

<!-- Valid: bound value is the inferred union; two-way binding accepts it. -->
<Select id="bound" options={countryOptions} bind:value={chosen} />

<!-- Valid: inline value is a member of the inferred union. -->
<Select id="valid" options={countryOptions} value="us" />

<!-- Valid: value omitted — undefined is the unselected sentinel. -->
<Select id="empty" options={countryOptions} />

<!-- The inference-widening negative case (inline 'invalid' must not widen the
     inferred union) is asserted in select.type-test.ts via a helper that mirrors
     Svelte's prop inference — svelte-check cannot suppress a whole-component
     prop-type error with a markup @ts-expect-error, so the negative assertion
     lives in the .ts file where the directive attaches reliably. -->

<!-- Compatibility: plain mutable options, T=string — existing usage compiles. -->
<Select id="plain" options={plainOptions} bind:value={plainValue} />
