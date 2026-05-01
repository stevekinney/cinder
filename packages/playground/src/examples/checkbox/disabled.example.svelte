<script lang="ts" module>
  export const title = 'Disabled checkbox';
  export const description = 'Disabled state for both unchecked and checked checkboxes.';
</script>

<script lang="ts">
  import { Checkbox } from '../../../../components/src/index.ts';
</script>

<div style="display: flex; flex-direction: column; gap: 0.75rem;">
  <Checkbox id="checkbox-disabled-off" label="Disabled, unchecked" disabled />
  <Checkbox id="checkbox-disabled-on" label="Disabled, checked" disabled checked />
</div>
