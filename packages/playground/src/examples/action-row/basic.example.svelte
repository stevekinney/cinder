<script lang="ts" module>
  export const title = 'Selectable action rows';
  export const description =
    'Rows with button semantics for master-detail lists and timeline selections.';
</script>

<script lang="ts">
  import ActionRow from '@lostgradient/cinder/action-row';

  let selectedRun = $state('run-2');

  const runs = [
    { id: 'run-1', title: 'Morning sync', status: 'Queued', time: '09:00' },
    { id: 'run-2', title: 'Webhook replay', status: 'Running', time: '09:12' },
    { id: 'run-3', title: 'Cleanup sweep', status: 'Finished', time: '09:18' },
  ];
</script>

<div style="display: grid; gap: var(--cinder-space-1); max-inline-size: 28rem;">
  {#each runs as run (run.id)}
    <ActionRow
      selected={selectedRun === run.id}
      onclick={() => {
        selectedRun = run.id;
      }}
    >
      {#snippet title()}{run.title}{/snippet}
      {#snippet description()}{run.status}{/snippet}
      {#snippet meta()}Run {run.id}{/snippet}
      {#snippet trailing()}{run.time}{/snippet}
    </ActionRow>
  {/each}
</div>
