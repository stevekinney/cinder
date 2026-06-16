<script lang="ts" module>
  export const title = 'Basic radio group';
  export const description = 'Three options with a group legend; arrow keys move selection.';
</script>

<script lang="ts">
  import { RadioGroup } from '@lostgradient/cinder/radio-group';

  let { mountIdPrefix }: { mountIdPrefix?: string } = $props();
  const uid = $props.id();
  let groupName = $derived(`${mountIdPrefix ?? uid}-plan`);
  let freeId = $derived(`${mountIdPrefix ?? uid}-plan-free`);
  let proId = $derived(`${mountIdPrefix ?? uid}-plan-pro`);
  let teamId = $derived(`${mountIdPrefix ?? uid}-plan-team`);

  let plan = $state('pro');
</script>

<RadioGroup name={groupName} legend="Pricing tier" bind:value={plan}>
  <RadioGroup.Option id={freeId} value="free" label="Free — for individuals exploring Cinder" />
  <RadioGroup.Option id={proId} value="pro" label="Pro — small teams, includes private support" />
  <RadioGroup.Option id={teamId} value="team" label="Team — SSO, audit logs, role-based access" />
</RadioGroup>
