<script lang="ts" module>
  export const title = 'Basic PIN input';
  export const description = 'Six-digit numeric code with auto-advance and SMS autofill.';
  export const component = 'pin-input';
</script>

<script lang="ts">
  import { PinInput } from 'cinder/pin-input';
  let code = $state('');
</script>

<PinInput id="basic-pin" bind:value={code} label="Verification code" />

{#if code.length === 6}
  <p style="margin-top: 0.75rem; color: var(--cinder-text-muted);">Submitted: {code}</p>
{/if}
