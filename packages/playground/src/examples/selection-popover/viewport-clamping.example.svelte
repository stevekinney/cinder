<script lang="ts" module>
  export const title = 'Viewport clamping';
  export const description =
    'Manual exploratory coverage (not a CI gate). Three popovers requested at out-of-bounds positions — all three should land inside the 16px viewport margin.';
</script>

<script lang="ts">
  import { SelectionPopover } from 'cinder/selection-popover';
</script>

<div style="position: relative; min-height: 12rem;">
  <p style="max-width: 36rem; margin: 0;">
    Each popover below is requested at a position that would put it off-screen. The component clamps
    to a 16px viewport margin. Visually confirm all three are inside the viewport edges — this is a
    human-eyeball check, not a CI assertion.
  </p>

  <SelectionPopover id="viewport-clamp-negative-x" open position={{ x: -100, y: 220 }} />
  <SelectionPopover id="viewport-clamp-overflow-x" open position={{ x: 99999, y: 260 }} />
  <SelectionPopover id="viewport-clamp-negative-y" open position={{ x: 480, y: -50 }} />
</div>
