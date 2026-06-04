<script lang="ts" module>
  export const title = 'Viewport edge handling';
  export const description =
    'Shows that out-of-bounds selection anchors are shifted or flipped back inside the viewport.';
</script>

<script lang="ts">
  import { Button } from '@lostgradient/cinder/button';
  import { SelectionPopover } from '@lostgradient/cinder/selection-popover';

  let showClamping = $state(false);
</script>

<div style="max-width: 36rem;">
  <p style="margin: 0 0 0.75rem; line-height: 1.5;">
    The component shifts or flips around any requested <code>position</code> anchor near the viewport
    edge, so a consumer can pass raw selection geometry without guards against off-screen placements.
    The test cases below use deliberately out-of-bounds anchor coordinates.
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
      All three popovers below were requested from out-of-bounds anchors. Visually confirm each one
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
