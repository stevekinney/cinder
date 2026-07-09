<script lang="ts" module>
  export const title = 'Interval mode';
  export const description =
    'Open the Interval tab to author a fixed-cadence schedule. Because the initial value here is already an interval, presets mode reflects it immediately too — switching modes never loses your place.';
</script>

<script lang="ts">
  import {
    ScheduleBuilder,
    type ScheduleFire,
    type ScheduleValue,
  } from '@lostgradient/cinder/schedule-builder';

  let value = $state<ScheduleValue>({ mode: 'interval', every: 5, unit: 'hours' });

  // Static, illustrative fire labels — no date library involved.
  function computeNextFires(current: ScheduleValue, count: number): ScheduleFire[] {
    if (current.mode !== 'interval') return [];
    return Array.from({ length: count }, (_, index) => ({
      id: `fire-${index}`,
      label: `Fire ${index + 1} — in ${(index + 1) * current.every} ${current.unit}`,
    }));
  }

  function handleChange(next: ScheduleValue): void {
    value = next;
  }
</script>

<ScheduleBuilder
  {value}
  onchange={handleChange}
  {computeNextFires}
  timezoneLabel="UTC"
  label="Health check schedule"
/>
