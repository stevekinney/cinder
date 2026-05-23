<script lang="ts" module>
  export const title = 'Second precision';
  export const description = 'Enable second-level precision for time entry and selection.';
</script>

<script lang="ts">
  import { TimePicker } from 'cinder';

  let value = $state('09:30:00');
</script>

<div style="max-width: 18rem;">
  <TimePicker id="precise-time" bind:value label="Precise time" seconds step={1} />
  <p>Selected: {value || 'none'}</p>
</div>
