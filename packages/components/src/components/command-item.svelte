<script lang="ts" module>
  import type { Snippet } from 'svelte';

  export type CommandItemProps = {
    /** Submitted value; surfaced through the registration record. */
    value: string;
    /** Invoked on Enter or click. */
    onselect: () => void;
    /** When true, the item is skipped by arrow keys and cannot be activated. */
    disabled?: boolean;
    /** Optional secondary text shown below the main label. */
    description?: string;
    /** Leading content (icon, avatar). Rendered with aria-hidden. */
    leading?: Snippet;
    /** Trailing content (kbd hint, badge). Rendered with aria-hidden. */
    trailing?: Snippet;
    /** Main label content. */
    children: Snippet;
    /** Class merged with `.cinder-command-item`. */
    class?: string;
  };
</script>

<script lang="ts">
  import { getContext, hasContext, onMount } from 'svelte';

  import { cn } from '../utilities/class-names.ts';
  import {
    COMMAND_PALETTE_CONTEXT,
    type CommandPaletteContext,
  } from './_internal/command-palette-context.ts';

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
