<script lang="ts" module>
  export const title = 'Quick actions';
  export const description =
    'A FloatingActionButton trigger reveals a directional cluster of labeled quick actions.';
</script>

<script lang="ts">
  import { SpeedDial } from '@lostgradient/cinder/speed-dial';

  let lastAction = $state('None');
</script>

<div style="min-height: 12rem; display: grid; place-items: center;">
  <SpeedDial aria-label="Quick actions">
    {#snippet trigger()}
      <span aria-hidden="true">+</span>
    {/snippet}

    <SpeedDial.Action label="Create" onclick={() => (lastAction = 'Create')}>
      {#snippet icon()}
        <span aria-hidden="true">C</span>
      {/snippet}
    </SpeedDial.Action>

    <SpeedDial.Action label="Share" onclick={() => (lastAction = 'Share')}>
      {#snippet icon()}
        <span aria-hidden="true">S</span>
      {/snippet}
    </SpeedDial.Action>

    <SpeedDial.Action label="Archive" disabled>
      {#snippet icon()}
        <span aria-hidden="true">A</span>
      {/snippet}
    </SpeedDial.Action>
  </SpeedDial>
</div>

<p>Last action: {lastAction}</p>
