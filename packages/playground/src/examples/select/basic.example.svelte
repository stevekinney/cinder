<script lang="ts" module>
  export const title = 'Basic select';
  export const description = 'Native select with label and bound string value.';
</script>

<script lang="ts">
  import { Select } from '../../../../components/src/index.ts';

  const options = [
    { value: 'us', label: 'United States' },
    { value: 'ca', label: 'Canada' },
    { value: 'gb', label: 'United Kingdom' },
    { value: 'au', label: 'Australia' },
  ];

  let country = $state(options[0]?.value ?? 'us');
</script>

<Select id="country" bind:value={country} {options} label="Country" />
<p style="margin-top: 0.5rem; color: var(--cinder-text-muted);">Selected: {country}</p>
