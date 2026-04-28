<script lang="ts" module>
  export const title = 'Select with disabled option';
  export const description = 'Individual options can be marked disabled.';
</script>

<script lang="ts">
  import { Select } from '../../../../src/index.ts';

  const options = [
    { value: 'free', label: 'Free' },
    { value: 'pro', label: 'Pro' },
    { value: 'enterprise', label: 'Enterprise (contact sales)', disabled: true },
  ];

  let plan = $state(options[0]?.value ?? 'free');
</script>

<Select id="plan" bind:value={plan} {options} label="Plan" />
