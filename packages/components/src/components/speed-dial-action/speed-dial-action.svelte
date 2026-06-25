<script lang="ts" module>
  /**
   * @cinder
   * @category action
   * @status beta
   * @purpose Quick-action leaf for SpeedDial that closes the owning dial after activation.
   * @tag action
   * @tag floating
   * @useWhen Rendering a secondary quick action inside SpeedDial.
   * @avoidWhen Rendering an action outside SpeedDial - use floating-action-button directly. | floating-action-button
   * @related speed-dial, floating-action-button
   */
  export type {
    SpeedDialActionLabelPlacement,
    SpeedDialActionProps,
  } from './speed-dial-action.types.ts';
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';
  import FloatingActionButton from '../floating-action-button/floating-action-button.svelte';
  import { getSpeedDialContext } from '../speed-dial/speed-dial.context.ts';
  import type { SpeedDialActionProps } from './speed-dial-action.types.ts';

  const fallbackButtonId = $props.id();

  let {
    id = fallbackButtonId,
    label,
    icon,
    onclick,
    disabled = false,
    labelPlacement = 'auto',
    class: customClassName,
    ...rest
  }: SpeedDialActionProps = $props();

  const context = getSpeedDialContext();
  let rootElement = $state<HTMLDivElement | null>(null);

  function handleClick(event: MouseEvent): void {
    if (disabled) return;
    onclick?.(event);
    context.close({ focusTrigger: true });
  }

  $effect(() => {
    const button = rootElement?.querySelector<HTMLButtonElement>('button.cinder-fab');
    if (!button) return;

    context.register(button);
    return () => context.unregister(button);
  });
</script>

<div
  bind:this={rootElement}
  class={classNames('cinder-speed-dial-action', customClassName)}
  data-cinder-label-placement={labelPlacement}
  data-cinder-open={context.isOpen ? '' : undefined}
  data-cinder-direction={context.direction}
>
  <FloatingActionButton
    {...rest}
    {id}
    size="sm"
    aria-label={label}
    {disabled}
    onclick={handleClick}
  >
    {@render icon?.()}
  </FloatingActionButton>

  {#if labelPlacement !== 'none'}
    <label for={id} class="cinder-speed-dial-action__label" aria-hidden="true">{label}</label>
  {/if}
</div>
