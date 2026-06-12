<script lang="ts" module>
  export const title = 'Loading and empty states';
  export const description =
    'Demonstrates the loading skeleton, empty state, and truncated notice variants.';
</script>

<script lang="ts">
  import { EventStreamViewer } from '@lostgradient/cinder/event-stream-viewer';
  import { Button } from '@lostgradient/cinder/button';
  import type { StreamEvent } from '@lostgradient/cinder/event-stream-viewer';

  type ViewerState = 'loading' | 'empty' | 'truncated' | 'normal';
  let activeState = $state<ViewerState>('loading');

  const sampleEvents: StreamEvent[] = [
    {
      id: 'evt-1',
      datetime: '2026-05-12T14:30:00Z',
      timestamp: '14:30:00',
      severity: 'info',
      source: 'worker',
      summary: 'Job started',
    },
    {
      id: 'evt-2',
      datetime: '2026-05-12T14:30:05Z',
      timestamp: '14:30:05',
      severity: 'success',
      source: 'worker',
      summary: 'Job completed',
    },
  ];
</script>

<div style="display: flex; flex-direction: column; gap: 1rem;">
  <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
    <Button
      onclick={() => {
        activeState = 'loading';
      }}
      variant={activeState === 'loading' ? 'primary' : 'secondary'}>Loading</Button
    >
    <Button
      onclick={() => {
        activeState = 'empty';
      }}
      variant={activeState === 'empty' ? 'primary' : 'secondary'}>Empty</Button
    >
    <Button
      onclick={() => {
        activeState = 'truncated';
      }}
      variant={activeState === 'truncated' ? 'primary' : 'secondary'}>Truncated</Button
    >
    <Button
      onclick={() => {
        activeState = 'normal';
      }}
      variant={activeState === 'normal' ? 'primary' : 'secondary'}>Normal</Button
    >
  </div>

  <EventStreamViewer
    events={activeState === 'empty' || activeState === 'loading' ? [] : sampleEvents}
    loading={activeState === 'loading'}
    truncated={activeState === 'truncated'}
    label="Event stream states demo"
  />
</div>
