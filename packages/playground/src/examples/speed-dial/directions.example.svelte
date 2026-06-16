<script lang="ts" module>
  export const title = 'Directions';
  export const description = 'Actions can fan out up, down, left, or right from the trigger.';
</script>

<script lang="ts">
  import { SpeedDial } from '@lostgradient/cinder/speed-dial';
</script>

<div
  style="min-height: 14rem; display: flex; align-items: center; justify-content: center; gap: 5rem;"
>
  <SpeedDial aria-label="Open upward actions" direction="up">
    {#snippet trigger()}<span aria-hidden="true">U</span>{/snippet}
    <SpeedDial.Action label="Create"
      >{#snippet icon()}<span aria-hidden="true">C</span>{/snippet}</SpeedDial.Action
    >
    <SpeedDial.Action label="Share"
      >{#snippet icon()}<span aria-hidden="true">S</span>{/snippet}</SpeedDial.Action
    >
  </SpeedDial>

  <SpeedDial aria-label="Open left actions" direction="left">
    {#snippet trigger()}<span aria-hidden="true">L</span>{/snippet}
    <SpeedDial.Action label="Create"
      >{#snippet icon()}<span aria-hidden="true">C</span>{/snippet}</SpeedDial.Action
    >
    <SpeedDial.Action label="Share"
      >{#snippet icon()}<span aria-hidden="true">S</span>{/snippet}</SpeedDial.Action
    >
  </SpeedDial>
</div>
