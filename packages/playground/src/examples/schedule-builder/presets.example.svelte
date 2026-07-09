<script lang="ts" module>
  export const title = 'Presets mode';
  export const description =
    'Presets is the default authoring mode. Try each preset kind — "every N" lowers to an interval value, and daily/weekly/monthly all lower to a cron expression. The summary line always reflects the resulting cron or interval value, never a "preset".';
</script>

<script lang="ts">
  import {
    ScheduleBuilder,
    type ScheduleFire,
    type ScheduleValue,
  } from '@lostgradient/cinder/schedule-builder';

  let value = $state<ScheduleValue>({ mode: 'interval', every: 30, unit: 'minutes' });

  // Static, illustrative fire labels — no date library involved.
  function computeNextFires(current: ScheduleValue, count: number): ScheduleFire[] {
    const suffix =
      current.mode === 'interval' ? `every ${current.every} ${current.unit}` : current.expression;
    return Array.from({ length: count }, (_, index) => ({
      id: `fire-${index}`,
      label: `Fire ${index + 1} — ${suffix}`,
    }));
  }

  function handleChange(next: ScheduleValue): void {
    value = next;
  }
</script>

<ScheduleBuilder {value} onchange={handleChange} {computeNextFires} label="Backup schedule" />
