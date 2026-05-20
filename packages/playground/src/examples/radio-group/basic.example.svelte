<script lang="ts" module>
  export const title = 'Basic radio group';
  export const description = 'Three options with a group legend; arrow keys move selection.';
</script>

<script lang="ts">
  import { Radio } from 'cinder/radio';
  import { RadioGroup } from 'cinder/radio-group';
  let plan = $state('pro');
</script>

<RadioGroup name="basic-plan" legend="Pricing tier" bind:value={plan}>
  <Radio id="basic-plan-free" value="free" label="Free — for individuals exploring Cinder" />
  <Radio id="basic-plan-pro" value="pro" label="Pro — small teams, includes private support" />
  <Radio id="basic-plan-team" value="team" label="Team — SSO, audit logs, role-based access" />
</RadioGroup>
