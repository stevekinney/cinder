<script lang="ts" module>
  export const title = 'Dense timeline rows';
  export const description =
    'Timeline rows can tune row padding, layout gap, and description/meta type through public CSS variables.';
</script>

<script lang="ts">
  import ActionRow from '@lostgradient/cinder/action-row';

  let selectedEvent = $state('event-2');

  const events = [
    {
      id: 'event-1',
      title: 'Webhook received',
      description: 'Payload validated against the trigger schema',
      meta: 'Queued',
      time: '09:14:02',
    },
    {
      id: 'event-2',
      title: 'Workflow matched',
      description: 'Selected branch accepted the event filters',
      meta: 'Current',
      time: '09:14:04',
    },
    {
      id: 'event-3',
      title: 'Activity scheduled',
      description: 'Worker lease created for the next attempt',
      meta: 'Pending',
      time: '09:14:05',
    },
  ];
</script>

<div style="display: grid; gap: var(--cinder-space-1); max-inline-size: 32rem;">
  {#each events as event (event.id)}
    <ActionRow
      density="condensed"
      style="--cinder-action-row-padding-block: var(--cinder-space-1); --cinder-action-row-padding-inline: var(--cinder-space-2); --cinder-action-row-layout-column-gap: var(--cinder-space-2); --cinder-action-row-body-gap: 0; --cinder-action-row-description-font-size: var(--cinder-text-xs); --cinder-action-row-meta-font-size: var(--cinder-text-xs);"
      selected={selectedEvent === event.id}
      selectedState="current"
      currentValue="step"
      onclick={() => {
        selectedEvent = event.id;
      }}
    >
      {#snippet title()}{event.title}{/snippet}
      {#snippet description()}{event.description}{/snippet}
      {#snippet meta()}{event.meta}{/snippet}
      {#snippet trailing()}{event.time}{/snippet}
    </ActionRow>
  {/each}
</div>
