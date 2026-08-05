<script lang="ts">
  import SpeedDial from '../speed-dial/index.ts';
  import type { SpeedDialActionLabelPlacement } from './speed-dial-action.types.ts';

  let {
    labelPlacement = 'auto',
    onAction,
    disabled = false,
  }: {
    labelPlacement?: SpeedDialActionLabelPlacement;
    onAction?: () => void;
    disabled?: boolean;
  } = $props();
</script>

<SpeedDial aria-label="Quick actions">
  {#snippet trigger()}
    <span aria-hidden="true">+</span>
  {/snippet}

  <SpeedDial.Action label="Create" {labelPlacement} {disabled} onclick={() => onAction?.()}>
    {#snippet icon()}
      <span aria-hidden="true">C</span>
    {/snippet}
  </SpeedDial.Action>
</SpeedDial>
