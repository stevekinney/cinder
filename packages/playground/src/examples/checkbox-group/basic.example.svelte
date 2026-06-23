<script lang="ts" module>
  export const title = 'Basic checkbox group';
  export const description =
    'Grouped checkboxes under a shared legend with independent checked states.';
</script>

<script lang="ts">
  import { Checkbox } from '@lostgradient/cinder/checkbox';
  import { CheckboxGroup } from '@lostgradient/cinder/checkbox-group';

  let { mountIdPrefix }: { mountIdPrefix?: string } = $props();
  const uid = $props.id();
  let emailId = $derived(`${mountIdPrefix ?? uid}-email`);
  let smsId = $derived(`${mountIdPrefix ?? uid}-sms`);
  let pushId = $derived(`${mountIdPrefix ?? uid}-push`);

  let email = $state(true);
  let sms = $state(false);
  let push = $state(false);
</script>

<CheckboxGroup label="Notification channels">
  <Checkbox id={emailId} label="Email" bind:checked={email} />
  <Checkbox id={smsId} label="SMS" bind:checked={sms} />
  <Checkbox id={pushId} label="Push notifications" bind:checked={push} />
</CheckboxGroup>
