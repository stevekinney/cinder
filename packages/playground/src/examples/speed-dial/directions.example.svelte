<script lang="ts" module>
  export const title = 'Directions';
  export const description = 'Actions can fan out up, down, left, or right from the trigger.';
</script>

<script lang="ts">
  import { SpeedDial } from '@lostgradient/cinder/speed-dial';
</script>

<div
  style="min-height: 14rem; display: grid; grid-template-columns: minmax(10rem, 1fr) minmax(16rem, 1fr); align-items: center; gap: clamp(3rem, 10vw, 8rem);"
>
  <div style="display: flex; justify-content: center;">
    <SpeedDial aria-label="Open upward actions" direction="up">
      {#snippet trigger()}<span aria-hidden="true">U</span>{/snippet}
      <SpeedDial.Action label="Create"
        >{#snippet icon()}<span aria-hidden="true">C</span>{/snippet}</SpeedDial.Action
      >
      <SpeedDial.Action label="Share"
        >{#snippet icon()}<span aria-hidden="true">S</span>{/snippet}</SpeedDial.Action
      >
    </SpeedDial>
  </div>

  <div
    style="display: flex; justify-content: flex-end; padding-inline-end: clamp(2rem, 8vw, 6rem);"
  >
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
</div>
