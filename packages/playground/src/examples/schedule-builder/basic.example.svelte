<script lang="ts" module>
  export const title = 'Basic schedule builder';
  export const description =
    'Author a recurrence via presets, raw cron, or a fixed interval. The summary line, next-fires preview, and timezone slot stay visible across every mode.';
</script>

<script lang="ts">
  import {
    ScheduleBuilder,
    type ScheduleFire,
    type ScheduleValue,
  } from '@lostgradient/cinder/schedule-builder';

  let value = $state<ScheduleValue>({ mode: 'interval', every: 15, unit: 'minutes' });

  // Cinder ships no date math — a real app would bring its own cron/interval
  // library here. Labels are illustrative static strings, not computed dates.
  function computeNextFires(current: ScheduleValue, count: number): ScheduleFire[] {
    if (current.mode === 'interval') {
      return Array.from({ length: count }, (_, index) => ({
        id: `fire-${index}`,
        label: `Fire ${index + 1} — in ${(index + 1) * current.every} ${current.unit}`,
      }));
    }
    return Array.from({ length: count }, (_, index) => ({
      id: `fire-${index}`,
      label: `Fire ${index + 1} — matches "${current.expression}"`,
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
  timezoneLabel="America/New_York"
  label="Data sync schedule"
/>
