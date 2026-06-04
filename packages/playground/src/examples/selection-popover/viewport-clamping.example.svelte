<script lang="ts" module>
  export const title = 'Viewport clamping';
  export const description =
    'Shows that positions outside the viewport are clamped to a 16px margin. Expand the section to render three out-of-bounds popovers and visually confirm all land inside the viewport edges.';
</script>

<script lang="ts">
  import { Button } from '@lostgradient/cinder/button';
  import { SelectionPopover } from '@lostgradient/cinder/selection-popover';

  let showClamping = $state(false);
</script>

<div style="max-width: 36rem;">
  <p style="margin: 0 0 0.75rem; line-height: 1.5;">
    The component clamps any requested <code>position</code> to a 16px viewport margin, so a consumer
    can pass raw selection geometry without guards against off-screen placements. The test cases below
    use deliberately out-of-bounds coordinates.
  </p>

  <Button
    label={showClamping ? 'Hide clamping test popovers' : 'Show clamping test popovers'}
    aria-expanded={showClamping}
    onclick={() => {
      showClamping = !showClamping;
    }}
  />

  {#if showClamping}
    <p
      style="margin: 0.75rem 0 0; font-size: var(--cinder-text-sm); color: var(--cinder-text-muted);"
    >
      All three popovers below were requested at out-of-bounds positions. Visually confirm each one
      is inside the viewport edges — this is a human-eyeball check, not a CI assertion.
    </p>
  {/if}
</div>

<SelectionPopover
  id="viewport-clamp-negative-x"
  open={showClamping}
  position={{ x: -100, y: 300 }}
/>
<SelectionPopover
  id="viewport-clamp-overflow-x"
  open={showClamping}
  position={{ x: 99999, y: 340 }}
/>
<SelectionPopover
  id="viewport-clamp-negative-y"
  open={showClamping}
  position={{ x: 480, y: -50 }}
/>
