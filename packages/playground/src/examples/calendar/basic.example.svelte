<script lang="ts" module>
  export const title = 'Basic calendar';
  export const description = 'Keyboard-navigable calendar grid with controlled ISO date value.';
</script>

<script lang="ts">
  import { Calendar } from '@lostgradient/cinder/calendar';

  let value = $state<string | undefined>('2026-06-29');
</script>

<div style="display: grid; gap: 0.75rem; max-inline-size: 22rem;">
  <Calendar bind:value />
  <code>{value ?? 'undefined'}</code>
</div>
