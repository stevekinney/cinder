<script lang="ts" module>
  export const title = 'Disabled radio group';
  export const description = 'Disabling the group disables every radio inside.';
</script>

<script lang="ts">
  import { RadioGroup } from 'cinder/radio-group';
</script>

<RadioGroup name="disabled-region" legend="Region (locked for trial accounts)" value="us" disabled>
  <RadioGroup.Option id="disabled-region-us" value="us" label="United States" />
  <RadioGroup.Option id="disabled-region-eu" value="eu" label="European Union" />
  <RadioGroup.Option id="disabled-region-ap" value="ap" label="Asia Pacific" />
</RadioGroup>
