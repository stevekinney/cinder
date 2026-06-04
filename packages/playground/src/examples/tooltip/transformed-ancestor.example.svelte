<script lang="ts" module>
  export const title = 'Transformed ancestor anchoring';
  export const description =
    'Hover the trigger after scrolling the transformed preview shell to verify tooltip fixed-position anchoring.';
</script>

<script lang="ts">
  import { Button } from '@lostgradient/cinder/button';
  import { Tooltip } from '@lostgradient/cinder/tooltip';
</script>

<div data-testid="transformed-ancestor-example" style="display: grid; gap: 1rem; max-width: 40rem;">
  <p style="margin: 0;">
    The tooltip trigger sits inside a transformed card and an inner scroll container. Hover after
    scrolling the viewport to confirm the tooltip still anchors to the button instead of the
    wrapper.
  </p>

  <div
    data-testid="transformed-shell"
    style="transform: translate3d(32px, 0, 0) scale(0.98); transform-origin: top left; padding: 1rem; border-radius: 1rem; background: var(--cinder-surface-raised); border: 1px solid var(--cinder-border);"
  >
    <div
      data-testid="transformed-scroll-container"
      style="overflow: auto; width: 28rem; height: 18rem; padding: 1.5rem; border-radius: 0.75rem; background: var(--cinder-surface);"
    >
      <div style="width: 48rem; height: 30rem; padding-top: 10rem; padding-left: 12rem;">
        <Tooltip text="Transformed ancestor tooltip anchor" placement="bottom">
          <span data-testid="transformed-tooltip-trigger">
            <Button variant="secondary">Hover for anchored tooltip</Button>
          </span>
        </Tooltip>
      </div>
    </div>
  </div>
</div>
