<script lang="ts" module>
  /**
   * @cinder
   * @category overlay
   * @status beta
   * @purpose Headless portal primitive that moves a subtree into a target element while preserving inline rendering as an explicit opt-out.
   * @tag overlay
   * @tag utilities
   * @useWhen Rendering an overlay or floating surface outside the current stacking or overflow context.
   * @useWhen Building a custom anchored or modal primitive that needs to append content into document.body or a named host.
   * @avoidWhen The content should stay in normal document flow or inherit layout from its original parent.
   * @related popover, modal, drawer, sheet
   */
  export type { PortalProps } from './portal.types.ts';
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';

  import type { PortalProps } from './portal.types.ts';
  import { createPortalAttachment, resolvePortalTarget } from './portal.utilities.svelte.ts';

  let {
    target = null,
    disabled = false,
    class: className,
    inheritAttributes = true,
    children,
    ...rest
  }: PortalProps = $props();

  let hasHydrated = $state(false);

  $effect(() => {
    hasHydrated = true;
  });

  const resolvedTarget = $derived(!disabled ? resolvePortalTarget(target) : null);

  const shouldRenderChildren = $derived(disabled || (hasHydrated && resolvedTarget !== null));
</script>

<div
  {@attach createPortalAttachment({
    target: () => target,
    disabled: () => disabled,
    inheritAttributes: () => inheritAttributes,
  })}
  class={classNames(className)}
  {...rest}
>
  {#if shouldRenderChildren}
    {@render children()}
  {/if}
</div>
