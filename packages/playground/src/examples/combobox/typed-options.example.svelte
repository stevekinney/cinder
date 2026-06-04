<script lang="ts" module>
  export const title = 'Typed options with as const';
  export const description =
    'Use `as const` on the options array to infer a precise literal-union type for `T`. TypeScript then rejects any `value` that is not a member of the union (or the empty-string sentinel) at compile time.';
</script>

<script lang="ts">
  import { Combobox } from '@lostgradient/cinder/combobox';

  // `as const` narrows value types to the literal union 'apple' | 'banana' | …
  // T is inferred from `options`; passing value="invalid" would be a compile error.
  const fruits = [
    { value: 'apple', label: 'Apple' },
    { value: 'banana', label: 'Banana' },
    { value: 'cherry', label: 'Cherry' },
    { value: 'grape', label: 'Grape' },
    { value: 'mango', label: 'Mango' },
  ] as const;

  type FruitValue = (typeof fruits)[number]['value'];
  let selected = $state<FruitValue | ''>('');
</script>

<Combobox
  id="combobox-typed"
  label="Favorite fruit"
  placeholder="Start typing…"
  options={fruits}
  bind:value={selected}
/>
<p style="margin-top: 0.5rem; color: var(--cinder-text-muted);">Selected: {selected || '(none)'}</p>
