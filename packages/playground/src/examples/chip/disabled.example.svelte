<script lang="ts" module>
  export const title = 'Chip disabled states';
  export const description = 'Disabled toggle and disabled removable chip.';
</script>

<script lang="ts">
  import { Chip } from '@lostgradient/cinder/chip';
</script>

<div class="example-preview-row">
  <Chip mode="toggle" label="Disabled toggle" pressed={false} disabled />
  <Chip mode="removable" label="Disabled removable" disabled />
</div>
