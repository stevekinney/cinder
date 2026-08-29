<script lang="ts">
  import FormField from '../../components/form-field/form-field.svelte';
  import PhoneInput from '../../components/phone-input/phone-input.svelte';
  import PinInput from '../../components/pin-input/pin-input.svelte';
  import Rating from '../../components/rating/rating.svelte';
</script>

<FormField
  id="supporting-pin"
  label="Verification code"
  warning="This code expires soon."
  managed={{ by: 'Security policy' }}
>
  <PinInput id="supporting-pin" />
</FormField>

<FormField
  id="supporting-phone"
  label="Phone number"
  warning="Carrier charges may apply."
  managed={{ reason: 'Required for recovery' }}
>
  <PhoneInput id="supporting-phone" />
</FormField>

<FormField
  id="supporting-rating"
  label="Rating"
  warning="This response is public."
  managed={{ by: 'Feedback policy' }}
>
  <Rating id="supporting-rating" />
</FormField>
