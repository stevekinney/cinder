<script lang="ts">
  import type { TimeFieldGranularity } from '../../components/time-field/time-field.types.ts';
  import TimeField from '../../components/time-field/time-field.svelte';

  let granularity = $state<TimeFieldGranularity>('second');
</script>

<button
  type="button"
  class="toggle-granularity"
  onclick={() => {
    granularity = 'minute';
  }}
>
  Minute granularity
</button>

<TimeField id="reminder" {granularity} defaultValue="09:30:45" name="reminder_time" />
