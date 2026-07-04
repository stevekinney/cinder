<script lang="ts" module>
  export const title = 'Overlapping labels';
  export const description = 'Nearby events are nudged into separate label lanes.';
</script>

<script lang="ts">
  import { EventTimeline } from '@lostgradient/cinder/event-timeline';
</script>

<EventTimeline
  ariaLabel="Clustered deployment timeline"
  start="2026-07-03T12:00:00.000Z"
  end="2026-07-03T18:00:00.000Z"
  items={[
    { at: '2026-07-03T13:00:00.000Z', label: 'Queued', sublabel: '13:00', state: 'done' },
    { at: '2026-07-03T13:20:00.000Z', label: 'Started', sublabel: '13:20', state: 'done' },
    { at: '2026-07-03T13:40:00.000Z', label: 'Checked', sublabel: '13:40' },
    { at: '2026-07-03T16:30:00.000Z', label: 'Promote', sublabel: '16:30' },
  ]}
/>
