<script lang="ts" module>
  export const title = 'Transformed ancestor anchoring';
  export const description =
    'Scroll a transformed preview shell, then open the popover to verify fixed-position Floating UI anchoring.';
</script>

<script lang="ts">
  import { Popover } from '@lostgradient/cinder/popover';

  let open = $state(false);
  let triggerElement: HTMLButtonElement | null = $state(null);

  function togglePopover() {
    open = !open;
  }
</script>

<div data-testid="transformed-ancestor-example" style="display: grid; gap: 1rem; max-width: 40rem;">
  <p style="margin: 0;">
    This fixture nests the trigger inside a transformed card and a scrollable inner viewport. The
    popover should still align after the scroll container moves away from zero.
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
        <button
          type="button"
          bind:this={triggerElement}
          data-testid="transformed-popover-trigger"
          onclick={togglePopover}
        >
          Toggle anchored popover
        </button>

        <Popover
          bind:open
          triggerRef={triggerElement}
          placement="bottom"
          label="Transformed ancestor popover"
          class="transformed-ancestor-popover-panel"
        >
          <div style="display: grid; gap: 0.5rem; min-width: 14rem;">
            <strong>Anchored popover</strong>
            <p style="margin: 0; color: var(--cinder-text-muted);">
              This panel should remain attached to the trigger after scrolling the transformed
              container.
            </p>
          </div>
        </Popover>
      </div>
    </div>
  </div>
</div>
