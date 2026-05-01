<script lang="ts" module>
  export const title = 'Disabled radio group';
  export const description = 'Disabling the group disables every radio inside.';
</script>

<script lang="ts">
  import { Radio, RadioGroup } from '../../../../components/src/index.ts';
</script>

<RadioGroup name="disabled-region" legend="Region (locked for trial accounts)" value="us" disabled>
  <Radio id="disabled-region-us" value="us" label="United States" />
  <Radio id="disabled-region-eu" value="eu" label="European Union" />
  <Radio id="disabled-region-ap" value="ap" label="Asia Pacific" />
</RadioGroup>
