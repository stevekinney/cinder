<script lang="ts" module>
  export const title = 'Basic phone input';
  export const description = 'Country selector plus national number with E.164 emission.';
  export const component = 'phone-input';
</script>

<script lang="ts">
  import { PhoneInput } from '@lostgradient/cinder/phone-input';

  let { mountIdPrefix }: { mountIdPrefix?: string } = $props();
  const uid = $props.id();
  let fieldId = $derived(`${mountIdPrefix ?? uid}-field`);

  let phone = $state('');
</script>

<PhoneInput id={fieldId} bind:value={phone} label="Phone number" />

{#if phone}
  <p style="margin-top: 0.75rem; color: var(--cinder-text-muted);">E.164: {phone}</p>
{/if}
