<script lang="ts" module>
  /**
   * @cinder
   * @category overlay
   * @status beta
   * @purpose Headless utility that calls a function when the user clicks or taps outside a subtree.
   * @tag overlay
   * @tag utility
   * @useWhen Building a custom inline-edit field, custom dropdown, or any overlay that should close on outside interaction.
   * @avoidWhen Using Popover, Dropdown, or Modal — those handle click-away internally.
   * @related focus-trap, popover, portal
   */
  export type { ClickAwayListenerProps } from './click-away-listener.types.ts';
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';

  import type { ClickAwayListenerProps } from './click-away-listener.types.ts';

  let {
    onClickAway,
    enabled = true,
    class: className,
    children,
    ...rest
  }: ClickAwayListenerProps = $props();

  let rootElement: HTMLDivElement | undefined = $state();

  $effect(() => {
    if (!enabled) return;

    // Feature-detect PointerEvent. Falls back to mousedown + touchstart on
    // browsers that do not implement the Pointer Events API.
    const supportsPointerEvents =
      typeof window !== 'undefined' && typeof window.PointerEvent !== 'undefined';

    function handlePointerDown(event: PointerEvent | MouseEvent | TouchEvent) {
      if (!rootElement) return;

      // Use event.target for all event types. touchstart's event.target already
      // resolves to the touched element — identical to touches[0].target — so a
      // separate TouchEvent branch adds nothing and crashes in environments that
      // support touchstart but lack a global TouchEvent constructor (e.g. legacy
      // desktop Safari, jsdom, and any browser where PointerEvent is unavailable
      // but TouchEvent is also not a defined global): `event instanceof undefined`
      // throws TypeError. Avoid the global entirely.
      const target = event.target;

      const isInside = target instanceof Node && rootElement.contains(target);
      if (!isInside) {
        onClickAway(event);
      }
    }

    if (supportsPointerEvents) {
      document.addEventListener('pointerdown', handlePointerDown as EventListener);
      return () => {
        document.removeEventListener('pointerdown', handlePointerDown as EventListener);
      };
    }

    // Fallback: listen to both mousedown and touchstart.
    document.addEventListener('mousedown', handlePointerDown as EventListener);
    document.addEventListener('touchstart', handlePointerDown as EventListener, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handlePointerDown as EventListener);
      document.removeEventListener('touchstart', handlePointerDown as EventListener);
    };
  });
</script>

<div bind:this={rootElement} class={classNames(className)} {...rest}>
  {@render children()}
</div>
