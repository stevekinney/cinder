<script lang="ts" module>
  export const title = 'Cron mode';
  export const description =
    'Open the Cron tab to see five independently validated fields seeded losslessly from the initial value. Each field carries a numeric hint and surfaces an inline error the moment it falls outside its valid range.';
</script>

<script lang="ts">
  import {
    ScheduleBuilder,
    type ScheduleFire,
    type ScheduleValue,
  } from '@lostgradient/cinder/schedule-builder';

  // Weekdays at 09:00.
  let value = $state<ScheduleValue>({ mode: 'cron', expression: '0 9 * * 1-5' });

  // Static, illustrative fire labels — no date library involved.
  function computeNextFires(current: ScheduleValue, count: number): ScheduleFire[] {
    const description =
      current.mode === 'cron' ? current.expression : `${current.every} ${current.unit}`;
    return Array.from({ length: count }, (_, index) => ({
      id: `fire-${index}`,
      label: `Fire ${index + 1} — matches "${description}"`,
    }));
  }

  function handleChange(next: ScheduleValue): void {
    value = next;
  }
</script>

<ScheduleBuilder {value} onchange={handleChange} {computeNextFires} label="Weekday report job" />
