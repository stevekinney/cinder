<script lang="ts" module>
  export const title = 'Saga compensation';
  export const description =
    'A saga where a later step compensates (reverses) an earlier forward step by id. The compensating step renders inset beneath its forward step with a dashed reversal connector.';
</script>

<script lang="ts">
  import { RunStepTimeline } from '@lostgradient/cinder/run-step-timeline';
  import type { RunStepTimelineEntry } from '@lostgradient/cinder/run-step-timeline';

  const steps: RunStepTimelineEntry[] = [
    {
      id: 'charge',
      label: 'Charge customer card',
      status: 'succeeded',
      duration: '1s',
    },
    {
      id: 'reserve-seat',
      label: 'Reserve seat',
      status: 'failed',
      duration: '2s',
      details: [
        {
          id: 'err',
          label: 'Error',
          content: 'Seat 14C was taken before the reservation committed.',
        },
      ],
    },
    {
      id: 'refund',
      label: 'Refund customer card',
      status: 'succeeded',
      compensates: 'charge',
      duration: '1s',
    },
  ];
</script>

<RunStepTimeline {steps} label="Booking saga" />
