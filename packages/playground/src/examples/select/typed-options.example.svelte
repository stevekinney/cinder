<script lang="ts" module>
  export const title = 'Typed options with as const';
  export const description =
    'Use `as const` on the options array to infer a precise literal-union type for `T`. TypeScript then rejects any `value` that is not a member of the union at compile time.';
</script>

<script lang="ts">
  import { Select } from 'cinder/select';

  // `as const` narrows value types to the literal union 'us' | 'ca' | 'gb' | 'au'.
  // T is inferred from `options`; passing value="invalid" would be a compile error.
  const options = [
    { value: 'us', label: 'United States' },
    { value: 'ca', label: 'Canada' },
    { value: 'gb', label: 'United Kingdom' },
    { value: 'au', label: 'Australia' },
  ] as const;

  type CountryCode = (typeof options)[number]['value'];
  let country = $state<CountryCode>('us');
</script>

<Select id="country-typed" bind:value={country} {options} label="Country" />
<p style="margin-top: 0.5rem; color: var(--cinder-text-muted);">Selected: {country}</p>
