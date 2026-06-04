<script lang="ts" module>
  export const title = 'Country switching';
  export const description =
    'Narrowed country allow-list — typed digits reformat when the user switches countries.';
  export const component = 'phone-input';
</script>

<script lang="ts">
  import { PhoneInput, type PhoneInputCountryCode } from '@lostgradient/cinder/phone-input';

  const countries: readonly PhoneInputCountryCode[] = ['US', 'CA', 'GB', 'DE', 'FR'];
  let phone = $state('');
  let country = $state<PhoneInputCountryCode>('GB');
</script>

<PhoneInput
  id="country-switching-phone"
  bind:value={phone}
  bind:country
  {countries}
  label="Phone number"
  description="Numbers reformat as you switch country."
/>
