<script lang="ts">
  import SpeedDial from './index.ts';
  import type { SpeedDialDirection } from './speed-dial.types.ts';

  let {
    open = $bindable(false),
    direction = 'up',
    hidden = false,
    ariaLabel = 'Quick actions',
    archiveDisabled = true,
    onAction,
  }: {
    open?: boolean;
    direction?: SpeedDialDirection;
    hidden?: boolean;
    ariaLabel?: string;
    archiveDisabled?: boolean;
    onAction?: (name: string) => void;
  } = $props();
</script>

<p data-testid="open-state">{open ? 'open' : 'closed'}</p>

<SpeedDial bind:open {direction} {hidden} aria-label={ariaLabel}>
  {#snippet trigger()}
    <span aria-hidden="true">+</span>
  {/snippet}

  <SpeedDial.Action label="Create" onclick={() => onAction?.('create')}>
    {#snippet icon()}
      <span aria-hidden="true">C</span>
    {/snippet}
  </SpeedDial.Action>

  <SpeedDial.Action label="Archive" disabled={archiveDisabled}>
    {#snippet icon()}
      <span aria-hidden="true">A</span>
    {/snippet}
  </SpeedDial.Action>

  <SpeedDial.Action label="Share" onclick={() => onAction?.('share')}>
    {#snippet icon()}
      <span aria-hidden="true">S</span>
    {/snippet}
  </SpeedDial.Action>
</SpeedDial>
