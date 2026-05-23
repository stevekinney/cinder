<script lang="ts" module>
  export const title = 'With error message';
  export const description = 'Error state surfaces a message and marks both controls invalid.';
  export const component = 'phone-input';
</script>

<script lang="ts">
  import { PhoneInput } from 'cinder/phone-input';
  let phone = $state('555');
</script>

<PhoneInput
  id="error-phone"
  bind:value={phone}
  label="Phone number"
  error="Enter a complete phone number."
/>
