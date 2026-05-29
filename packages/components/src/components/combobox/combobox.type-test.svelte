<script lang="ts">
  /**
   * Compile-time regression tests for Combobox generic inference, using REAL
   * <Combobox> markup so Svelte's component-prop inference applies. svelte-check
   * processes this file; tsc does not (it excludes .svelte imports).
   *
   * Positive inference cases live here (valid value, '' sentinel, bound value,
   * plain-string compatibility). The inference-widening NEGATIVE case lives in
   * combobox.type-test.ts: svelte-check cannot suppress a whole-component
   * prop-type error with a markup @ts-expect-error, so the negative assertion
   * (and its NoInfer non-vacuity proof) sits in the .ts file.
   */
  import Combobox from './combobox.svelte';

  const fruitOptions = [
    { value: 'apple', label: 'Apple' },
    { value: 'banana', label: 'Banana' },
    { value: 'cherry', label: 'Cherry' },
  ] as const;

  // T infers to 'apple' | 'banana' | 'cherry' from the readonly options.
  let chosen = $state<'apple' | 'banana' | 'cherry' | ''>('apple');

  // Plain mutable string options — T widens to string (default, existing usage).
  const plainOptions = [
    { value: 'x', label: 'X' },
    { value: 'y', label: 'Y' },
  ];
  let plainValue = $state('x');
</script>

<!-- Valid: bound value is the inferred union (plus '' sentinel). -->
<Combobox id="bound" options={fruitOptions} bind:value={chosen} />

<!-- Valid: inline value is a member of the inferred union. -->
<Combobox id="valid" options={fruitOptions} value="apple" />

<!-- Valid: '' is the unselected sentinel. -->
<Combobox id="empty" options={fruitOptions} value="" />

<!-- Compatibility: plain mutable options, T=string — existing usage compiles. -->
<Combobox id="plain" options={plainOptions} bind:value={plainValue} />
