<script lang="ts" module>
  /**
   * @cinder
   * @category action
   * @status stable
   * @purpose Single selectable row inside a command-palette that registers itself with the parent and invokes its onselect handler when chosen.
   * @tag action
   * @tag command
   * @useWhen Declaring an individual command, action, or result row inside a command-palette.
   * @useWhen Composing a custom palette layout via children rather than the items prop.
   * @avoidWhen Used outside a command-palette ancestor — the component throws at construction.
   * @avoidWhen Rendering a generic dropdown choice — use dropdown-item instead.
   * @related command-palette, dropdown-item
   */
  export type { CommandItemProps } from './command-item.types.ts';
</script>

<script lang="ts">
  import type { CommandItemProps } from './command-item.types.ts';
  import { getContext, hasContext, onMount } from 'svelte';

  import { cn } from '../../utilities/class-names.ts';
  import {
    COMMAND_PALETTE_CONTEXT,
    type CommandPaletteContext,
  } from '../_internal/command-palette-context.ts';

  if (!hasContext(COMMAND_PALETTE_CONTEXT)) {
    throw new Error('CommandItem must be used within a CommandPalette.');
  }

  let {
    value,
    onselect,
    disabled = false,
    description,
    leading,
    trailing,
    children,
    class: className,
  }: CommandItemProps = $props();

  const palette = getContext<CommandPaletteContext>(COMMAND_PALETTE_CONTEXT);

  // Stable id assigned by the palette on registration.
  let itemId = $state<string | null>(null);

  // Register once on mount using live getters so prop changes are reflected
  // without re-registration churn.
  onMount(() => {
    const { id, unregister } = palette.register({
      getValue: () => value,
      getOnselect: () => onselect,
      getDisabled: () => disabled,
    });
    itemId = id;
    return () => {
      unregister();
      itemId = null;
    };
  });

  const isActive = $derived(itemId !== null && palette.activeItemId === itemId);

  function handlePointerEnter() {
    if (!disabled && itemId !== null) {
      palette.setActiveById(itemId);
    }
  }

  function handlePointerDown(event: PointerEvent) {
    // Prevent the input from losing focus when the user clicks an item.
    event.preventDefault();
  }

  function handleClick() {
    if (!disabled) {
      onselect();
    }
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<li
  id={itemId ?? undefined}
  role="option"
  class={cn('cinder-command-item', className)}
  aria-selected={isActive}
  aria-disabled={disabled || undefined}
  data-cinder-active={isActive ? '' : undefined}
  data-cinder-disabled={disabled || undefined}
  onpointerenter={handlePointerEnter}
  onpointerdown={handlePointerDown}
  onclick={handleClick}
>
  {#if leading}
    <span class="cinder-command-item__leading" aria-hidden="true">
      {@render leading()}
    </span>
  {/if}

  <span class="cinder-command-item__content">
    <span class="cinder-command-item__label">
      {@render children()}
    </span>
    {#if description}
      <span class="cinder-command-item__description">{description}</span>
    {/if}
  </span>

  {#if trailing}
    <span class="cinder-command-item__trailing" aria-hidden="true">
      {@render trailing()}
    </span>
  {/if}
</li>
