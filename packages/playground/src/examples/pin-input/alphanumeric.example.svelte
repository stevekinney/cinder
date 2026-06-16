<script lang="ts" module>
  export const title = 'Alphanumeric code';
  export const description = 'Eight-character alphanumeric invite code with description text.';
  export const component = 'pin-input';
</script>

<script lang="ts">
  import { PinInput } from '@lostgradient/cinder/pin-input';

  let { mountIdPrefix }: { mountIdPrefix?: string } = $props();
  const uid = $props.id();
  let fieldId = $derived(`${mountIdPrefix ?? uid}-invite-code`);

  let invite = $state('');
</script>

<PinInput
  id={fieldId}
  bind:value={invite}
  length={8}
  mode="alphanumeric"
  label="Invite code"
  description="Type or paste the code from your invitation email."
/>
