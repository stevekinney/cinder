<script lang="ts" module>
  export const title = 'Event timeline';
  export const description = 'A proportional schedule strip with fired and upcoming events.';
</script>

<script lang="ts">
  import { EventTimeline } from '@lostgradient/cinder/event-timeline';
</script>

<EventTimeline
  label="Next 24 hours"
  start="2026-07-03T00:00:00.000Z"
  end="2026-07-04T00:00:00.000Z"
  now="2026-07-03T10:30:00.000Z"
  items={[
    { at: '2026-07-03T02:00:00.000Z', label: 'Digest', sublabel: '02:00', state: 'done' },
    { at: '2026-07-03T10:00:00.000Z', label: 'Retry', sublabel: '10:00', state: 'failed' },
    { at: '2026-07-03T16:00:00.000Z', label: 'Deploy', sublabel: '16:00' },
    { at: '2026-07-03T22:00:00.000Z', label: 'Archive', sublabel: '22:00' },
  ]}
/>
