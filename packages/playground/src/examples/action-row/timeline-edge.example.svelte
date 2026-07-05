<script lang="ts" module>
  export const title = 'Timeline edge rows';
  export const description =
    'Current-step rows use aria-current while preserving the same full-row button layout.';
</script>

<script lang="ts">
  import ActionRow from '@lostgradient/cinder/action-row';

  let currentEdge = $state('edge-2');

  const edges = [
    {
      id: 'edge-1',
      title: 'Validate payload',
      description: 'Queued after webhook receipt',
      status: 'Queued',
      duration: '0.4s',
    },
    {
      id: 'edge-2',
      title: 'Route to workflow',
      description: 'Current transition in the timeline',
      status: 'Current',
      duration: '1.2s',
    },
    {
      id: 'edge-3',
      title: 'Persist activity',
      description: 'Writes the normalized event snapshot',
      status: 'Pending',
      duration: '0.8s',
    },
  ];
</script>

<div style="display: grid; gap: var(--cinder-space-1); max-inline-size: 30rem;">
  {#each edges as edge (edge.id)}
    <ActionRow
      selected={currentEdge === edge.id}
      selectedState="current"
      currentValue="step"
      density="condensed"
      onclick={() => {
        currentEdge = edge.id;
      }}
    >
      {#snippet leading()}
        <span aria-hidden="true">→</span>
      {/snippet}
      {#snippet title()}{edge.title}{/snippet}
      {#snippet description()}{edge.description}{/snippet}
      {#snippet meta()}{edge.status}{/snippet}
      {#snippet trailing()}{edge.duration}{/snippet}
    </ActionRow>
  {/each}
</div>
