<script lang="ts" module>
  export const title = 'Dense cluster';
  export const description =
    'Excess overlapping events collapse into a keyboard-accessible cluster.';
</script>

<script lang="ts">
  import { EventTimeline } from '@lostgradient/cinder/event-timeline';
</script>

<EventTimeline
  ariaLabel="Dense incident timeline"
  start="2026-07-03T12:00:00.000Z"
  end="2026-07-03T18:00:00.000Z"
  items={[
    { at: '2026-07-03T13:00:00.000Z', label: 'Queued', sublabel: '13:00' },
    { at: '2026-07-03T13:02:00.000Z', label: 'Started', sublabel: '13:02' },
    { at: '2026-07-03T13:04:00.000Z', label: 'Checked', sublabel: '13:04' },
    { at: '2026-07-03T13:06:00.000Z', label: 'Retried', sublabel: '13:06' },
    { at: '2026-07-03T13:08:00.000Z', label: 'Escalated', sublabel: '13:08' },
    { at: '2026-07-03T13:10:00.000Z', label: 'Paged', sublabel: '13:10' },
    { at: '2026-07-03T13:12:00.000Z', label: 'Acknowledged', sublabel: '13:12' },
    { at: '2026-07-03T13:14:00.000Z', label: 'Mitigated', sublabel: '13:14' },
  ]}
/>
