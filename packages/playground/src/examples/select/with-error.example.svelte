<script lang="ts" module>
  export const title = 'Select with an error';
  export const description =
    'A required Select whose placeholder is still selected is invalid: pass a non-empty `error` string to mark it. The control gets `aria-invalid="true"`, the message is wired via `aria-describedby`, and a danger ring replaces the focus ring when the invalid control is focused.';
</script>

<script lang="ts">
  import { Select } from '@lostgradient/cinder/select';

  // A `disabled` placeholder paired with `required` is the accessible pattern for
  // a "must pick one" Select: the empty value can be the initial state but cannot
  // be re-selected, and native constraint validation agrees with the `error` prop.
  const options = [
    { value: '', label: 'Select a plan…', disabled: true },
    { value: 'free', label: 'Free' },
    { value: 'pro', label: 'Pro' },
    { value: 'enterprise', label: 'Enterprise' },
  ];

  let plan = $state('');
</script>

<Select
  id="plan-error"
  bind:value={plan}
  {options}
  label="Plan"
  required
  error="Choose a plan to continue."
/>
